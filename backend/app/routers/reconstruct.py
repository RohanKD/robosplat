import asyncio
from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.config import DATA_DIR
from app.models.schemas import JobResponse, JobStatus
from app.services.job_manager import create_job, update_job, get_job
from app.services.colmap_runner import run_colmap
from app.services.opensplat_runner import run_opensplat

router = APIRouter()


async def _reconstruct_pipeline(project_id: str, job_id: str):
    """Run COLMAP + OpenSplat pipeline."""
    project_dir = DATA_DIR / project_id

    success = await run_colmap(project_dir, job_id)
    if not success:
        return

    success = await run_opensplat(project_dir, job_id)
    if not success:
        return

    update_job(
        job_id,
        status=JobStatus.completed,
        progress=1.0,
        message="Reconstruction complete",
        result={"ply_path": f"/api/projects/{project_id}/splat/point_cloud.ply"},
    )


@router.post("/projects/{project_id}/reconstruct", response_model=JobResponse)
async def start_reconstruction(project_id: str, background_tasks: BackgroundTasks):
    """Start the 3D reconstruction pipeline."""
    project_dir = DATA_DIR / project_id
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail="Project not found")

    job_id = create_job()
    update_job(job_id, status=JobStatus.running, message="Starting reconstruction...")

    background_tasks.add_task(_reconstruct_pipeline, project_id, job_id)

    return get_job(job_id)
