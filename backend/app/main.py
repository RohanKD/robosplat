from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import DATA_DIR
from app.routers import upload, reconstruct, segment, edit, export, jobs

app = FastAPI(title="RoboSplat Studio", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(upload.router, prefix="/api")
app.include_router(reconstruct.router, prefix="/api")
app.include_router(segment.router, prefix="/api")
app.include_router(edit.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")

# Serve project data files (PLY, images, exports)
app.mount("/api/projects", StaticFiles(directory=str(DATA_DIR)), name="project_files")
