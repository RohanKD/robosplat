import numpy as np
from plyfile import PlyData, PlyElement


def read_ply(path: str) -> dict:
    """Read a Gaussian Splat PLY file into numpy arrays."""
    plydata = PlyData.read(path)
    vertex = plydata["vertex"]

    positions = np.stack([vertex["x"], vertex["y"], vertex["z"]], axis=-1)

    # Try to read all standard gaussian splat properties
    result = {"positions": positions, "_plydata": plydata, "_vertex": vertex}

    # Opacity
    if "opacity" in vertex.data.dtype.names:
        result["opacities"] = vertex["opacity"]

    # Scales
    scale_names = [n for n in vertex.data.dtype.names if n.startswith("scale_")]
    if scale_names:
        result["scales"] = np.stack([vertex[n] for n in sorted(scale_names)], axis=-1)

    # Rotations
    rot_names = [n for n in vertex.data.dtype.names if n.startswith("rot_")]
    if rot_names:
        result["rotations"] = np.stack([vertex[n] for n in sorted(rot_names)], axis=-1)

    # Spherical harmonics (f_dc_0..2 for base color, f_rest_* for higher order)
    dc_names = sorted([n for n in vertex.data.dtype.names if n.startswith("f_dc_")])
    if dc_names:
        result["sh_dc"] = np.stack([vertex[n] for n in dc_names], axis=-1)

    rest_names = sorted([n for n in vertex.data.dtype.names if n.startswith("f_rest_")])
    if rest_names:
        result["sh_rest"] = np.stack([vertex[n] for n in rest_names], axis=-1)

    # Color (some PLY files use red/green/blue instead of SH)
    if "red" in vertex.data.dtype.names:
        result["colors"] = np.stack(
            [vertex["red"], vertex["green"], vertex["blue"]], axis=-1
        )

    return result


def write_ply(path: str, data: dict):
    """Write modified gaussian splat data back to PLY."""
    plydata = data["_plydata"]
    vertex = data["_vertex"]

    # Update positions
    vertex["x"] = data["positions"][:, 0]
    vertex["y"] = data["positions"][:, 1]
    vertex["z"] = data["positions"][:, 2]

    # Update SH DC coefficients if modified
    if "sh_dc" in data:
        dc_names = sorted([n for n in vertex.data.dtype.names if n.startswith("f_dc_")])
        for i, name in enumerate(dc_names):
            vertex[name] = data["sh_dc"][:, i]

    # Update colors if present
    if "colors" in data and "red" in vertex.data.dtype.names:
        vertex["red"] = data["colors"][:, 0]
        vertex["green"] = data["colors"][:, 1]
        vertex["blue"] = data["colors"][:, 2]

    # Update scales if modified
    if "scales" in data:
        scale_names = sorted(
            [n for n in vertex.data.dtype.names if n.startswith("scale_")]
        )
        for i, name in enumerate(scale_names):
            vertex[name] = data["scales"][:, i]

    # Update rotations if modified
    if "rotations" in data:
        rot_names = sorted(
            [n for n in vertex.data.dtype.names if n.startswith("rot_")]
        )
        for i, name in enumerate(rot_names):
            vertex[name] = data["rotations"][:, i]

    plydata.write(path)
