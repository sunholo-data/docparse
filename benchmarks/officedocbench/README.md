# OfficeDocBench

**The first benchmark for Office structural document parsing.**

Every existing document parsing benchmark (OmniDocBench, READOC, SCORE-Bench, DP-Bench) evaluates PDF extraction only. No benchmark measures whether a parser can extract **structural Office features**: track changes, comments, merged cells, headers/footers, text boxes, speaker notes, footnotes, or document metadata from DOCX, PPTX, XLSX, ODT, ODP, and ODS files.

OfficeDocBench fills this gap.

## Dataset

**59 test files** across **10 formats**, sourced from real-world test suites (54 core + 5 challenge):

| Format | Files | Sources |
|--------|-------|---------|
| DOCX   | 19    | Pandoc, Apache POI, original, challenge |
| PPTX   | 8     | Pandoc, Apache POI, python-pptx, Unstructured, challenge |
| XLSX   | 6     | Pandoc, Apache POI, XlsxWriter, Unstructured, challenge |
| ODT    | 6     | LibreOffice, OfficeParser, original |
| ODP    | 2     | OfficeParser, original |
| ODS    | 4     | LibreOffice, OfficeParser, original |
| EPUB   | 3     | Project Gutenberg, original |
| HTML   | 5     | Pandoc, original, challenge |
| CSV    | 2     | Original |
| MD     | 3     | Pandoc, original |

### Feature Distribution

| Feature | Files with feature present |
|---------|---------------------------|
| Tables | 34 |
| Headings | 17 |
| Lists | 12 |
| Images | 8 |
| Sheets | 4 |
| Track changes | 3 |
| Headers/footers | 3 |
| Text boxes | 2 |
| Comments | 1 |

## Evaluation Protocol

### Ground Truth

Each test file has a parser-independent ground truth annotation (`ground_truth/*.json`) documenting which structural features are present and their expected values. Ground truth was auto-generated from validated golden outputs and follows `schema/ground_truth.schema.json`.

Features use `null` for "not applicable to this format" and `{"present": false}` for "applicable but absent in this file".

### Adapter Interface

Parsers implement the `OfficeDocBenchAdapter` interface:

```python
from adapters.base_adapter import OfficeDocBenchAdapter

class MyParserAdapter(OfficeDocBenchAdapter):
    def name(self) -> str: ...
    def version(self) -> str: ...
    def parse(self, filepath: Path) -> dict: ...
    def supported_formats(self) -> set[str]: ...
```

The `parse()` method returns a dict matching `schema/adapter_output.schema.json` — a flat structure with lists for each feature type (headings, tables, track_changes, comments, etc.).

### Metrics

Five scoring dimensions, each in [0, 1]:

| Metric | Weight | Description |
|--------|--------|-------------|
| **Feature Detection** | 0.25 | Binary: did the parser detect each present feature? |
| **Structural Recall** | 0.30 | How completely were features extracted? (count accuracy + type matching) |
| **Text Jaccard** | 0.20 | Word-level Jaccard similarity with ground truth |
| **Element Count** | 0.15 | `1 - |actual - expected| / max(actual, expected, 1)` per element type |
| **Metadata** | 0.10 | Exact match on title, author, created, modified |

**Composite score** = weighted average. Weights emphasize structural extraction (Feature Detection + Structural Recall = 55%) since that is the benchmark's purpose.

## Usage

```bash
# Evaluate DocParse (uses golden outputs, instant)
uv run benchmarks/officedocbench/eval_officedocbench.py

# Evaluate DocParse (re-parse files)
uv run benchmarks/officedocbench/eval_officedocbench.py --live

# Evaluate all installed adapters
uv run benchmarks/officedocbench/eval_officedocbench.py --all

# Single adapter
uv run benchmarks/officedocbench/eval_officedocbench.py --adapter unstructured

# Filter by format
uv run benchmarks/officedocbench/eval_officedocbench.py --format docx

# Output formats
uv run benchmarks/officedocbench/eval_officedocbench.py --json
uv run benchmarks/officedocbench/eval_officedocbench.py --latex

# Regenerate ground truth from golden files
uv run benchmarks/officedocbench/annotate.py
```

## Baseline Results

DocParse v0.3.0 (deterministic AILANG parsers, no AI), 59 files:

| Metric | Score |
|--------|-------|
| **Composite** | **96.6%** |
| Feature Detection | 94.9% |
| Structural Recall | 97.5% |
| Text Jaccard | 95.0% |
| Element Count | 98.3% |
| Metadata | 98.3% |

Per-format: DOCX 98.2%, PPTX 97.2%, XLSX 95.8%, ODT 96.7%, ODP 100%, ODS 100%, EPUB 100%, HTML 80.0%, CSV 100%, MD 100%.

### Known Gaps (Stretch Goals)

| Gap | Impact | Feature |
|-----|--------|---------|
| PPTX speaker notes not extracted | 0/1 | speaker_notes |
| DOCX footnote/endnote content not extracted | 0/1 | footnotes_endnotes |
| XLSX formula cells return empty | tables accuracy | element_count |
| XLSX sheet names not in section kind | 4/5 sheets | sheets |
| Nested DOCX lists parsed as flat text, not List blocks | 12/14 lists | lists |
| HTML `<figure>` / `<img>` not extracted | 8/9 images | images |
| HTML `<ol>`/`<ul>` nesting not preserved | lists | lists |

## Adding Your Tool

1. Create `adapters/your_parser_adapter.py` implementing `OfficeDocBenchAdapter`
2. Add a loader in `eval_officedocbench.py:load_adapter()`
3. Run: `uv run benchmarks/officedocbench/eval_officedocbench.py --adapter your_parser`

See `adapters/unstructured_adapter.py` for a minimal example.

## File Structure

```
benchmarks/officedocbench/
  README.md                      # This file
  schema/
    ground_truth.schema.json     # Ground truth format spec
    adapter_output.schema.json   # Adapter output format spec
  ground_truth/                  # 54 annotated ground truth files
  adapters/
    base_adapter.py              # Abstract interface
    docparse_adapter.py          # Reference implementation
    unstructured_adapter.py      # Unstructured.io
    docling_adapter.py           # IBM Docling
    llamaparse_adapter.py        # LlamaIndex LlamaParse
  eval_officedocbench.py         # Main evaluation script
  scoring.py                     # Per-feature scoring
  report.py                      # Report generation
  annotate.py                    # Ground truth generator
  results/                       # Per-tool results
```

## License

- Benchmark data and ground truth: CC-BY-4.0
- Evaluation code: Apache-2.0
- Test files: see `benchmarks/SOURCES.md` for per-file attribution

## Citation

```bibtex
@misc{officedocbench2026,
  title={OfficeDocBench: A Benchmark for Office Structural Document Parsing},
  author={DocParse Contributors},
  year={2026},
  url={https://github.com/sunholo-data/docparse}
}
```
