import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File

from app.config import DATA_DIR
from app.models.schemas import ProjectResponse

router = APIRouter()


@router.post("/projects", response_model=ProjectResponse)
async def create_project(files: list[UploadFile] = File(...)):
    """Upload images and create a new project."""
    project_id = str(uuid.uuid4())[:8]
    project_dir = DATA_DIR / project_id
    image_dir = project_dir / "images"
    image_dir.mkdir(parents=True)

    count = 0
    for f in files:
        if f.content_type and f.content_type.startswith("image/"):
            dest = image_dir / f.filename
            with open(dest, "wb") as out:
                shutil.copyfileobj(f.file, out)
            count += 1

    return ProjectResponse(project_id=project_id, image_count=count)
