import asyncio
from pathlib import Path

from app.config import OPENSPLAT_BIN
from app.services.job_manager import update_job
from app.models.schemas import JobStatus


async def run_opensplat(project_dir: Path, job_id: str) -> bool:
    """Run OpenSplat on COLMAP output to produce a .ply gaussian splat."""
    colmap_input = project_dir / "colmap" / "sparse" / "0"
    splat_dir = project_dir / "splat"
    splat_dir.mkdir(exist_ok=True)
    output_ply = splat_dir / "point_cloud.ply"

    if not OPENSPLAT_BIN.exists():
        update_job(job_id, status=JobStatus.failed,
                   message=f"OpenSplat binary not found at {OPENSPLAT_BIN}. Run: make build-opensplat")
        return False

    update_job(job_id, status=JobStatus.running, progress=0.6,
               message="Running Gaussian Splatting (this takes a few minutes)...")

    cmd = [
        str(OPENSPLAT_BIN),
        str(colmap_input),
        "--output", str(output_ply),
        "--num-iters", "2000",  # Reduced for faster MVP
        "--downscale-factor", "2",
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        update_job(job_id, status=JobStatus.failed,
                   message=f"OpenSplat failed: {stderr.decode()[-500:]}")
        return False

    if not output_ply.exists():
        update_job(job_id, status=JobStatus.failed,
                   message="OpenSplat completed but no output PLY found")
        return False

    update_job(job_id, progress=0.9, message="Gaussian Splatting complete")
    return True
