#!/bin/bash
# deploy.sh — Deploy DocParse API to Cloud Run on ailang-multivac
#
# Usage:
#   bash deploy.sh              # Build and deploy
#   bash deploy.sh --setup      # First-time setup (enable APIs, create repo)
#   bash deploy.sh --local      # Build and run locally

set -euo pipefail

PROJECT="ailang-multivac"
REGION="us-central1"
SERVICE="docparse-api"
REPO="docparse"
AILANG_VERSION="v0.9.2"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/${SERVICE}:latest"

# --- First-time setup ---
setup() {
  echo "=== Setting up GCP infrastructure ==="

  echo "Enabling APIs..."
  gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    cloudtrace.googleapis.com \
    aiplatform.googleapis.com \
    --project="${PROJECT}"

  echo "Creating Artifact Registry repository..."
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT}" \
    --description="DocParse container images" 2>/dev/null || echo "  (already exists)"

  echo "Configuring Docker auth..."
  gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

  echo ""
  echo "Setup complete. Run 'bash deploy.sh' to build and deploy."
}

# --- Build ---
build() {
  echo "=== Building DocParse container ==="
  echo "Image: ${IMAGE}"
  echo ""

  docker build \
    --platform linux/amd64 \
    --build-arg "AILANG_VERSION=${AILANG_VERSION}" \
    -t "${IMAGE}" \
    .

  echo ""
  echo "Build complete."
}

# --- Push ---
push() {
  echo "=== Pushing to Artifact Registry ==="
  docker push "${IMAGE}"
  echo "Push complete."
}

# --- Deploy ---
deploy() {
  echo "=== Deploying to Cloud Run ==="

  gcloud run deploy "${SERVICE}" \
    --image="${IMAGE}" \
    --region="${REGION}" \
    --project="${PROJECT}" \
    --platform=managed \
    --allow-unauthenticated \
    --memory=1Gi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=10 \
    --timeout=300s \
    --concurrency=80 \
    --set-env-vars="GOOGLE_API_KEY=,GOOGLE_CLOUD_PROJECT=${PROJECT}"

  echo ""
  echo "=== Deployment complete ==="
  URL=$(gcloud run services describe "${SERVICE}" \
    --region="${REGION}" \
    --project="${PROJECT}" \
    --format='value(status.url)')
  echo "Service URL: ${URL}"
  echo ""
  echo "Test endpoints:"
  echo "  curl -X POST ${URL}/api/docparse/services/api_server/health -H 'Content-Type: application/json' -d '\"ping\"'"
  echo "  curl -X POST ${URL}/api/docparse/services/api_server/formats -H 'Content-Type: application/json' -d '\"x\"'"
  echo "  Swagger UI: ${URL}/api/_meta/docs"
  echo "  OpenAPI spec: ${URL}/api/_meta/openapi.json"
}

# --- Local run ---
local_run() {
  echo "=== Running DocParse locally ==="
  build
  echo ""
  echo "Starting container on http://localhost:8080 ..."
  echo "  Swagger UI: http://localhost:8080/api/_meta/docs"
  echo "  Health:     curl -X POST http://localhost:8080/api/docparse/services/api_server/health -d '\"ping\"'"
  echo ""
  docker run --rm -p 8080:8080 \
    -e GOOGLE_API_KEY="" \
    "${IMAGE}"
}

# --- Main ---
case "${1:-}" in
  --setup)
    setup
    ;;
  --local)
    local_run
    ;;
  *)
    build
    push
    deploy
    ;;
esac
