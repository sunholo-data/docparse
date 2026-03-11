#!/usr/bin/env bash
set -euo pipefail

# Generate golden expected outputs for the Office structural benchmark.
# Runs DocParse on each test file and saves output.json to benchmarks/office/golden/<filename>.json

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
GOLDEN_DIR="$SCRIPT_DIR/office/golden"
TEST_DIR="$REPO_DIR/data/test_files"
OUTPUT_JSON="$REPO_DIR/docparse/data/output.json"

mkdir -p "$GOLDEN_DIR"

cd "$REPO_DIR"

PASS=0
FAIL=0

for f in "$TEST_DIR"/*.docx "$TEST_DIR"/*.pptx "$TEST_DIR"/*.xlsx; do
  [ -f "$f" ] || continue
  fname="$(basename "$f")"
  echo -n "  $fname ... "

  if ailang run --entry main --caps IO,FS,Env docparse/main.ail "$f" > /dev/null 2>&1; then
    if [ -f "$OUTPUT_JSON" ]; then
      cp "$OUTPUT_JSON" "$GOLDEN_DIR/${fname}.json"
      echo "OK"
      PASS=$((PASS + 1))
    else
      echo "FAIL (no output.json)"
      FAIL=$((FAIL + 1))
    fi
  else
    echo "FAIL (parse error)"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "Generated $PASS golden outputs ($FAIL failures) in $GOLDEN_DIR/"
