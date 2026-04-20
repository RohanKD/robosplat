import asyncio
import shutil
from pathlib import Path

from app.services.job_manager import update_job
from app.models.schemas import JobStatus


async def run_colmap(project_dir: Path, job_id: str):
    """Run COLMAP SfM pipeline on uploaded images."""
    image_dir = project_dir / "images"
    colmap_dir = project_dir / "colmap"
    colmap_dir.mkdir(exist_ok=True)

    db_path = colmap_dir / "database.db"
    sparse_dir = colmap_dir / "sparse"
    sparse_dir.mkdir(exist_ok=True)

    colmap_bin = shutil.which("colmap")
    if not colmap_bin:
        update_job(job_id, status=JobStatus.failed, message="COLMAP not found. Install with: brew install colmap")
        return False

    steps = [
        {
            "name": "Feature extraction",
            "cmd": [
                colmap_bin, "feature_extractor",
                "--database_path", str(db_path),
                "--image_path", str(image_dir),
                "--ImageReader.single_camera", "1",
                "--SiftExtraction.use_gpu", "0",
            ],
            "progress": 0.1,
        },
        {
            "name": "Feature matching",
            "cmd": [
                colmap_bin, "exhaustive_matcher",
                "--database_path", str(db_path),
                "--SiftMatching.use_gpu", "0",
            ],
            "progress": 0.3,
        },
        {
            "name": "Sparse reconstruction",
            "cmd": [
                colmap_bin, "mapper",
                "--database_path", str(db_path),
                "--image_path", str(image_dir),
                "--output_path", str(sparse_dir),
            ],
            "progress": 0.5,
        },
    ]

    for step in steps:
        update_job(job_id, status=JobStatus.running, progress=step["progress"],
                   message=f"COLMAP: {step['name']}...")

        proc = await asyncio.create_subprocess_exec(
            *step["cmd"],
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            update_job(
                job_id,
                status=JobStatus.failed,
                message=f"COLMAP {step['name']} failed: {stderr.decode()[-500:]}",
            )
            return False

    # Check that sparse/0 exists
    if not (sparse_dir / "0").exists():
        update_job(job_id, status=JobStatus.failed,
                   message="COLMAP reconstruction failed - no model produced. Try more overlapping photos.")
        return False

    update_job(job_id, progress=0.5, message="COLMAP complete")
    return True
