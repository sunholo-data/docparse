n# CLAUDE.md — DocParse

## Project Purpose

DocParse is a standalone AILANG module for universal document parsing and generation. It extracts structured content from Office formats (DOCX, PPTX, XLSX, ODT, ODP, ODS, HTML, Markdown, CSV, EPUB) deterministically and from PDFs/images via pluggable AI. It also generates documents in 9 formats (including Quarto Markdown) from parsed content or AI prompts.

This is a production AILANG module, not a demo. Every change must exercise AILANG code paths.

## Project Structure

```
docparse/
├── docparse/              # AILANG modules (keeps docparse/ prefix for imports)
│   ├── types/document.ail # Block ADT (9 variants)
│   ├── services/          # 23 service modules (parsers + generators)
│   └── main.ail           # CLI entry point
├── bin/docparse           # Bash CLI wrapper
├── data/test_files/       # 17 real-world test files
└── benchmarks/            # Benchmark infrastructure
```

## Quick Commands

```bash
# Parse a document
./bin/docparse data/test_files/sample.docx

# Convert between formats
./bin/docparse input.docx --convert output.html
./bin/docparse data.csv --convert report.docx
./bin/docparse notes.md --convert slides.pptx
./bin/docparse report.docx --convert report.qmd

# AI document generation (requires --ai flag and AI capability)
ailang run --entry main --caps IO,FS,Env,AI --ai gemini-2.5-flash \
  docparse/main.ail --generate report.docx --prompt "Q1 sales report with revenue table"

# Dev commands
./bin/docparse --check       # Type-check all modules
./bin/docparse --test        # Run inline tests
./bin/docparse --prove       # Z3 contract verification
bash benchmarks/quick_check.sh    # Quick smoke test (~15s)
bash .claude/skills/verify-docs/scripts/verify_only.sh  # Verify generated files
bash tests/test_serve_api.sh      # API server smoke test (32 tests)

# API Server (local)
ailang serve-api --caps IO,FS,Env,AI,Net,Rand,Clock \
  --ai gemini-2.5-flash --port 8080 docparse/

# API Server (Cloud Run — dev)
# URL: https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app
# Cold start: ~20s (31 modules), warm: 0-10ms
# CI/CD: pushes to main auto-build via Cloud Build (docparse-dev trigger)
# Firestore: docparse DB in ailang-multivac-dev
# SA: ailang-dev-docparse@ailang-multivac-dev.iam.gserviceaccount.com

# API endpoints:
#   GET  /api/v1/health              — health check
#   GET  /api/v1/formats             — supported formats
#   POST /api/v1/parse               — parse document (filepath)
#   POST /general/v0/general         — Unstructured API compat
#   POST /api/v1/keys/generate       — generate API key
#   POST /api/v1/keys/list           — list user's keys
#   POST /api/v1/keys/revoke         — revoke a key
#   POST /api/v1/keys/rotate         — rotate a key
#   POST /api/v1/keys/usage          — usage stats
#   GET  /api/_meta/docs             — Swagger UI
#   GET  /api/_meta/openapi.json     — OpenAPI 3.1.0 spec (156 paths)

# Direct ailang invocation (from repo root)
ailang run --entry main --caps IO,FS,Env docparse/main.ail data/test_files/sample.docx

# With AI (PDF/images)
GOOGLE_API_KEY="" ailang run --entry main --caps IO,FS,Env,AI \
  --ai gemini-3-flash-preview docparse/main.ail document.pdf
```

## Testing serve-api

CRITICAL: bash output redirection breaks Go HTTP servers. Follow these patterns exactly.

```bash
# CORRECT: server output to file with > 2>&1
ailang serve-api --caps IO,FS,Env --port 8080 docparse/ > /tmp/server.log 2>&1 &
SERVER_PID=$!
sleep 6

# CORRECT: concurrent requests with explicit PIDs
curl -s --max-time 5 http://localhost:8080/api/v1/health > /dev/null &
P1=$!
curl -s --max-time 5 http://localhost:8080/api/v1/health > /dev/null &
P2=$!
wait $P1 $P2

# WRONG: | tee breaks HTTP response flushing
ailang serve-api ... | tee /tmp/log &  # DO NOT USE

# WRONG: separate stderr redirect breaks responses
ailang serve-api ... 2>/tmp/err.log &  # DO NOT USE

# Debug concurrency issues:
DEBUG_CONCURRENCY=1 ailang serve-api ... > /tmp/debug.log 2>&1 &
# Then grep CONCURRENCY /tmp/debug.log after requests complete
```

Performance baselines (Apple M2):
- Sequential 5x DOCX: ~55ms (11ms each)
- Concurrent 5x DOCX: ~26ms (near-perfect scaling)
- Concurrent 10x mixed: ~32ms
- Cloud Run: concurrency=80 is safe

## AILANG Conventions

- `module` declarations use `docparse/` prefix (e.g., `module docparse/services/docx_parser`)
- Source must live under `docparse/` relative to working directory
- Type-check before committing: `ailang check docparse/`
- Use `ailang docs <module>` to check stdlib before assuming features are missing
- Set `GOOGLE_API_KEY=""` when using ADC for Vertex AI

## Key AILANG Rules

- `println` is prelude (no import needed) but may need `import std/io (println)` in non-entry modules
- String functions (`substring`, `endsWith`, `find`, `split`, `join`) must be imported from `std/string`
- Inside `{ }` blocks: use semicolons. With `=` bodies: use `in`
- HOFs are function-first, data-second: `map(f, xs)`, `flatMap(f, xs)`, `foldl(f, init, xs)`
- NON-HOFs are data-first: `nth(list, index)`, `concat(xs, ys)`
- `x == false` not `not x` in `ensures` clauses (contract verifier bug)

## Known Bugs

- **Module scoping**: Non-exported internal functions with same name + type across modules collide at runtime. Prefix all internal helpers with module name.
- **Test harness**: Inline `tests [...]` on functions calling stdlib fail with "cannot apply non-function value: nil". Test via `main()` instead.
- **Transitive imports**: Entry module must import all transitive dependencies.

## Contracts

28 contracts across modules: filter bounds, 1:1 mapper preservation, structural invariants, size preservation. Use `--verify` flag for runtime checking, `--prove` for static Z3 verification.

## Auth

| Provider | Auth |
|----------|------|
| Google (Vertex AI) | ADC: `GOOGLE_API_KEY="" ailang run ...` |
| Google (AI Studio) | `GOOGLE_API_KEY=xxx` env var |
| Anthropic | `ANTHROPIC_API_KEY=sk-ant-...` env var |

## Benchmarks

```bash
# Office structural benchmark (no API, instant — our moat)
uv run benchmarks/run_benchmarks.py --suite office

# PDF benchmark (needs AI backend)
uv run benchmarks/run_benchmarks.py --suite pdf --ai gemini-2.5-flash

# Competitor comparison (requires optional deps: uv pip install -e '.[competitors]')
uv run benchmarks/run_benchmarks.py --competitors              # all competitors
uv run benchmarks/run_benchmarks.py --competitors docling      # just Docling
uv run benchmarks/run_benchmarks.py --competitors llamaparse   # just LlamaParse

# Regenerate golden outputs after changing parser code
bash benchmarks/generate_golden.sh
```

### Benchmark Philosophy

Most external benchmarks (OmniDocBench, SCORE) are PDF-focused. DocParse won't beat specialized OCR on PDFs — and doesn't try. For PDFs, it delegates to whatever AI model the user plugs in (Gemini, Claude, local Ollama via AILANG's AI effect). The real differentiator is **deterministic structural Office parsing** (track changes, headers/footers, merged cells, text boxes, comments) that competitors miss entirely. DocParse is a pragmatic library.

### Office Structural Benchmark (implemented)

- 18 golden outputs in `benchmarks/office/golden/`
- Checks: tables, merged cells, track changes, comments, headers/footers, text boxes, images, metadata, text Jaccard
- Baseline: 100% across all 18 files
- Run after any parser change to catch regressions

### Still TODO

- **PDF benchmark** (`benchmarks/pdf/eval_pdf.py`): OmniDocBench subset, multi-model matrix (Gemini vs Ollama backends)
- **Competitor adapters** (`benchmarks/competitors/`): Docling (`run_docling.py`), LlamaParse (`run_llamaparse.py`). Unstructured adapter exists.
- **`docx-hdrftr.docx`**: Exhausts FS budget (limit=20) — needs budget increase or fewer ZIP reads

## Relationship to ailang-demos

This repo was extracted from `sunholo-data/ailang-demos` (`docparse/` directory). The demos repo retains a copy for the WASM browser demo. Changes should flow from this repo back to demos (this is the source of truth for parser code).

## AILANG AI Integration

AILANG's AI effect abstracts the model provider. Same code works with any backend:

```bash
./bin/docparse scan.pdf --ai gemini-3-flash-preview   # Google Cloud (ADC)
./bin/docparse scan.pdf --ai granite-docling           # Local Ollama (free)
./bin/docparse scan.pdf --ai claude-haiku-4-5          # Anthropic
```

Models are defined in AILANG's `models.yml`. Ollama models use `provider: "ollama"` — no API key needed, runs locally.

## AILANG Structured AI Output

- `std/ai` exports: `call`, `callJson`, `callJsonSimple`
- `callJsonSimple(prompt)` returns raw JSON string — use `decode()` to parse
- **BUG**: `callJson` with multimodal requests corrupts large responses. Use `callJsonSimple` for multimodal.
- **BUG**: `call()` truncates at ~491 chars. Always use `callJsonSimple` for generation.
- Prompt tip: ask for "compact JSON (no whitespace)" to reduce output tokens
