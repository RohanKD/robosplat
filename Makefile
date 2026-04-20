.PHONY: setup dev-backend dev-frontend dev build-opensplat download-sam2 install-deps

# Install system dependencies (macOS)
install-deps:
	brew install colmap cmake ninja

# Build OpenSplat from source with MPS
build-opensplat:
	bash scripts/build_opensplat.sh

# Download SAM2 checkpoint
download-sam2:
	bash scripts/download_sam2.sh

# Set up Python backend
setup-backend:
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# Set up frontend
setup-frontend:
	cd frontend && npm install

# Full setup
setup: install-deps setup-backend setup-frontend download-sam2
	@echo "Setup complete. Run 'make build-opensplat' to build the 3DGS engine."

# Run backend dev server
dev-backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run frontend dev server
dev-frontend:
	cd frontend && npm run dev

# Run both (use two terminals, or run each in background)
dev:
	@echo "Run in two terminals:"
	@echo "  make dev-backend"
	@echo "  make dev-frontend"
