FROM golang:1.24-bookworm AS builder

# Clone and build AILANG from source (dev branch has @route, file upload, etc.)
RUN git clone --depth 1 --branch dev https://github.com/sunholo-data/ailang.git /ailang
WORKDIR /ailang
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /usr/local/bin/ailang ./cmd/ailang/

# Runtime image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/bin/ailang /usr/local/bin/ailang

# Copy DocParse modules
WORKDIR /app
COPY docparse/ ./docparse/
COPY data/test_files/ ./data/test_files/

# Cloud Run sets PORT env var (default 8080)
ENV PORT=8080
# Firestore config (overridden by Terraform / Cloud Run env vars)
ENV FIRESTORE_DATABASE="docparse"
ENV FIRESTORE_COLLECTION="api_keys"

EXPOSE 8080

# AI model configured via AILANG_AI_MODEL env var (default: none for Office-only parsing)
# Set AILANG_AI_MODEL=gemini-2.5-flash on Cloud Run for PDF/image parsing
CMD ailang serve-api \
    --caps IO,FS,AI,Env,Net,Rand,Clock \
    --port ${PORT} \
    --cors \
    docparse/
