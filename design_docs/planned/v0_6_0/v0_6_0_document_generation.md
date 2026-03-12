# DocParse v0.6.0 — Document Generation (Block ADT → Files)

**Status**: Planned (blocked on AILANG stdlib for Office/ODF formats)
**Theme**: Bidirectional document pipeline — parse AND generate Office/ODF/HTML from Block ADT

## Motivation

DocParse extracts structured content from documents into a universal Block ADT. The natural extension is the reverse: generating documents FROM blocks. This enables:

1. **Format conversion**: DOCX → PPTX, XLSX → ODS, ODT → DOCX (parse one, generate another)
2. **AI document generation**: prompt → AI → Block ADT → real Office file (not just markdown)
3. **Roundtrip editing**: parse → programmatic transform → regenerate
4. **Template filling**: parse a template DOCX, replace blocks, regenerate

No tool does this natively without heavy library dependencies (python-docx, openpyxl, Apache POI). A single AILANG binary that both parses AND generates would be unique.

## Prerequisites (AILANG stdlib)

Two feature requests sent to AILANG team (2026-03-12):

| Feature | Status | Required For |
|---------|--------|-------------|
| `std/zip` write: `createArchive`, `writeEntry`, `closeArchive` | Requested | DOCX, PPTX, XLSX, ODT, ODS, ODP, EPUB |
| `std/xml` serialize: `element`, `textNode`, `serialize` | Requested | All XML-based formats |

**Cannot proceed with Office/ODF formats until both ship.** Markdown and HTML generation can start immediately (pure string output).

## Architecture

```
docparse/
├── services/
│   ├── docx_parser.ail          # DOCX → [Block]  (exists)
│   ├── docx_generator.ail       # [Block] → DOCX  (new)
│   ├── pptx_parser.ail          # PPTX → [Block]  (exists)
│   ├── pptx_generator.ail       # [Block] → PPTX  (new)
│   ├── xlsx_parser.ail          # XLSX → [Block]  (exists)
│   ├── xlsx_generator.ail       # [Block] → XLSX  (new)
│   ├── html_parser.ail          # HTML → [Block]  (exists)
│   ├── html_generator.ail       # [Block] → HTML  (new, no stdlib blocker)
│   ├── odt_generator.ail        # [Block] → ODT   (new)
│   ├── ods_generator.ail        # [Block] → ODS   (new)
│   ├── odp_generator.ail        # [Block] → ODP   (new)
│   ├── ai_generator.ail         # prompt → [Block] → file (new, uses AI effect)
│   ├── output_formatter.ail     # [Block] → JSON/Markdown (exists)
│   └── format_router.ail        # Route by extension (extend for --output-format)
├── types/
│   └── document.ail             # Block ADT (exists, may need style extensions)
└── main.ail                     # CLI: add --convert/--generate flags
```

### Data Flow

```
                    ┌─────────────┐
  input.docx ──→   │  Parser     │ ──→ [Block] ──→ JSON / Markdown
                    └─────────────┘        │
                                           ▼
                    ┌─────────────┐
                    │  Generator  │ ──→ output.pptx
                    └─────────────┘

  "Q1 report" ──→  │  AI Effect  │ ──→ [Block] ──→ Generator ──→ output.docx
```

### CLI Interface

```bash
# Parse (existing)
./bin/docparse input.docx

# Convert format (new)
./bin/docparse input.docx --convert output.pptx

# Generate from JSON (new)
./bin/docparse --generate output.docx --from blocks.json

# AI-generated document (new)
./bin/docparse --generate report.docx --prompt "Quarterly sales report with 3 tables"
./bin/docparse --generate slides.pptx --prompt "5-slide pitch deck" --ai gemini-2.5-flash
```

## Implementation Phases

### Phase 1: Markdown Roundtrip (no blockers — proves concept)

We already have `markdown_parser.ail` (Markdown → [Block]) and `renderMarkdown` in `output_formatter.ail` ([Block] → Markdown string). The roundtrip test is:

```
markdown file → markdown_parser → [Block] → renderMarkdown → markdown string
```

**What's needed**:
- Verify `renderMarkdown` output is valid input for `markdown_parser`
- Add roundtrip contract: `parse(render(parse(input)))` ≈ `parse(input)` (idempotent after first pass)
- Fix any gaps where renderMarkdown produces markdown that markdown_parser can't re-parse
- Add `--convert output.md` CLI path to main.ail

**Effort**: Small — mostly testing and contract work.
**Value**: Proves the roundtrip architecture before tackling binary formats.

### Phase 2: HTML Generator (no stdlib blockers)

Generate HTML from Block ADT using pure string concatenation (same approach as `renderMarkdown`).

```
[Block] → html_generator.ail → string → writeFile("output.html")
```

- HeadingBlock → `<h1>`...`<h6>`
- TextBlock → `<p>` with style class
- TableBlock → `<table>` with `colspan`/`rowspan` for merged cells
- ListBlock → `<ol>`/`<ul>` with `<li>` items
- ImageBlock → `<img src="data:mime;base64,...">` or `<img src="file.png">`
- SectionBlock → `<section class="kind">` with nested blocks
- ChangeBlock → `<ins>`/`<del>` with `<span>` attribution

Roundtrip: `html_parser.ail` already exists, so we get HTML → Block → HTML roundtrip for free.

**Effort**: Small. Reuses `renderMarkdown` pattern.
**Value**: HTML is universally viewable + roundtrip testable with existing html_parser.

### Phase 3: DOCX Generator (needs std/zip + std/xml)

Generate minimal valid DOCX. Office Open XML requires these ZIP entries:

| Entry | Purpose | Complexity |
|-------|---------|-----------|
| `[Content_Types].xml` | MIME type registry | Static template |
| `_rels/.rels` | Root relationships | Static template |
| `word/_rels/document.xml.rels` | Document relationships | Dynamic (images) |
| `word/document.xml` | Main content | Dynamic (all blocks) |
| `word/styles.xml` | Style definitions | Minimal template |
| `word/comments.xml` | Comments | Dynamic (if ChangeBlocks present) |
| `word/header1.xml` | Header | Dynamic (if SectionBlock kind="header") |
| `word/footer1.xml` | Footer | Dynamic (if SectionBlock kind="footer") |

Block → XML mapping:
- `HeadingBlock(level=N)` → `<w:p><w:pPr><w:pStyle w:val="HeadingN"/></w:pPr><w:r><w:t>text</w:t></w:r></w:p>`
- `TextBlock` → `<w:p><w:r><w:t>text</w:t></w:r></w:p>`
- `TableBlock` → `<w:tbl>` with `<w:tc>` cells, `<w:gridSpan>` for merged
- `ListBlock` → `<w:p>` with `<w:numPr>` numbering
- `ImageBlock` → `<w:drawing>` referencing relationship ID

**Effort**: Medium-large. Office XML is verbose but well-documented.
**Value**: High — DOCX is the most common Office format.

### Phase 4: PPTX Generator (needs std/zip + std/xml)

PPTX structure:
- Each `SectionBlock(kind="slide")` → `ppt/slides/slideN.xml`
- Blocks within slide → text boxes, tables, images
- Need minimal `ppt/presentation.xml`, `ppt/slideMasters/`, `ppt/slideLayouts/`

**Strategy**: Ship with a single blank slide layout. Styled presentations require theme support (future).

### Phase 5: XLSX Generator (needs std/zip + std/xml)

XLSX structure:
- Each `SectionBlock(kind="sheet")` → `xl/worksheets/sheetN.xml`
- `TableBlock` rows → `<row>` with `<c>` cells
- Shared strings in `xl/sharedStrings.xml`

**Strategy**: Text-only cells initially. Number/date detection as enhancement.

### Phase 6: ODF Generators (ODT/ODS/ODP)

ODF is simpler XML than OOXML. Same ZIP+XML pattern but:
- Namespace: `urn:oasis:names:tc:opendocument:xmlns:*`
- Single `content.xml` for all content (vs split files in OOXML)
- `styles.xml` for formatting
- `META-INF/manifest.xml` for entries

**Strategic value**: Nobody does native ODF generation without LibreOffice. This would be first-of-kind.

### Phase 7: AI-Assisted Document Generation

Use AILANG's AI effect to generate Block ADT from natural language prompts, then pipe through the appropriate generator.

```
prompt → callJsonSimple(prompt) → JSON → decode → [Block] → generator → output.docx
```

**Architecture**:
- New `ai_generator.ail` service that takes a prompt + target format
- AI generates structured JSON matching Block ADT schema
- JSON decoded into [Block] list
- Piped through the format-specific generator (DOCX, HTML, etc.)

**Prompt engineering**:
- Provide Block ADT schema in the prompt so AI outputs conformant JSON
- Request "compact JSON" to minimize tokens
- Use `callJsonSimple` (not `callJson`) to avoid the multimodal corruption bug

**CLI**:
```bash
./bin/docparse --generate report.docx --prompt "Q1 sales report with revenue table and 3 key findings"
./bin/docparse --generate slides.pptx --prompt "5-slide pitch deck for DocParse" --ai gemini-2.5-flash
```

**Effort**: Medium. The AI call is simple; the challenge is prompt reliability.
**Value**: High — transforms DocParse from a parser into a document creation tool.

## Block ADT Considerations

Current Block ADT is designed for extraction, not roundtrip fidelity. Gaps for generation:

| Gap | Impact | Fix |
|-----|--------|-----|
| TextBlock.style is freeform string | Can't map back to Office styles | Define enum: "normal", "bold", "italic", "code" |
| No font/size info | Generated docs use defaults | Accept this — minimal styling is fine |
| ImageBlock.data is base64 | Need to write as binary in ZIP | Requires `writeEntryBytes` |
| No page layout info | No margins/orientation | Accept defaults or add LayoutBlock |
| ListBlock has flat items | No nested list support | Add `ListBlock.level` or nested ListBlocks |

**Recommendation**: Don't bloat the Block ADT for generation. Accept minimal styling. The value is structure (headings, tables, lists, images), not pixel-perfect formatting.

## Contracts

Each generator should have contracts ensuring:
- Non-empty input produces non-empty output
- Block count preserved in roundtrip (parse → generate → re-parse)
- Table dimensions preserved (row count, column count)
- Heading levels preserved
- Generated ZIP is valid (contains required entries)

Roundtrip contract (aspirational):
```
ensures { parse(generate(blocks)).blocks has same structure as blocks }
```

## Testing Strategy

1. **Unit**: Generate from hand-built Block lists, verify output structure
2. **Roundtrip**: Parse test file → generate → re-parse → compare blocks
3. **Validation**: Open generated files in LibreOffice/Office to verify readability
4. **Benchmark**: Add `benchmarks/generation/` with timing and correctness checks

## Competitive Landscape

| Tool | Parse | Generate | Native (no deps) |
|------|-------|----------|-------------------|
| **DocParse** | Yes | Planned | Yes (AILANG) |
| python-docx | DOCX only | DOCX only | No (lxml, PIL) |
| openpyxl | XLSX only | XLSX only | No (et_xmlfile) |
| python-pptx | PPTX only | PPTX only | No (lxml, PIL) |
| Pandoc | Many formats | Many formats | Yes (Haskell binary) |
| LibreOffice | All Office | All Office | No (huge install) |

DocParse would be the only tool that parses AND generates multiple Office formats as a single dependency-free binary.

## Resolved Decisions

1. **Module location**: `docparse/services/` — generators alongside parsers
2. **Priority order**: Markdown roundtrip → HTML → DOCX → PPTX → XLSX → ODF → AI generation
3. **AI generation**: In scope for v0.6.0

## Open Questions

1. Template support: parse a styled DOCX, replace content, regenerate with same styles? (deferred — needs style preservation in Block ADT)
2. Should generated files include DocParse metadata (creator tag, generation timestamp)?
3. How to handle ImageBlock in formats where we can't embed binary (e.g., plain markdown)?

## Risks

- **AILANG stdlib timeline**: Blocked until std/zip write + std/xml serialize ship
- **Office XML complexity**: Edge cases in styles, themes, numbering that make generated files crash in Office
- **Scope creep**: Temptation to support full formatting fidelity (don't — keep it structural)
- **Roundtrip fidelity**: Block ADT intentionally lossy; generated docs will look different from originals

## Dependencies

- AILANG stdlib: `std/zip` write capabilities (requested 2026-03-12)
- AILANG stdlib: `std/xml` serialization (requested 2026-03-12)
- AILANG v0.4+ compiler (for Go binary in v0.4.0)
- LibreOffice or Office for manual validation of generated files
