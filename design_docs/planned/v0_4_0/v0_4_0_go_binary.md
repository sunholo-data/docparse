# DocParse v0.4.0 — Go Binary Compilation

**Status**: Planned
**Theme**: Ship DocParse as a standalone Go binary with no AILANG runtime dependency

## Goals

1. Compile DocParse to a native Go binary via `ailang compile --emit-go`
2. Replace `bin/docparse` bash wrapper with compiled binary
3. Maintain feature parity with interpreted AILANG version
4. Benchmark: binary should be 10-100x faster than interpreted for Office parsing

## Background

AILANG's `compile --emit-go` generates Go source code from AILANG modules. However, effect handlers (IO, FS, AI, Env) are emitted as panic stubs — the developer must implement them manually in Go.

We've already sent AILANG feedback requesting `--with-default-handlers` to auto-generate standard implementations. This feature may ship before we need it.

## Architecture

```
docparse/
├── gen/                          # Generated Go code (gitignored)
│   ├── docparse/
│   │   ├── main.go              # Generated from main.ail
│   │   ├── types/document.go    # Generated from document.ail
│   │   └── services/*.go        # Generated from service modules
│   └── handlers/                # Hand-written effect handlers
│       ├── io_handler.go        # println → fmt.Println
│       ├── fs_handler.go        # readFile → os.ReadFile, ZIP handling
│       ├── env_handler.go       # getArgs → os.Args
│       └── ai_handler.go        # call/callJsonSimple → HTTP client
├── cmd/docparse/main.go         # CLI entry point (wraps generated code)
└── Makefile                     # Build automation
```

### Effect Handler Implementations

| Effect | Go Implementation |
|--------|-------------------|
| `IO.println` | `fmt.Println` |
| `FS.readFile` | `os.ReadFile` |
| `FS.readFileBytes` | `os.ReadFile` + base64 encode |
| `FS.listEntries` | `archive/zip.Reader` |
| `Env.getArgs` | `os.Args[1:]` |
| `AI.call` | HTTP POST to Ollama/Gemini/Claude API |
| `AI.callJsonSimple` | HTTP POST + JSON response |

The FS handler is the most complex — it needs to handle ZIP-within-file operations that the AILANG runtime does transparently.

### AI Handler

The Go AI handler needs to support multiple providers:
- **Gemini**: REST API to `generativelanguage.googleapis.com`
- **Ollama**: REST API to `localhost:11434`
- **Claude**: REST API to `api.anthropic.com`

Use AILANG's `models.yml` to resolve model names to providers and endpoints.

## Build Process

```bash
# Step 1: Generate Go code
ailang compile --emit-go --out gen --package-name docparse docparse/

# Step 2: Build binary
go build -o bin/docparse-go cmd/docparse/main.go

# Step 3: Verify
./bin/docparse-go data/test_files/sample.docx
diff <(./bin/docparse data/test_files/sample.docx) <(./bin/docparse-go data/test_files/sample.docx)
```

## Verification Strategy

1. **Output parity**: Binary produces identical JSON to interpreted version for all 53 golden test files
2. **Benchmark parity**: `uv run benchmarks/run_benchmarks.py` passes with binary as backend
3. **Performance**: Office parsing <50ms per file (vs ~500ms interpreted)
4. **PDF parity**: Same scores on PDF benchmark with same model

## Success Criteria

- `bin/docparse-go` binary works for all Office formats
- Identical output to interpreted version on all golden files
- 10x+ speedup on Office parsing
- PDF extraction works with at least Gemini backend
- Single binary, no runtime dependencies (except Ollama for local models)

## Risks

- AILANG `compile --emit-go` may have bugs with complex pattern matching or recursive types
- Effect handler boundary is fragile — any AILANG stdlib changes could break Go handlers
- ZIP handling in Go needs to match AILANG's FS effect semantics exactly
- AI handler complexity (3 providers, multimodal requests, streaming)

## Dependencies

- AILANG compiler v0.4+ with stable `--emit-go`
- Go 1.22+
- Ideally: AILANG ships `--with-default-handlers` (our feature request)

## Open Questions

1. Should we vendor the generated Go code or regenerate on each build?
2. How to handle AILANG stdlib updates — regenerate and re-test?
3. Should the AI handler use AILANG's models.yml directly or have its own config?
4. Cross-compilation targets: Linux amd64, Darwin arm64, Windows?
