from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data" / "projects"
VENDOR_DIR = BASE_DIR / "vendor"
OPENSPLAT_BIN = VENDOR_DIR / "OpenSplat" / "build" / "opensplat"
SAM2_CHECKPOINT_DIR = BASE_DIR / "checkpoints"
SAM2_MODEL = "sam2.1_hiera_small"
SAM2_CHECKPOINT = SAM2_CHECKPOINT_DIR / "sam2.1_hiera_small.pt"
SAM2_CONFIG = "configs/sam2.1/sam2.1_hiera_s.yaml"

DATA_DIR.mkdir(parents=True, exist_ok=True)
