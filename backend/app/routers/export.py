from fastapi import APIRouter

from app.config import DATA_DIR
from app.models.schemas import ExportRequest
from app.services.splat_editor import generate_variants
from app.services.lerobot_exporter import export_to_lerobot

router = APIRouter()


@router.post("/projects/{project_id}/export")
async def export_dataset(project_id: str, req: ExportRequest):
    """Generate augmented variants and export as training dataset."""
    project_dir = DATA_DIR / project_id

    # Generate random variants
    variant_paths = generate_variants(
        project_dir,
        num_variants=req.num_variants,
        position_jitter=req.position_jitter,
        color_jitter=req.color_jitter,
    )

    # Export to dataset format
    export_path = export_to_lerobot(project_dir, variant_paths)

    return {
        "status": "ok",
        "num_variants": len(variant_paths),
        "export_path": export_path,
        "download_url": f"/api/projects/{project_id}/export/metadata.json",
    }
