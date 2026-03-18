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

EXPOSE 8080

# Run serve-api with all capabilities
CMD ailang serve-api \
    --caps IO,FS,AI,Env \
    --ai gemini-2.5-flash \
    --port ${PORT} \
    --cors \
    --api-key-header "unstructured-api-key" \
    --api-key-env "DOCPARSE_API_KEY" \
    --max-upload-size 104857600 \
    docparse/
