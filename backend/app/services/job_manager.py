import uuid
from app.models.schemas import JobStatus, JobResponse

_jobs: dict[str, dict] = {}


def create_job() -> str:
    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {
        "status": JobStatus.pending,
        "progress": 0.0,
        "message": "",
        "result": None,
    }
    return job_id


def update_job(job_id: str, **kwargs):
    if job_id in _jobs:
        _jobs[job_id].update(kwargs)


def get_job(job_id: str) -> JobResponse | None:
    if job_id not in _jobs:
        return None
    j = _jobs[job_id]
    return JobResponse(
        job_id=job_id,
        status=j["status"],
        progress=j["progress"],
        message=j["message"],
        result=j["result"],
    )
