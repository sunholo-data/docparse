FROM debian:bookworm-slim

# Install minimal dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Download and install AILANG
ARG AILANG_VERSION=v0.9.2
RUN curl -fsSL "https://github.com/sunholo-data/ailang/releases/download/${AILANG_VERSION}/linux.x64.ailang.tar.gz" \
    | tar -xz -C /usr/local/bin/ && \
    chmod +x /usr/local/bin/ailang

# Copy DocParse modules
WORKDIR /app
COPY docparse/ ./docparse/
COPY data/test_files/ ./data/test_files/

# Cloud Run sets PORT env var (default 8080)
ENV PORT=8080
# Use ADC for Vertex AI (no API key needed on Cloud Run)
ENV GOOGLE_API_KEY=""
# Firestore config (set via Terraform / Cloud Run env vars)
ENV GOOGLE_CLOUD_PROJECT=""
ENV FIRESTORE_DATABASE="docparse"
ENV FIRESTORE_COLLECTION="api_keys"

EXPOSE 8080

# Run serve-api with all capabilities
# Concurrency confirmed working (test harness was the issue, not AILANG)
# Cloud Run concurrency=80 is safe — 1-6ms per request
CMD ailang serve-api \
    --caps IO,FS,AI,Env,Net,Rand,Clock \
    --ai gemini-2.5-flash \
    --port ${PORT} \
    --cors \
    docparse/
