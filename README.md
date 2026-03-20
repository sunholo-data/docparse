# DocParse

Universal document parsing in [AILANG](https://github.com/sunholo-data/ailang). Extracts structured content from DOCX, PPTX, XLSX, PDF, and image files into JSON and markdown.

**Office formats** (DOCX, PPTX, XLSX) use deterministic XML parsing — no AI, no cloud, instant results. **PDFs and images** delegate to whatever AI model you plug in (Gemini, Claude, local Ollama). DocParse is AI-agnostic: swap `--ai` to change the backend, zero code changes.

## Install

Requires [AILANG](https://github.com/sunholo-data/ailang) CLI.

```bash
# Clone and symlink
git clone https://github.com/sunholo-data/docparse.git
ln -s "$(pwd)/docparse/bin/docparse" /usr/local/bin/docparse
```

## Quick Start

```bash
# Office documents (deterministic, no AI needed)
docparse report.docx
docparse slides.pptx
docparse spreadsheet.xlsx

# PDF and images (AI auto-enabled)
docparse document.pdf
docparse photo.png

# Options
docparse report.docx --describe       # AI image descriptions
docparse report.docx --summarize      # AI document summary
docparse report.docx --verify         # Runtime contract verification
docparse scan.pdf --ai gemini-3-flash-preview  # Choose AI backend
```

## Output

Every run produces:
- `docparse/data/output.json` — Structured JSON with typed blocks
- `docparse/data/output.md` — LLM-ready markdown

```bash
docparse report.docx --output-dir /tmp/parsed  # Copy output to custom dir
```

## What DocParse Extracts

| Feature | DOCX | PPTX | XLSX | Competitors |
|---------|------|------|------|-------------|
| Tables with merged cells | Yes | Yes | Yes | Buggy or missing |
| Track changes (redlining) | Yes | — | — | No |
| Comments (interleaved) | Yes | — | — | No |
| Headers/footers | Yes | — | — | Limited |
| Text boxes / VML shapes | Yes | Yes | — | Dropped silently |
| Speaker notes | — | Yes | — | Dropped |
| Multi-sheet extraction | — | — | Yes | Yes |

Competitors (Unstructured, Docling, LlamaParse) either convert Office files to PDF first (losing structure) or use heuristics. DocParse reads the XML directly.

## Architecture

```
docparse/
├── types/document.ail           # Block ADT (9 variants)
├── services/
│   ├── format_router.ail        # Format detection (36 inline tests)
│   ├── zip_extract.ail          # ZIP layer (9 inline tests)
│   ├── docx_parser.ail          # DOCX XML → Blocks (6 inline tests)
│   ├── pptx_parser.ail          # PPTX slides → Blocks
│   ├── xlsx_parser.ail          # XLSX worksheets → Blocks
│   ├── direct_ai_parser.ail     # PDF/image → Blocks (AI)
│   ├── layout_ai.ail            # AI self-healing (optional)
│   ├── output_formatter.ail     # JSON + markdown output
│   └── docparse_browser.ail     # WASM browser adapter
└── main.ail                     # CLI entry point
```

10 modules, 28 contracts, ~3,600 lines of AILANG. 51 inline tests.

## AI Configuration

DocParse uses AILANG's AI effect — any model AILANG supports works:

```bash
docparse scan.pdf --ai gemini-3-flash-preview   # Google Cloud (ADC)
docparse scan.pdf --ai granite-docling           # Local Ollama (free)
docparse scan.pdf --ai claude-haiku-4-5          # Anthropic
```

AI usage is bounded by capability budgets (`AI @limit=20`), so costs are predictable.

## Dev Commands

```bash
docparse --check       # Type-check all 10 modules
docparse --test        # Run 51 inline tests
docparse --prove       # Static Z3 contract verification
```

## Benchmarks

```bash
python benchmarks/run_benchmarks.py --suite office     # Structural (no API, instant)
python benchmarks/run_benchmarks.py --suite pdf         # PDF extraction (needs AI)
python benchmarks/run_benchmarks.py --competitors       # Compare to Docling etc.
```

See [benchmarks/](benchmarks/) for details.

## License

Apache 2.0
