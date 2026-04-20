import json
import numpy as np
from pathlib import Path
from scipy.spatial.transform import Rotation

from app.utils.ply_io import read_ply, write_ply


def apply_edit(project_dir: Path, segment_id: int,
               translation: list[float],
               rotation: list[float],
               scale: list[float],
               color_shift: list[float] | None = None) -> str:
    """Apply a transform to a segment's Gaussians and save the result."""
    ply_path = project_dir / "splat" / "point_cloud.ply"
    segments_path = project_dir / "segments" / "segments.json"
    edits_dir = project_dir / "edits"
    edits_dir.mkdir(exist_ok=True)

    with open(segments_path) as f:
        seg_mapping = json.load(f)

    indices = np.array(seg_mapping[str(segment_id)])
    data = read_ply(str(ply_path))

    # Apply translation
    if any(t != 0.0 for t in translation):
        data["positions"][indices] += np.array(translation)

    # Apply rotation (Euler angles in degrees)
    if any(r != 0.0 for r in rotation):
        rot = Rotation.from_euler("xyz", rotation, degrees=True)
        seg_positions = data["positions"][indices]
        center = seg_positions.mean(axis=0)
        data["positions"][indices] = rot.apply(seg_positions - center) + center

        # Also rotate the Gaussian orientations
        if "rotations" in data:
            seg_rots = data["rotations"][indices]  # quaternions
            for i, idx in enumerate(indices):
                q = seg_rots[i]
                orig_rot = Rotation.from_quat([q[1], q[2], q[3], q[0]])  # xyzw
                new_rot = rot * orig_rot
                quat = new_rot.as_quat()  # xyzw
                data["rotations"][idx] = [quat[3], quat[0], quat[1], quat[2]]  # wxyz

    # Apply scale
    if any(s != 1.0 for s in scale):
        seg_positions = data["positions"][indices]
        center = seg_positions.mean(axis=0)
        data["positions"][indices] = (seg_positions - center) * np.array(scale) + center

        if "scales" in data:
            data["scales"][indices] += np.log(np.array(scale))  # log-space scales

    # Apply color shift (modify SH DC component)
    if color_shift is not None and "sh_dc" in data:
        data["sh_dc"][indices] += np.array(color_shift)

    # Save edited version
    output_path = edits_dir / f"edited_{segment_id}.ply"
    write_ply(str(output_path), data)

    # Also overwrite the main splat for cumulative edits
    write_ply(str(ply_path), data)

    return str(output_path)


def generate_variants(project_dir: Path, num_variants: int,
                      position_jitter: float = 0.1,
                      color_jitter: float = 0.2) -> list[str]:
    """Generate N random variants of the scene for data augmentation."""
    ply_path = project_dir / "splat" / "point_cloud.ply"
    segments_path = project_dir / "segments" / "segments.json"
    variants_dir = project_dir / "edits" / "variants"
    variants_dir.mkdir(parents=True, exist_ok=True)

    with open(segments_path) as f:
        seg_mapping = json.load(f)

    variant_paths = []

    for v in range(num_variants):
        data = read_ply(str(ply_path))

        for seg_id, idx_list in seg_mapping.items():
            indices = np.array(idx_list)
            if len(indices) < 10:
                continue

            # Random position jitter
            jitter = np.random.uniform(-position_jitter, position_jitter, size=3)
            data["positions"][indices] += jitter

            # Random color jitter on SH DC
            if "sh_dc" in data:
                c_jitter = np.random.uniform(-color_jitter, color_jitter, size=data["sh_dc"].shape[1])
                data["sh_dc"][indices] += c_jitter

        output_path = variants_dir / f"variant_{v:04d}.ply"
        write_ply(str(output_path), data)
        variant_paths.append(str(output_path))

    return variant_paths
