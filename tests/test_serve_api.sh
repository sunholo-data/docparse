#!/bin/bash
# test_serve_api.sh — CI smoke test for DocParse API server
#
# Tests all deterministic format endpoints + Unstructured compatibility.
# PDF/image formats are skipped (require AI capability).
#
# Usage: bash tests/test_serve_api.sh

set -uo pipefail

PORT=8099
PASS=0
FAIL=0
ERRORS=""

# --- Helpers ---

start_server() {
  echo "Starting serve-api on port $PORT..."
  ailang serve-api --caps IO,FS,Env,Net,Rand,Clock --ai-stub --port "$PORT" docparse/ > /tmp/docparse_test_server.log 2>&1 &
  SERVER_PID=$!
  # 31 modules with Net,Rand,Clock caps need ~15s to load
  sleep 15
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "FATAL: Server failed to start"
    exit 1
  fi
  echo "Server running (PID $SERVER_PID)"
}

stop_server() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}

check() {
  local name="$1"
  local result="$2"
  local expected="$3"

  if echo "$result" | grep -q "$expected" 2>/dev/null; then
    printf "  ✓ %-40s\n" "$name"
    PASS=$((PASS + 1))
  else
    printf "  ✗ %-40s got: %s\n" "$name" "$(echo "$result" | head -c 100)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  - $name"
  fi
}

parse_file() {
  local filepath="$1"
  curl -s -X POST "http://localhost:$PORT/api/v1/parse" \
    -H 'Content-Type: application/json' \
    -d "{\"args\":[\"$filepath\",\"blocks\"]}"
}

partition_file() {
  local filepath="$1"
  curl -s -X POST "http://localhost:$PORT/general/v0/general" \
    -H 'Content-Type: application/json' \
    -d "{\"args\":[\"$filepath\",\"auto\"]}"
}

count_blocks() {
  python3 -c "
import json, sys
r = json.loads(sys.stdin.read())
p = json.loads(r['result'])
print(len(p.get('blocks', [])))
" 2>/dev/null
}

count_elements() {
  python3 -c "
import json, sys
r = json.loads(sys.stdin.read())
p = json.loads(r['result'])
print(len(p))
" 2>/dev/null
}

trap stop_server EXIT
start_server

echo ""
echo "=== Custom Route Endpoints ==="

# Health
result=$(curl -s "http://localhost:$PORT/api/v1/health")
check "GET /api/v1/health" "$result" 'healthy'

# Formats
result=$(curl -s "http://localhost:$PORT/api/v1/formats")
check "GET /api/v1/formats" "$result" 'docx'

# OpenAPI spec
result=$(curl -s "http://localhost:$PORT/api/_meta/openapi.json" | head -c 200)
check "GET /api/_meta/openapi.json" "$result" '3.1.0'

# Swagger UI
status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/_meta/docs")
check "GET /api/_meta/docs (Swagger)" "$status" "200"

echo ""
echo "=== Native Parse API (/api/v1/parse) ==="

# Markdown
blocks=$(parse_file "data/test_files/test.md" | count_blocks)
check "Markdown (test.md)" "$blocks" "[0-9]"

# HTML
blocks=$(parse_file "data/test_files/test.html" | count_blocks)
check "HTML (test.html)" "$blocks blocks" "[0-9]"

# CSV
blocks=$(parse_file "data/test_files/test.csv" | count_blocks)
check "CSV (test.csv)" "$blocks blocks" "[0-9]"

# DOCX
blocks=$(parse_file "data/test_files/sample.docx" | count_blocks)
check "DOCX (sample.docx)" "$blocks blocks" "[0-9]"

# PPTX
blocks=$(parse_file "data/test_files/pandoc_basic.pptx" | count_blocks)
check "PPTX (pandoc_basic.pptx)" "$blocks blocks" "[0-9]"

# XLSX
blocks=$(parse_file "data/test_files/pandoc_basic.xlsx" | count_blocks)
check "XLSX (pandoc_basic.xlsx)" "$blocks blocks" "[0-9]"

# ODT
blocks=$(parse_file "data/test_files/test.odt" | count_blocks)
check "ODT (test.odt)" "$blocks blocks" "[0-9]"

# ODP
blocks=$(parse_file "data/test_files/test.odp" | count_blocks)
check "ODP (test.odp)" "$blocks blocks" "[0-9]"

# ODS
blocks=$(parse_file "data/test_files/test.ods" | count_blocks)
check "ODS (test.ods)" "$blocks blocks" "[0-9]"

# EPUB
blocks=$(parse_file "data/test_files/test.epub" | count_blocks)
check "EPUB (test.epub)" "$blocks blocks" "[0-9]"

# DOCX with comments
blocks=$(parse_file "data/test_files/comments.docx" | count_blocks)
check "DOCX comments (comments.docx)" "$blocks blocks" "[0-9]"

# DOCX with merged cells
blocks=$(parse_file "data/test_files/merged_cells.docx" | count_blocks)
check "DOCX merged (merged_cells.docx)" "$blocks blocks" "[0-9]"

echo ""
echo "=== Unstructured Compatibility (/general/v0/general) ==="

# DOCX via Unstructured endpoint
elements=$(partition_file "data/test_files/sample.docx" | count_elements)
check "Unstructured DOCX" "$elements elements" "[0-9]"

# Markdown via Unstructured endpoint
elements=$(partition_file "data/test_files/test.md" | count_elements)
check "Unstructured Markdown" "$elements elements" "[0-9]"

# CSV via Unstructured endpoint
elements=$(partition_file "data/test_files/test.csv" | count_elements)
check "Unstructured CSV" "$elements elements" "[0-9]"

# ODT via Unstructured endpoint
elements=$(partition_file "data/test_files/test.odt" | count_elements)
check "Unstructured ODT" "$elements elements" "[0-9]"

# Verify element types in Unstructured response
result=$(partition_file "data/test_files/sample.docx")
check "Unstructured has Title type" "$result" 'Title'
check "Unstructured has NarrativeText" "$result" 'NarrativeText'
check "Unstructured has element_id" "$result" 'element_id'
check "Unstructured has metadata" "$result" 'metadata'

echo ""
echo "=== PDF (AI required — verify graceful error) ==="
result=$(parse_file "data/test_files/simple_text.pdf" 2>&1)
check "PDF requires AI capability" "$result" "effect"

echo ""
echo "=== API Key Management (endpoints respond, Firestore errors expected locally) ==="

# Key endpoints need Firestore/metadata server — verify they respond (not hang)
# On Cloud Run these return actual results; locally they return JSON errors
result=$(curl -s --max-time 5 -X POST "http://localhost:$PORT/api/v1/keys/generate" \
  -H 'Content-Type: application/json' \
  -d '{"args":["test-user-123","my-test-key"]}')
check "POST /api/v1/keys/generate (responds)" "$result" 'api_keys'

result=$(curl -s --max-time 5 -X POST "http://localhost:$PORT/api/v1/keys/list" \
  -H 'Content-Type: application/json' \
  -d '{"args":["test-user-123"]}')
check "POST /api/v1/keys/list (responds)" "$result" 'api_keys'

result=$(curl -s --max-time 5 -X POST "http://localhost:$PORT/api/v1/keys/revoke" \
  -H 'Content-Type: application/json' \
  -d '{"args":["abc123456789","test-user-123"]}')
check "POST /api/v1/keys/revoke (responds)" "$result" 'api_keys'

result=$(curl -s --max-time 5 -X POST "http://localhost:$PORT/api/v1/keys/rotate" \
  -H 'Content-Type: application/json' \
  -d '{"args":["abc123456789","test-user-123"]}')
check "POST /api/v1/keys/rotate (responds)" "$result" 'api_keys'

result=$(curl -s --max-time 5 -X POST "http://localhost:$PORT/api/v1/keys/usage" \
  -H 'Content-Type: application/json' \
  -d '{"args":["abc123456789","test-user-123"]}')
check "POST /api/v1/keys/usage (responds)" "$result" 'api_keys'

echo ""
echo "=== API Meta ==="

# OpenAPI spec should include key management endpoints
curl -s --max-time 5 "http://localhost:$PORT/api/_meta/openapi.json" > /tmp/docparse_openapi.json
if grep -q 'keys/generate' /tmp/docparse_openapi.json 2>/dev/null; then
  printf "  ✓ %-40s\n" "OpenAPI has keys/generate"; PASS=$((PASS + 1))
else
  printf "  ✗ %-40s\n" "OpenAPI has keys/generate"; FAIL=$((FAIL + 1)); ERRORS="$ERRORS\n  - OpenAPI has keys/generate"
fi
if grep -q 'keys/rotate' /tmp/docparse_openapi.json 2>/dev/null; then
  printf "  ✓ %-40s\n" "OpenAPI has keys/rotate"; PASS=$((PASS + 1))
else
  printf "  ✗ %-40s\n" "OpenAPI has keys/rotate"; FAIL=$((FAIL + 1)); ERRORS="$ERRORS\n  - OpenAPI has keys/rotate"
fi

echo ""
echo "============================================"
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo -e "Failures:$ERRORS"
  echo "============================================"
  exit 1
else
  echo "All tests passed!"
  echo "============================================"
  exit 0
fi
