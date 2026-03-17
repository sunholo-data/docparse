# DocParse Design Documentation

## Structure

```
design_docs/
├── implemented/              # Features that have been built
│   ├── v0_1_0/              # Initial release (March 2026)
│   └── v0_3_0/              # Parser coverage & format expansion
├── planned/                  # Future features and designs
│   ├── v0_2_0/              # PDF pipeline improvements
│   ├── v0_4_0/              # Go binary compilation
│   ├── v0_5_0/              # Ecosystem & competitor benchmarks
│   └── v0_6_0/              # Document generation (Block ADT → files)
├── archive/                  # Obsolete/superseded designs
└── README.md                 # This file
```

> **Note**: No GitHub releases or git tags exist yet. Version numbers below are
> design milestones, not published releases. Everything is on `main`.

## Document Organization

### Implemented Features
When a feature is completed, its design doc moves to `implemented/` with:
- **Version number folder** (e.g., `v0_1_0/`) — use underscores
- Implementation report with what was built
- Benchmark results and coverage metrics
- Known limitations

### Planned Features
Active design documents for features not yet built:
- Feature specifications
- Architecture proposals
- Benchmark improvement plans

### Archive
Old designs that have been superseded or abandoned.

## Roadmap

### v0.1.0 — Initial Release (March 2026) `DONE`
- Deterministic Office parsing (DOCX, PPTX, XLSX)
- AI-powered PDF extraction via pluggable models
- 18 golden benchmarks at 100% baseline
- Comment extraction, track changes, headers/footers
- PDF benchmark infrastructure with multi-model support
- Competitor adapter framework (Docling, LlamaParse, Unstructured)
- [Implementation Report](implemented/v0_1_0/v0_1_0_implementation_report.md)

### v0.2.0 — PDF Pipeline Improvements `PLANNED`
- Two-stage PDF pipeline (OCR → heuristic structuring) for Ollama models
- Expand PDF test corpus from 3 to 10+ diverse documents
- Multi-model benchmark matrix (`--matrix` flag)
- Target: local Ollama models score >50% on PDF benchmark
- [Design Doc](planned/v0_2_0/v0_2_0_pdf_pipeline.md)
- [Ollama Prompting Design](planned/v0_2_0/ollama_model_aware_prompting.md)

### v0.3.0 — Parser Coverage & Format Expansion `DONE`
- 10 format parsers: DOCX, PPTX, XLSX, CSV, TSV, Markdown, HTML, EPUB, ODT, ODP, ODS
- All parsers implemented in pure AILANG (zero runtime dependencies)
- 53 golden benchmark files at 100% baseline (expanded from 18)
- AILANG eval module (eval.ail) — 8 structural checks with contracts
- ODT/ODP/ODS native parsing — strategic gap, nobody else does this
- [Format Expansion](implemented/v0_3_0/format_expansion.md)
- [Parser Coverage](implemented/v0_3_0/v0_3_0_parser_coverage.md)
- [AILANG Benchmark Eval](implemented/v0_3_0/ailang_benchmark_eval.md)

### v0.4.0 — Go Binary `BLOCKED`
- Compile to native Go binary via `ailang compile --emit-go`
- Blocked on AILANG shipping `--with-default-handlers` (auto-generates effect handlers)
- Target: 10-100x faster parsing, single binary distribution
- [Design Doc](planned/v0_4_0/v0_4_0_go_binary.md)

### v0.5.0 — Ecosystem & Competitor Benchmarks `PARTIAL`
- OmniDocBench integration done (Text ED 0.183, Table TEDS 0.871, Gemini 2.5 Flash)
- Competitor adapters written (Docling, LlamaParse, Unstructured)
- Python SDK wrapper deferred (depends on v0.4.0 Go binary)
- Integration guides deferred (LangChain, LlamaIndex, Haystack)
- OfficeDocBench formalization still TODO (first-of-its-kind Office structural benchmark)
- [Design Doc](planned/v0_5_0/v0_5_0_ecosystem.md)
- [External Benchmarks](planned/v0_5_0/external_benchmarks.md)

### v0.6.0 — Document Generation `UNBLOCKED`
- Block ADT → file output (reverse of parsing)
- 7 phases: Markdown → HTML → DOCX → PPTX → XLSX → ODF → AI-assisted
- AILANG blockers resolved: `std/zip.createArchive` + `std/xml.serialize` now shipped
- Phase 1 (Markdown roundtrip) and Phase 2 (HTML generation) ready to start
- [Design Doc](planned/v0_6_0/v0_6_0_document_generation.md)

## Guidelines

1. **Before Implementation**: Create design doc in `planned/vX_Y_Z/`
2. **After Implementation**: Move to `implemented/vX_Y_Z/` with report
3. **Version Numbering**: Semantic versioning, underscores in folder names (`v0_1_0`)
4. **Always Update**: This README when features ship or plans change
5. **Archiving**: Move superseded docs to `archive/`
