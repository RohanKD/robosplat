from fastapi import APIRouter, HTTPException

from app.models.schemas import JobResponse
from app.services.job_manager import get_job

router = APIRouter()


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job_status(job_id: str):
    """Poll job status."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
