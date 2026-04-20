import json
import numpy as np
from pathlib import Path
from PIL import Image

from app.config import SAM2_CHECKPOINT, SAM2_CONFIG
from app.models.schemas import SegmentInfo
from app.utils.ply_io import read_ply


def _get_device():
    import torch
    if torch.backends.mps.is_available():
        return "mps"
    elif torch.cuda.is_available():
        return "cuda"
    return "cpu"


def _load_sam2():
    """Load SAM2 model lazily."""
    from sam2.build_sam import build_sam2
    from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator

    device = _get_device()
    sam2 = build_sam2(
        SAM2_CONFIG,
        str(SAM2_CHECKPOINT),
        device=device,
    )
    mask_generator = SAM2AutomaticMaskGenerator(
        sam2,
        points_per_side=16,  # Fewer points for speed
        pred_iou_thresh=0.7,
        stability_score_thresh=0.8,
        min_mask_region_area=500,
    )
    return mask_generator


def _project_gaussians_to_image(positions: np.ndarray, cam_matrix: np.ndarray,
                                 img_width: int, img_height: int):
    """Project 3D Gaussian centers to 2D image coordinates.
    cam_matrix: 3x4 projection matrix (K @ [R|t])
    Returns: (N, 2) pixel coordinates, (N,) valid mask
    """
    n = positions.shape[0]
    homo = np.hstack([positions, np.ones((n, 1))])  # (N, 4)
    proj = (cam_matrix @ homo.T).T  # (N, 3)

    # Avoid division by zero
    valid = proj[:, 2] > 0.01
    px = np.zeros((n, 2))
    px[valid, 0] = proj[valid, 0] / proj[valid, 2]
    px[valid, 1] = proj[valid, 1] / proj[valid, 2]

    # Check bounds
    valid &= (px[:, 0] >= 0) & (px[:, 0] < img_width)
    valid &= (px[:, 1] >= 0) & (px[:, 1] < img_height)

    return px.astype(int), valid


def _read_colmap_cameras(project_dir: Path):
    """Read camera intrinsics and extrinsics from COLMAP output.
    Returns list of (image_path, projection_matrix, width, height).
    """
    sparse_dir = project_dir / "colmap" / "sparse" / "0"
    cameras_file = sparse_dir / "cameras.txt"
    images_file = sparse_dir / "images.txt"

    # Parse cameras.txt
    cameras = {}
    if cameras_file.exists():
        with open(cameras_file) as f:
            for line in f:
                if line.startswith("#"):
                    continue
                parts = line.strip().split()
                if len(parts) >= 5:
                    cam_id = int(parts[0])
                    model = parts[1]
                    w, h = int(parts[2]), int(parts[3])
                    params = [float(p) for p in parts[4:]]
                    cameras[cam_id] = {"model": model, "w": w, "h": h, "params": params}

    # Parse images.txt (every other line has image data)
    image_data = []
    if images_file.exists():
        with open(images_file) as f:
            lines = [l.strip() for l in f if not l.startswith("#") and l.strip()]

        for i in range(0, len(lines), 2):
            parts = lines[i].split()
            if len(parts) < 10:
                continue
            qw, qx, qy, qz = [float(parts[j]) for j in range(1, 5)]
            tx, ty, tz = [float(parts[j]) for j in range(5, 8)]
            cam_id = int(parts[8])
            img_name = parts[9]

            if cam_id not in cameras:
                continue

            cam = cameras[cam_id]
            # Build rotation matrix from quaternion
            R = _quat_to_rot(qw, qx, qy, qz)
            t = np.array([tx, ty, tz])

            # Build intrinsic matrix (assume SIMPLE_PINHOLE or PINHOLE)
            if cam["model"] == "SIMPLE_PINHOLE":
                f, cx, cy = cam["params"][0], cam["params"][1], cam["params"][2]
                K = np.array([[f, 0, cx], [0, f, cy], [0, 0, 1]])
            elif cam["model"] == "PINHOLE":
                fx, fy, cx, cy = cam["params"][:4]
                K = np.array([[fx, 0, cx], [0, fy, cy], [0, 0, 1]])
            else:
                # Fallback: use first param as focal
                f = cam["params"][0]
                K = np.array([[f, 0, cam["w"]/2], [0, f, cam["h"]/2], [0, 0, 1]])

            Rt = np.hstack([R, t.reshape(3, 1)])
            P = K @ Rt

            image_data.append({
                "name": img_name,
                "P": P,
                "w": cam["w"],
                "h": cam["h"],
            })

    return image_data


def _quat_to_rot(qw, qx, qy, qz):
    """Convert quaternion to 3x3 rotation matrix."""
    R = np.array([
        [1 - 2*(qy**2 + qz**2), 2*(qx*qy - qz*qw), 2*(qx*qz + qy*qw)],
        [2*(qx*qy + qz*qw), 1 - 2*(qx**2 + qz**2), 2*(qy*qz - qx*qw)],
        [2*(qx*qz - qy*qw), 2*(qy*qz + qx*qw), 1 - 2*(qx**2 + qz**2)],
    ])
    return R


def segment_splat(project_dir: Path) -> list[SegmentInfo]:
    """Segment a gaussian splat using SAM2 masks projected into 3D."""
    ply_path = project_dir / "splat" / "point_cloud.ply"
    image_dir = project_dir / "images"
    segment_dir = project_dir / "segments"
    segment_dir.mkdir(exist_ok=True)

    splat_data = read_ply(str(ply_path))
    positions = splat_data["positions"]
    n_gaussians = positions.shape[0]

    # Load camera data from COLMAP
    cam_data = _read_colmap_cameras(project_dir)

    if not cam_data:
        # Fallback: simple spatial clustering if no camera data
        return _spatial_clustering_fallback(positions, segment_dir)

    # Use up to 3 views for segmentation
    views = cam_data[:3]
    mask_generator = _load_sam2()

    # Track which segment each Gaussian belongs to across views
    # segment_votes[i] = list of segment IDs from different views
    segment_votes = [[] for _ in range(n_gaussians)]
    global_seg_id = 0
    all_masks_info = []

    for view in views:
        img_path = image_dir / view["name"]
        if not img_path.exists():
            continue

        img = np.array(Image.open(img_path).convert("RGB"))
        h, w = img.shape[:2]

        # Run SAM2
        masks = mask_generator.generate(img)

        # Project Gaussians to this view
        px, valid = _project_gaussians_to_image(positions, view["P"], w, h)

        # Assign Gaussians to masks
        for mask_data in sorted(masks, key=lambda m: m["area"], reverse=True):
            mask = mask_data["segmentation"]  # (H, W) bool
            seg_id = global_seg_id
            global_seg_id += 1

            for gi in np.where(valid)[0]:
                x, y = px[gi]
                if mask[y, x]:
                    segment_votes[gi].append(seg_id)

    # Assign each Gaussian to its most-voted segment
    gaussian_labels = np.full(n_gaussians, -1, dtype=int)
    for i, votes in enumerate(segment_votes):
        if votes:
            # Most common vote
            gaussian_labels[i] = max(set(votes), key=votes.count)

    # Remap to contiguous IDs
    unique_labels = [l for l in np.unique(gaussian_labels) if l >= 0]
    label_map = {old: new for new, old in enumerate(unique_labels)}

    segments = []
    for old_label, new_label in label_map.items():
        mask = gaussian_labels == old_label
        seg_positions = positions[mask]
        if len(seg_positions) < 10:
            continue

        center = seg_positions.mean(axis=0).tolist()
        bbox_min = seg_positions.min(axis=0).tolist()
        bbox_max = seg_positions.max(axis=0).tolist()

        # Get base color from SH DC or colors
        if "sh_dc" in splat_data:
            seg_colors = splat_data["sh_dc"][mask].mean(axis=0)
            color = ((1 / (1 + np.exp(-seg_colors))) * 255).tolist()  # sigmoid + scale
        elif "colors" in splat_data:
            color = splat_data["colors"][mask].mean(axis=0).tolist()
        else:
            color = [128.0, 128.0, 128.0]

        segments.append(SegmentInfo(
            segment_id=new_label,
            gaussian_count=int(mask.sum()),
            center=center,
            bbox_min=bbox_min,
            bbox_max=bbox_max,
            color=color,
        ))

    # Save segment mapping
    seg_mapping = {}
    for old_label, new_label in label_map.items():
        mask = gaussian_labels == old_label
        seg_mapping[str(new_label)] = np.where(mask)[0].tolist()

    with open(segment_dir / "segments.json", "w") as f:
        json.dump(seg_mapping, f)

    return segments


def _spatial_clustering_fallback(positions: np.ndarray, segment_dir: Path) -> list[SegmentInfo]:
    """Simple k-means clustering fallback when no camera data available."""
    from sklearn.cluster import KMeans

    n_clusters = min(8, max(2, len(positions) // 5000))

    try:
        kmeans = KMeans(n_clusters=n_clusters, n_init=3, max_iter=50, random_state=42)
        labels = kmeans.fit_predict(positions)
    except Exception:
        # Ultra-fallback: split by octants
        labels = np.zeros(len(positions), dtype=int)
        center = positions.mean(axis=0)
        for i in range(3):
            labels += (positions[:, i] > center[i]).astype(int) * (2 ** i)

    segments = []
    seg_mapping = {}

    for label in np.unique(labels):
        mask = labels == label
        seg_positions = positions[mask]
        if len(seg_positions) < 10:
            continue

        segments.append(SegmentInfo(
            segment_id=int(label),
            gaussian_count=int(mask.sum()),
            center=seg_positions.mean(axis=0).tolist(),
            bbox_min=seg_positions.min(axis=0).tolist(),
            bbox_max=seg_positions.max(axis=0).tolist(),
            color=[128.0, 128.0, 128.0],
        ))
        seg_mapping[str(label)] = np.where(mask)[0].tolist()

    with open(segment_dir / "segments.json", "w") as f:
        json.dump(seg_mapping, f)

    return segments
