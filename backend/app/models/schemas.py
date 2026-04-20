from pydantic import BaseModel
from enum import Enum


class JobStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class JobResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: float = 0.0
    message: str = ""
    result: dict | None = None


class ProjectResponse(BaseModel):
    project_id: str
    image_count: int


class SegmentInfo(BaseModel):
    segment_id: int
    gaussian_count: int
    center: list[float]
    bbox_min: list[float]
    bbox_max: list[float]
    color: list[float]


class SegmentationResponse(BaseModel):
    project_id: str
    segments: list[SegmentInfo]


class EditRequest(BaseModel):
    segment_id: int
    translation: list[float] = [0.0, 0.0, 0.0]
    rotation: list[float] = [0.0, 0.0, 0.0]
    scale: list[float] = [1.0, 1.0, 1.0]
    color_shift: list[float] | None = None  # [hue, saturation, value] deltas


class ExportRequest(BaseModel):
    num_variants: int = 10
    position_jitter: float = 0.1
    color_jitter: float = 0.2
