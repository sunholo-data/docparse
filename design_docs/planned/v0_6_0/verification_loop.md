# Document Generation Verification Loop

**Status**: In progress (2026-03-17)
**Goal**: Ensure generated files open correctly in target applications on all platforms

## The Problem

Generated Office files are structurally valid XML/ZIP (python-pptx, openpyxl, python-docx all open them successfully), but **Mac native apps** (Keynote, Numbers, Preview) are stricter than the spec and may reject files that lack optional-but-expected elements like themes, default text styles, or specific content type overrides.

## Verification Levels

### Level 1: Structural (automated, instant)
- XML well-formedness (every entry parses)
- Required ZIP entries present ([Content_Types].xml, _rels/.rels, etc.)
- Relationship IDs are consistent (rId references resolve)
- Content Types match actual entries

### Level 2: Library Validation (automated, ~1s per file)
- python-docx opens DOCX without exceptions
- python-pptx opens PPTX, can enumerate slides + shapes
- openpyxl opens XLSX, can read all cells
- No warnings from libraries (e.g., openpyxl "no default style")

### Level 3: Application Smoke Test (semi-automated, macOS)
- `open -a "Microsoft Word" file.docx` — opens without repair dialog?
- `open -a "Keynote" file.pptx` — opens without error?
- `open -a "Numbers" file.xlsx` — opens without error?
- `open -a "LibreOffice" file.odt` — opens correctly?
- Fall back to `qlmanage -p` (Quick Look) for basic rendering check

### Level 4: Roundtrip Fidelity (automated)
- Generate → re-parse through DocParse → compare block counts
- Heading text preserved? Table dimensions preserved? List items preserved?

## Known Issues by Format

### PPTX (Keynote won't open)
**Root cause**: Missing `ppt/theme/theme1.xml`. Keynote requires a theme even for "blank" presentations.
**Fix**: Add a minimal theme1.xml (defines color scheme + font scheme). The slideMaster must reference it.

### XLSX (Numbers warning: "no default style")
**Root cause**: Our `styles.xml` is minimal. Numbers/openpyxl expect a `cellStyles` section and default number format.
**Fix**: Add `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` to styles.xml.

### ODT/ODP/ODS (MIME type detection)
**Root cause**: `createArchive` compresses the `mimetype` entry. ODF spec requires it stored uncompressed as the first entry.
**Fix**: Needs AILANG `createArchive` to support a `store` (no compression) flag, or accept this limitation.

### DOCX
**Status**: Opens correctly in Word, LibreOffice, Google Docs. No known issues.

### HTML
**Status**: Opens correctly in all browsers. XHTML-compatible for DocParse roundtrip.

## Verification Script Architecture

```
benchmarks/verify_generated.py
├── verify_structure(path)     # Level 1: ZIP + XML checks
├── verify_library(path)       # Level 2: python-docx/pptx/openpyxl
├── verify_app(path)           # Level 3: macOS `open` + check exit code
└── verify_roundtrip(path)     # Level 4: generate → parse → compare
```

The script:
1. Generates a test file for each format (using `--generate`)
2. Runs all 4 verification levels
3. Reports pass/fail per level per format
4. On failure, dumps the specific error + relevant XML for debugging

## Fix Priority

1. **PPTX theme** — highest impact (Keynote is #1 Mac presentation app)
2. **XLSX cellStyles** — suppress warning
3. **ODF mimetype compression** — needs AILANG stdlib change (deferred)

## Implementation Plan

1. Build `benchmarks/verify_generated.py` with levels 1-2-4
2. Fix PPTX: add theme1.xml + update slideMaster refs
3. Fix XLSX: add cellStyles to styles.xml
4. Regenerate demo files and verify
5. Level 3 (app smoke test) as optional manual step
