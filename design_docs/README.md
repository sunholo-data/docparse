# DocParse Design Documentation

## Structure

```
design_docs/
├── implemented/              # Features that have been built
│   ├── v0_1_0/              # Initial release (March 2026)
│   ├── v0_3_0/              # Parser coverage & format expansion
│   ├── v0_6_0/              # Document generation (8 formats)
│   └── v0_7_0/              # API server & Unstructured compat
├── planned/                  # Future features and designs
│   ├── v0_2_0/              # PDF pipeline improvements
│   ├── v0_4_0/              # Go binary compilation
│   ├── v0_5_0/              # Ecosystem & competitor benchmarks
│   ├── v0_8_0/              # API keys & Cloud deployment
│   ├── v0_11_0/             # User-defined structured extraction
│   └── v0_12_0/             # AILANG package registry integration
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

### v0.4.0 — Go Binary `BLOCKED ON 3 CODEGEN BUGS`
- All 19 modules compile to Go (406 declarations, 16K lines)
- `go build` fails on: function name collisions, constant redeclaration, markdown codegen
- Effect handler interfaces are clean — harness is ~200 lines (same pattern as stapledon's_voyage)
- `--with-default-handlers` is nice-to-have, NOT a blocker
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

### v0.6.0 — Document Generation `DONE`
- Block ADT → file output for all 8 formats (HTML, DOCX, PPTX, XLSX, ODT, ODP, ODS, Markdown)
- AI-assisted generation: `--generate output.docx --prompt "Q1 sales report"`
- Cross-format conversion via `--convert` flag
- All roundtrips verified, generated files recognized by Office apps
- [Design Doc](implemented/v0_6_0/v0_6_0_document_generation.md)
- [Features](implemented/v0_6_0/features.md)
- [Verification Loop](implemented/v0_6_0/verification_loop.md)

### v0.7.0 — API Server & Unstructured Compatibility `DONE`
- REST API via `ailang serve-api` with custom `@route` annotations
- Unstructured API drop-in compatibility (`POST /general/v0/general`)
- Auto-generated OpenAPI spec + Swagger UI
- 25 smoke tests, all passing
- Concurrency confirmed working (Cloud Run `concurrency=80` safe)
- [Design Doc](implemented/v0_7_0/v0_7_0_api_server.md)

### v0.8.0 — Per-User API Keys & Cloud Deployment `IN PROGRESS`
- Self-service API key management via static website dashboard
- Two-layer enforcement: AILANG capability budgets (per-request) + Firestore quotas (cumulative)
- Free/Pro/Enterprise tiers with upgrade path
- Terraform in ailang-multivac: Cloud Run, Firestore, Firebase Auth, IAM
- CI/CD trigger for docparse repo pushes
- [Design Doc](planned/v0_8_0/v0_8_0_api_keys_cloud_deployment.md)

### v0.9.0 — SDKs & Website `PLANNED`
- Python, JavaScript/TypeScript, Go client SDKs
- Static website with dashboard
- [SDKs Design](planned/v0_9_0/v0_9_0_sdks.md)
- [Website Design](planned/v0_9_0/v0_9_0_website.md)

### v0.10.0 — Quarto Integration `PLANNED`
- QMD generator: Block ADT → Quarto Markdown with YAML front matter
- Two rendering engines: AILANG (fast/lightweight) vs Quarto (publication-quality)
- CLI: `--convert output.qmd` and `--via quarto` flag
- API: QMD output endpoint + optional server-side Quarto rendering
- Workflows: Office → PDF, spreadsheet → report, multi-doc book assembly
- [Design Doc](planned/v0_10_0/v0_10_0_quarto_integration.md)

### v0.11.0 — User-Defined Structured Extraction `PLANNED`
- Users supply a JSON Schema describing what they want extracted
- Two-stage pipeline: deterministic parse → AI-powered schema extraction
- Built-in template library (invoice, resume, contract, receipt, form, meeting notes, table)
- CLI: `--extract --schema`, `--template invoice`, `--hints "..."`
- API: `POST /api/v1/extract` + template endpoint + batch extraction
- Competitive moat: JSON Schema (not NL), two-stage (cheaper/more accurate), Office advantage
- [Design Doc](planned/v0_11_0/v0_11_0_structured_extraction.md)

### v0.12.0 — AILANG Package Registry `PLANNED`
- Publish DocParse as a versioned AILANG package via the new registry
- `ailang.pkg` manifest with capability declarations, exports, and metadata
- Public vs internal module boundary (24 exported, 7 internal)
- Migrate `xml_helpers` to use `std/xml` directly (stop wrapping stdlib), rename remainder to `docx_xml_helpers`
- Extract reusable utilities into standalone packages:
  - `ailang-office-zip` — generic ZIP read/list, MIME detection (used by 5 modules)
  - `ailang-doc-eval` — Jaccard similarity, structural scoring (extract when second consumer appears)
- CI/CD publish workflow: type-check → test → benchmark → `ailang pkg publish`
- Consumers install with `ailang pkg add docparse` and import modules directly
- Lock file (`ailang.lock`) for reproducible builds
- [Design Doc](planned/v0_12_0/v0_12_0_package_registry.md)

## Guidelines

1. **Before Implementation**: Create design doc in `planned/vX_Y_Z/`
2. **After Implementation**: Move to `implemented/vX_Y_Z/` with report
3. **Version Numbering**: Semantic versioning, underscores in folder names (`v0_1_0`)
4. **Always Update**: This README when features ship or plans change
5. **Archiving**: Move superseded docs to `archive/`
