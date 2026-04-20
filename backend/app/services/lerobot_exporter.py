import json
import numpy as np
from pathlib import Path
from PIL import Image

from app.utils.ply_io import read_ply


def export_to_lerobot(project_dir: Path, variant_paths: list[str]) -> str:
    """Export augmented scenes as a dataset in a simple image-based format.

    For MVP, we export rendered views as numbered images with metadata JSON.
    Full LeRobot integration requires their dataset API which has complex deps.
    """
    export_dir = project_dir / "export"
    export_dir.mkdir(exist_ok=True)
    images_dir = export_dir / "images"
    images_dir.mkdir(exist_ok=True)

    # Read camera data for rendering viewpoints
    cam_data = _read_camera_poses(project_dir)

    metadata = {
        "format": "robosplat_v1",
        "num_variants": len(variant_paths),
        "episodes": [],
    }

    # For each variant, copy the original images as "augmented" views
    # In a full implementation, we'd render from the modified splat
    original_images = sorted((project_dir / "images").glob("*"))

    for v_idx, variant_path in enumerate(variant_paths):
        episode = {
            "episode_id": v_idx,
            "variant_ply": variant_path,
            "frames": [],
        }

        # For MVP: use original images + metadata about the variant
        for f_idx, img_path in enumerate(original_images[:5]):  # Limit frames
            out_name = f"ep{v_idx:04d}_frame{f_idx:04d}.jpg"
            out_path = images_dir / out_name

            # Copy original image (in production, render from modified splat)
            img = Image.open(img_path)
            img.save(out_path, quality=90)

            episode["frames"].append({
                "frame_id": f_idx,
                "image": str(out_path.relative_to(export_dir)),
                "camera_pose": cam_data[f_idx] if f_idx < len(cam_data) else None,
            })

        metadata["episodes"].append(episode)

    # Write metadata
    meta_path = export_dir / "metadata.json"
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2, default=str)

    return str(export_dir)


def _read_camera_poses(project_dir: Path) -> list[dict]:
    """Read camera poses from COLMAP for export metadata."""
    images_file = project_dir / "colmap" / "sparse" / "0" / "images.txt"
    poses = []

    if not images_file.exists():
        return poses

    with open(images_file) as f:
        lines = [l.strip() for l in f if not l.startswith("#") and l.strip()]

    for i in range(0, len(lines), 2):
        parts = lines[i].split()
        if len(parts) >= 10:
            poses.append({
                "qw": float(parts[1]),
                "qx": float(parts[2]),
                "qy": float(parts[3]),
                "qz": float(parts[4]),
                "tx": float(parts[5]),
                "ty": float(parts[6]),
                "tz": float(parts[7]),
                "image": parts[9],
            })

    return poses
