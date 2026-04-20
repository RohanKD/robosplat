from fastapi import APIRouter

from app.config import DATA_DIR
from app.models.schemas import EditRequest
from app.services.splat_editor import apply_edit

router = APIRouter()


@router.post("/projects/{project_id}/edit")
async def edit_splat(project_id: str, req: EditRequest):
    """Apply an edit to a segment in the splat."""
    project_dir = DATA_DIR / project_id
    output_path = apply_edit(
        project_dir,
        segment_id=req.segment_id,
        translation=req.translation,
        rotation=req.rotation,
        scale=req.scale,
        color_shift=req.color_shift,
    )
    return {
        "status": "ok",
        "output_path": output_path,
        "splat_url": f"/api/projects/{project_id}/splat/point_cloud.ply",
    }
