from fastapi import APIRouter

from app.config import DATA_DIR
from app.models.schemas import SegmentationResponse
from app.services.sam2_segmenter import segment_splat

router = APIRouter()


@router.post("/projects/{project_id}/segment", response_model=SegmentationResponse)
async def run_segmentation(project_id: str):
    """Run SAM2 segmentation on the reconstructed splat."""
    project_dir = DATA_DIR / project_id
    segments = segment_splat(project_dir)
    return SegmentationResponse(project_id=project_id, segments=segments)
