# CLAUDE.md — DocParse

## Project Purpose

DocParse is a standalone AILANG module for universal document parsing. It extracts structured content from Office formats (DOCX, PPTX, XLSX) deterministically and from PDFs/images via pluggable AI.

This is a production AILANG module, not a demo. Every change must exercise AILANG code paths.

## Project Structure

```
docparse/
├── docparse/              # AILANG modules (keeps docparse/ prefix for imports)
│   ├── types/document.ail # Block ADT (9 variants)
│   ├── services/          # 9 service modules
│   └── main.ail           # CLI entry point
├── bin/docparse           # Bash CLI wrapper
├── data/test_files/       # 17 real-world test files
└── benchmarks/            # Benchmark infrastructure
```

## Quick Commands

```bash
# Parse a document
./bin/docparse data/test_files/sample.docx

# Dev commands
./bin/docparse --check       # Type-check all 10 modules
./bin/docparse --test        # Run inline tests
./bin/docparse --prove       # Z3 contract verification

# Direct ailang invocation (from repo root)
ailang run --entry main --caps IO,FS,Env docparse/main.ail data/test_files/sample.docx

# With AI (PDF/images)
GOOGLE_API_KEY="" ailang run --entry main --caps IO,FS,Env,AI \
  --ai gemini-3-flash-preview docparse/main.ail document.pdf
```

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
python benchmarks/run_benchmarks.py --suite office

# PDF benchmark (needs AI backend)
python benchmarks/run_benchmarks.py --suite pdf --ai gemini

# Competitor comparison
python benchmarks/run_benchmarks.py --competitors
```
