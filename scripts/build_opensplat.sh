#!/bin/bash
set -e

VENDOR_DIR="$(cd "$(dirname "$0")/../vendor" && pwd)"
OPENSPLAT_DIR="$VENDOR_DIR/OpenSplat"

if [ ! -d "$OPENSPLAT_DIR" ]; then
    echo "Cloning OpenSplat..."
    git clone https://github.com/pierotofy/OpenSplat.git "$OPENSPLAT_DIR"
fi

cd "$OPENSPLAT_DIR"
echo "Building OpenSplat with MPS support..."

mkdir -p build && cd build
cmake .. -GNinja -DGPU_RUNTIME=MPS
ninja

echo "OpenSplat built successfully at: $OPENSPLAT_DIR/build/opensplat"
