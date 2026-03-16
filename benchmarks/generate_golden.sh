#!/usr/bin/env bash
set -euo pipefail

# Generate golden expected outputs for the Office structural benchmark.
# Runs DocParse on each test file and saves output.json to benchmarks/office/golden/<filename>.json

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
GOLDEN_DIR="$SCRIPT_DIR/office/golden"
TEST_DIR="$REPO_DIR/data/test_files"
OUTPUT_DIR="$REPO_DIR/docparse/data"

TIMEOUT=${TIMEOUT:-120}  # Per-file timeout in seconds (override with TIMEOUT=180)

mkdir -p "$GOLDEN_DIR"

cd "$REPO_DIR"

PASS=0
FAIL=0

# run_with_timeout CMD... — runs command with $TIMEOUT second limit (portable macOS/Linux)
run_with_timeout() {
  "$@" &
  local pid=$!
  (sleep "$TIMEOUT" && kill "$pid" 2>/dev/null) &
  local watchdog=$!
  wait "$pid" 2>/dev/null
  local rc=$?
  kill "$watchdog" 2>/dev/null
  wait "$watchdog" 2>/dev/null
  return $rc
}

for f in "$TEST_DIR"/*.docx "$TEST_DIR"/*.pptx "$TEST_DIR"/*.xlsx \
         "$TEST_DIR"/*.odt "$TEST_DIR"/*.odp "$TEST_DIR"/*.ods \
         "$TEST_DIR"/*.epub "$TEST_DIR"/*.html "$TEST_DIR"/*.csv "$TEST_DIR"/*.tsv "$TEST_DIR"/*.md; do
  [ -f "$f" ] || continue
  fname="$(basename "$f")"

  echo -n "  $fname ... "

  if run_with_timeout ailang run --entry main --caps IO,FS,Env --max-recursion-depth 50000 docparse/main.ail "$f" > /dev/null 2>&1; then
    local output_json="$OUTPUT_DIR/${fname}.json"
    if [ -f "$output_json" ]; then
      cp "$output_json" "$GOLDEN_DIR/${fname}.json"
      echo "OK"
      PASS=$((PASS + 1))
    else
      echo "FAIL (no output.json)"
      FAIL=$((FAIL + 1))
    fi
  else
    echo "FAIL (parse error or timeout)"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "Generated $PASS golden outputs ($FAIL failures) in $GOLDEN_DIR/"
