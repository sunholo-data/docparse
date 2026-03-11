# DocParse Design Documentation

## Structure

```
design_docs/
├── implemented/              # Features that have been built
│   └── v0_1_0/              # Initial release (March 2026)
├── planned/                  # Future features and designs
│   ├── v0_2_0/              # PDF pipeline improvements
│   ├── v0_3_0/              # Parser coverage expansion
│   ├── v0_4_0/              # Go binary compilation
│   └── v0_5_0/              # Ecosystem & competitor benchmarks
├── archive/                  # Obsolete/superseded designs
└── README.md                 # This file
```

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

### v0.1.0 — Initial Release (March 2026) `CURRENT`
- Deterministic Office parsing (DOCX, PPTX, XLSX)
- AI-powered PDF extraction via pluggable models
- 18 golden benchmarks at 100% baseline
- Comment extraction, track changes, headers/footers
- PDF benchmark infrastructure with multi-model support
- Competitor adapter framework (Docling, LlamaParse, Unstructured)
- [Implementation Report](implemented/v0_1_0/v0_1_0_implementation_report.md)

### v0.2.0 — PDF Pipeline Improvements `NEXT`
- Two-stage PDF pipeline (OCR → heuristic structuring) for Ollama models
- Expand PDF test corpus from 3 to 10+ diverse documents
- Multi-model benchmark matrix (`--matrix` flag)
- Target: local Ollama models score >50% on PDF benchmark
- [Design Doc](planned/v0_2_0/v0_2_0_pdf_pipeline.md)
- [Ollama Prompting Design](planned/v0_2_0/ollama_model_aware_prompting.md)

### v0.3.0 — Parser Coverage & Format Expansion
- PPTX speaker notes extraction
- Real footnote/endnote test content
- Insert/delete track changes test coverage
- Nested list support
- Metadata completeness (page count, custom properties)
- XLSX chart detection
- **New AILANG parsers**: CSV, Markdown, HTML (zero Python dependencies)
- **Expanded benchmark corpus**: 40+ files from open-source test suites
- **Benchmark eval migration**: Move Python eval logic to AILANG
- Target: 40+ golden benchmark files across 6+ formats
- [Parser Coverage](planned/v0_3_0/v0_3_0_parser_coverage.md)
- [Format Expansion](planned/v0_3_0/format_expansion.md)
- [AILANG Benchmark Eval](planned/v0_3_0/ailang_benchmark_eval.md)

### v0.4.0 — Go Binary & Strategic Formats
- Compile to native Go binary via `ailang compile --emit-go`
- Implement effect handlers in Go (IO, FS, AI, Env)
- Replace bash wrapper with compiled binary
- **AILANG parsers for ODT/ODP/ODS** (OpenDocument — strategic gap, nobody does this natively)
- **EPUB parser** (ZIP+XHTML, reuses html_parser + zip_extract)
- **RTF parser** (token-based, medium complexity)
- Target: 10-100x faster Office parsing, single binary distribution, 9+ format support
- [Design Doc](planned/v0_4_0/v0_4_0_go_binary.md)

### v0.5.0 — Ecosystem & Competitor Benchmarks
- Published competitor benchmark report (Docling, LlamaParse, Unstructured)
- OmniDocBench subset integration
- Python SDK wrapper for Go binary
- Integration guides (LangChain, LlamaIndex, Haystack)
- WASM browser demo updates
- [Design Doc](planned/v0_5_0/v0_5_0_ecosystem.md)

## Guidelines

1. **Before Implementation**: Create design doc in `planned/vX_Y_Z/`
2. **After Implementation**: Move to `implemented/vX_Y_Z/` with report
3. **Version Numbering**: Semantic versioning, underscores in folder names (`v0_1_0`)
4. **Always Update**: This README when features ship or plans change
5. **Archiving**: Move superseded docs to `archive/`
