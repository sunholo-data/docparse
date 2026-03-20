# DocParse v0.12.0 — AILANG Package Registry Integration

**Status**: PLANNED (2026-03-20)
**Theme**: Publish DocParse as an AILANG package and manage dependencies via the new AILANG package registry
**Depends on**: v0.8.0 (Cloud deployment), v0.4.0 (Go binary for compiled distribution)

## Motivation

AILANG has introduced a package registry system. Today DocParse is a monolithic module tree (`docparse/`) that users obtain by cloning the repo or using the Docker image. This has several problems:

1. **No versioned consumption** — users pin to a git commit, not a semantic version
2. **No dependency declaration** — DocParse's 17 stdlib imports are implicit; there's no manifest
3. **No composability** — other AILANG projects can't `import docparse/services/docx_parser` without vendoring the entire tree
4. **No discoverability** — new AILANG users can't find DocParse without knowing the repo URL

The package registry solves all of these. DocParse becomes a first-class AILANG package that anyone can install with a single command.

### Strategic Value

DocParse is one of the largest and most complex AILANG projects. Being an early registry adopter:
- Validates the registry with a real, non-trivial package (31 modules, 50+ contracts, 17 stdlib deps)
- Establishes best practices for AILANG package structure that others will follow
- Makes DocParse the reference example in AILANG's registry documentation
- Drives feedback to AILANG core on registry DX (consistent with our feedback-first approach)

## Design

### Package Manifest: `ailang.pkg`

Every AILANG package needs a manifest file at the repo root. Based on the registry system:

```toml
[package]
name = "docparse"
version = "0.12.0"
description = "Universal document parsing and generation — Office, PDF, images, 9 output formats"
license = "Apache-2.0"
repository = "https://github.com/sunholo-data/docparse"
authors = ["Mark Edmondson <mark@sunholo.com>"]
keywords = ["document-parsing", "office", "pdf", "docx", "pptx", "xlsx", "generation"]
entry = "docparse/main.ail"

[capabilities]
required = ["IO", "FS"]           # minimum for deterministic parsing
optional = ["AI", "Env", "Net", "Rand", "Clock"]  # for PDF/image, API server, keys

[dependencies]
# stdlib deps are implicit — they ship with AILANG
# Third-party deps go here when they exist:
# xml-schema-validator = "^1.0"

[dev-dependencies]
# Future: test harness packages, benchmark tools

[exports]
# Public API surface — what other packages can import
modules = [
  "docparse/types/document",
  "docparse/services/format_router",
  "docparse/services/docx_parser",
  "docparse/services/pptx_parser",
  "docparse/services/xlsx_parser",
  "docparse/services/csv_parser",
  "docparse/services/markdown_parser",
  "docparse/services/html_parser",
  "docparse/services/epub_parser",
  "docparse/services/odt_parser",
  "docparse/services/odp_parser",
  "docparse/services/ods_parser",
  "docparse/services/direct_ai_parser",
  "docparse/services/html_generator",
  "docparse/services/docx_generator",
  "docparse/services/pptx_generator",
  "docparse/services/xlsx_generator",
  "docparse/services/odt_generator",
  "docparse/services/odp_generator",
  "docparse/services/ods_generator",
  "docparse/services/qmd_generator",
  "docparse/services/ai_generator",
  "docparse/services/output_formatter",
  "docparse/services/eval",
]

# Internal modules — NOT exported (implementation details)
# docparse/services/zip_extract
# docparse/services/xml_helpers
# docparse/services/layout_ai
# docparse/services/api_server      (use serve-api instead)
# docparse/services/api_keys         (internal to API server)
# docparse/services/unstructured_compat
# docparse/services/docparse_browser

[scripts]
check = "ailang check docparse/"
test = "ailang run --entry main --caps IO,FS,Env docparse/main.ail --test"
prove = "ailang run --entry main --caps IO,FS,Env docparse/main.ail --prove"
benchmark = "bash benchmarks/quick_check.sh"
```

### Public vs Internal Modules

A key decision: which modules are part of the public API surface?

**Exported (stable API):**
- `docparse/types/document` — Block ADT, the core data type
- All parsers — consumers need to parse documents
- All generators — consumers need to generate documents
- `format_router` — high-level parse-any-format entry point
- `output_formatter` — Block → JSON/text serialization
- `eval` — structural evaluation checks (for downstream testing)

**Internal (may change without notice):**
- `zip_extract`, `xml_helpers` — implementation details of Office parsers
- `layout_ai` — internal AI layout inference
- `api_server`, `api_keys`, `unstructured_compat` — server-side only
- `docparse_browser` — WASM-specific entry point

This distinction matters because registry consumers should only depend on exported modules. Internal modules can change freely between versions.

### Consuming DocParse as a Dependency

Other AILANG projects can depend on DocParse:

```toml
# In another project's ailang.pkg
[dependencies]
docparse = "^0.12"
```

Then import and use:

```ailang
module my_app/invoice_processor

import docparse/services/format_router (parseFile)
import docparse/services/docx_parser (parseDocx)
import docparse/types/document (Block, getText)

func processInvoice(path: string) -> [Block] ! {IO, FS} {
  parseFile(path)
}
```

### Version Strategy

DocParse is pre-1.0, so minor versions can have breaking changes per semver. Our strategy:

| Version Range | Meaning |
|--------------|---------|
| `0.x.y` (current) | Breaking changes in minor bumps, patches are safe |
| `1.0.0` (future) | Stable public API — Block ADT, parsers, generators |
| `^0.12` | Compatible with 0.12.x but not 0.13.0 |

**What triggers a version bump:**
- **Patch** (0.12.1): Bug fixes, new golden benchmarks, internal refactors
- **Minor** (0.13.0): New parser/generator, Block ADT variant additions, new exports
- **Major** (1.0.0): Block ADT breaking changes, removed exports, capability changes

### Publishing Workflow

Integrate with CI/CD (extends v0.8.0 Cloud Build):

```yaml
# .github/workflows/publish.yml
on:
  push:
    tags: ["v*"]

jobs:
  publish:
    steps:
      - uses: actions/checkout@v4
      - name: Install AILANG
        run: curl -fsSL https://ailang.dev/install.sh | bash
      - name: Type-check
        run: ailang check docparse/
      - name: Run tests
        run: ailang run --entry main --caps IO,FS,Env docparse/main.ail --test
      - name: Run benchmarks
        run: bash benchmarks/quick_check.sh
      - name: Publish to registry
        run: ailang pkg publish
        env:
          AILANG_REGISTRY_TOKEN: ${{ secrets.AILANG_REGISTRY_TOKEN }}
```

**Pre-publish checklist (automated):**
1. `ailang check docparse/` passes (type-check all 31 modules)
2. Inline tests pass
3. 53-file structural benchmark at 100%
4. Version in `ailang.pkg` matches git tag
5. No uncommitted changes

### Registry Metadata & Discovery

The registry page for DocParse should show:

```
docparse v0.12.0
Universal document parsing and generation

Capabilities: IO, FS (required) | AI, Env, Net (optional)
Modules: 31 | Contracts: 50+ | Tests: 76+
Formats: DOCX, PPTX, XLSX, CSV, MD, HTML, EPUB, ODT, ODP, ODS, PDF
License: Apache-2.0

Install: ailang pkg add docparse
```

### Capability Declaration

The `[capabilities]` section in the manifest is important for the registry:

- **Required capabilities** (`IO`, `FS`) — DocParse won't work without these
- **Optional capabilities** (`AI`, `Env`, etc.) — needed for specific features

When a consumer adds DocParse as a dependency, the registry can warn:
> "docparse requires IO and FS capabilities. Your project currently declares only IO. Add FS to your capabilities."

This integrates with AILANG's capability/effect system — the manifest makes implicit requirements explicit.

### Handling the `docparse/` Module Prefix

Currently all modules use the `docparse/` prefix (e.g., `module docparse/services/docx_parser`). This matches the directory layout and works when running from the repo root.

For the registry, this prefix becomes the package namespace. The registry resolver maps:
```
import docparse/services/docx_parser  →  ~/.ailang/packages/docparse@0.12.0/docparse/services/docx_parser.ail
```

No module renaming needed — our existing `docparse/` prefix convention is already registry-compatible.

### Lock File

The registry should generate an `ailang.lock` file (similar to `package-lock.json` or `go.sum`):

```toml
# ailang.lock — auto-generated, do not edit
[[package]]
name = "docparse"
version = "0.12.0"
source = "registry+https://registry.ailang.dev"
checksum = "sha256:abc123..."
```

This file should be committed to source control for reproducible builds.

## Migration Plan

### Phase 1: Manifest & Local Testing
- Create `ailang.pkg` manifest at repo root
- Test `ailang pkg check` validates the manifest
- Test `ailang pkg pack` creates a distributable archive
- Verify all 31 modules resolve correctly from package layout
- Send DX feedback on any registry issues encountered

### Phase 2: First Publish
- Create first git tag (`v0.12.0`)
- Publish to AILANG registry with `ailang pkg publish`
- Test installation in a clean project: `ailang pkg add docparse`
- Verify imported modules work end-to-end (parse a DOCX, generate HTML)
- Update docs and website with installation instructions

### Phase 3: CI/CD Integration
- Add `publish.yml` GitHub Actions workflow
- Automate pre-publish checks (type-check, test, benchmark)
- Tag-triggered publishing
- Registry badge on README

### Phase 4: Consuming Dependencies (Future)
- As the AILANG ecosystem grows, adopt third-party packages:
  - JSON Schema validation library (for v0.11.0 structured extraction)
  - MIME type detection library
  - Template engine (for QMD generation)
- Declare these in `[dependencies]` section
- Test dependency resolution with `ailang pkg install`

## Impact on Existing Workflows

### What Changes
- New `ailang.pkg` file at repo root
- New `ailang.lock` file (auto-generated)
- Git tags for releases (`v0.12.0`, etc.)
- CI/CD gains a publish step
- Users can `ailang pkg add docparse` instead of cloning

### What Doesn't Change
- Module structure (`docparse/` prefix stays)
- `bin/docparse` CLI wrapper still works
- Docker image / Cloud Run deployment unchanged
- `serve-api` usage unchanged
- All existing imports and code unchanged

## Open Questions

1. **Registry availability** — When does the AILANG package registry go live? Is there a beta/staging registry for early adopters?
2. **Private packages** — Can we publish pre-release versions privately before going public?
3. **Capability negotiation** — Does the registry enforce capability compatibility at install time, or only at runtime?
4. **Monorepo support** — DocParse has `benchmarks/`, `sdks/`, `docs/` alongside `docparse/`. Does `ailang pkg pack` include only the AILANG source, or the whole repo?
5. **Binary distribution** — Once v0.4.0 ships (Go compilation), can the registry distribute compiled binaries alongside source?
6. **Transitive dependencies** — How does the registry handle AILANG's known transitive import issue (entry module must import all transitive deps)?
7. **Registry CLI commands** — What are the exact `ailang pkg` subcommands? (publish, add, remove, update, list, search, pack, check?)

## AILANG DX Feedback to Send

After implementing, send feedback on:
- Registry setup DX (how easy was first publish?)
- Manifest format (is TOML right? missing fields?)
- Capability declaration UX
- Dependency resolution behavior
- Lock file format and tooling
- Public/internal module boundary enforcement
- Package size limits and what gets included
