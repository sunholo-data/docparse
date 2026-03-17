# DocParse v0.4.0 — Go Binary Compilation

**Status**: Blocked on 3 codegen bugs (reported 2026-03-17)
**Theme**: Ship DocParse as a standalone Go binary with no AILANG runtime dependency

## Current State (2026-03-17)

We successfully compiled all 19 DocParse modules to Go:

```bash
ailang compile --emit-go --out /tmp/docparse-go --package-name docparse \
  docparse/main.ail docparse/services/*.ail docparse/types/*.ail
```

**Results**: 406 declarations, 16,232 lines of Go across 24 files. Compilation succeeds
but `go build` fails due to 3 codegen bugs.

### Codegen Bugs (blocking)

| Bug | Severity | Description |
|-----|----------|-------------|
| **Function name collision** | High | Same-named functions across AILANG modules (e.g., `parseDocxComments` in both `docx_parser` and `docparse_browser`) emit identical Go function names → "redeclared in this block". Fix: prefix with module name. |
| **Constant redeclaration** | Medium | `evalMaxRawWords` (a `let` binding) emitted 8+ times in eval.go. Codegen emits once per reference, not once per declaration. |
| **markdown_parser syntax** | Medium | Warning: "expected operand, found ']'" — complex pattern match or list literal the Go emitter can't handle yet. |

### What works

- All 19 modules compile to Go (type-check, codegen all pass)
- Effect handler interfaces are clean and implementable
- Type generation (Block ADT, 14 type declarations) correct
- Runtime helpers, dictionaries generate fine
- Prior art: stapledon's_voyage compiled AILANG to Go with a harness for game engine

## Goals

1. Compile DocParse to a native Go binary via `ailang compile --emit-go`
2. Replace `bin/docparse` bash wrapper with compiled binary
3. Maintain feature parity with interpreted AILANG version
4. Benchmark: binary should be 10-100x faster than interpreted for Office parsing

## Background

AILANG's `compile --emit-go` generates Go source code from AILANG modules. Effect
handlers (IO, FS, AI, Env) are emitted as Go interfaces — the developer implements
them in a Go harness. This is the same pattern used by stapledon's_voyage for its
game engine.

`--with-default-handlers` would auto-generate standard implementations, but is NOT
a blocker. We can write the handlers ourselves (~200 lines of Go).

## Architecture

```
docparse/
├── gen/                          # Generated Go code (gitignored)
│   └── docparse/
│       ├── main.go               # Generated from main.ail
│       ├── docx_parser.go        # Generated from docx_parser.ail
│       ├── ... (19 files)        # One per .ail module
│       ├── types.go              # Block ADT + helpers
│       ├── handlers.go           # Effect handler interfaces
│       ├── runtime.go            # Shared runtime helpers
│       └── dictionaries.go       # Type class dictionaries
├── cmd/docparse/
│   ├── main.go                   # CLI entry point (Init + call)
│   └── handlers.go               # Effect handler implementations
└── Makefile                      # Build automation
```

### Effect Handler Interfaces (generated)

The compiler generates clean Go interfaces we need to implement:

```go
type FSHandler interface {
    Exists(path string) bool
    ReadFile(path string) (string, error)
    WriteFile(path string, content string) error
}

type EnvHandler interface {
    GetEnv(key string) string
    HasEnv(key string) bool
    GetArgs() []string
}

type AIHandler interface {
    Call(input string) (string, error)
}
```

### Handler Implementations

| Handler | Go Implementation | Complexity |
|---------|-------------------|------------|
| `FSHandler` | `os.ReadFile`, `os.WriteFile`, `os.Stat` + `archive/zip` for Office files | Medium — ZIP-within-file needs care |
| `EnvHandler` | `os.Getenv`, `os.LookupEnv`, `os.Args[1:]` | Trivial |
| `AIHandler` | HTTP POST to Gemini/Ollama/Claude APIs | Medium — 3 providers |
| `DebugHandler` | No-op or `log.Printf` to stderr | Trivial |
| `RandHandler` | `math/rand` | Trivial (not used by DocParse) |
| `ClockHandler` | `time.Now()` | Trivial (not used by DocParse) |
| `NetHandler` | `net/http` | Trivial (not used by DocParse) |

Only FS, Env, and AI are actually used by DocParse. The rest can be no-op stubs.

### AI Handler

The Go AI handler needs to support multiple providers:
- **Gemini**: REST API to `generativelanguage.googleapis.com`
- **Ollama**: REST API to `localhost:11434`
- **Claude**: REST API to `api.anthropic.com`

Use AILANG's `models.yml` to resolve model names to providers and endpoints.

## Build Process

```bash
# Step 1: Generate Go code (all 19 modules)
ailang compile --emit-go --out gen --package-name docparse \
  docparse/main.ail docparse/services/*.ail docparse/types/*.ail

# Step 2: Build binary
cd gen && go build -o ../bin/docparse-go ./cmd/docparse/

# Step 3: Verify output parity
./bin/docparse-go data/test_files/sample.docx
diff <(./bin/docparse data/test_files/sample.docx) \
     <(./bin/docparse-go data/test_files/sample.docx)
```

## Verification Strategy

1. **Output parity**: Binary produces identical JSON to interpreted version for all 53 golden test files
2. **Benchmark parity**: `uv run benchmarks/run_benchmarks.py` passes with binary as backend
3. **Performance**: Office parsing <50ms per file (vs ~2-3s interpreted due to startup overhead)
4. **PDF parity**: Same scores on PDF benchmark with same model

## Success Criteria

- `bin/docparse-go` binary works for all 10+ formats
- Identical output to interpreted version on all 53 golden files
- 10x+ speedup on Office parsing (eliminates ~2-3s startup overhead per file)
- PDF extraction works with at least Gemini backend
- Single binary, no runtime dependencies (except Ollama for local models)

## Risks

- **Codegen bugs** (3 known, likely more) — AILANG's Go emitter is young
- Effect handler boundary is fragile — any AILANG stdlib changes could break Go handlers
- ZIP handling in Go needs to match AILANG's FS effect semantics exactly
- AI handler complexity (3 providers, multimodal requests)
- Module scoping collision bug (known AILANG issue) may cause more Go name conflicts

## Dependencies

- AILANG compiler with fixed Go codegen (3 bugs reported 2026-03-17)
- Go 1.22+
- Optional: `--with-default-handlers` (nice-to-have, not a blocker)

## Open Questions

1. Should we vendor the generated Go code or regenerate on each build?
2. How to handle AILANG stdlib updates — regenerate and re-test?
3. Should the AI handler use AILANG's models.yml directly or have its own config?
4. Cross-compilation targets: Linux amd64, Darwin arm64, Windows?
5. Can we exclude unused modules (eval.ail, docparse_browser.ail) from the binary build?
