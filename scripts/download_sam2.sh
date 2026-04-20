#!/bin/bash
set -e

CHECKPOINT_DIR="$(cd "$(dirname "$0")/.." && pwd)/checkpoints"
mkdir -p "$CHECKPOINT_DIR"

MODEL_URL="https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_small.pt"
CHECKPOINT_PATH="$CHECKPOINT_DIR/sam2.1_hiera_small.pt"

if [ -f "$CHECKPOINT_PATH" ]; then
    echo "SAM2 checkpoint already exists at $CHECKPOINT_PATH"
    exit 0
fi

echo "Downloading SAM2 small checkpoint..."
curl -L -o "$CHECKPOINT_PATH" "$MODEL_URL"

echo "SAM2 checkpoint downloaded to $CHECKPOINT_PATH"
