# DocParse Python SDK

Python client for the [DocParse](https://www.sunholo.com/docparse) document parsing API. Parse 13 formats, generate 8 — zero dependencies for Office, pluggable AI for PDFs.

## Install

```bash
pip install docparse
```

## Quick Start

```python
from docparse import DocParse

client = DocParse(api_key="dp_your_key_here")

# Parse a document
result = client.parse("report.docx")
print(f"{len(result.blocks)} blocks, format: {result.format}")

for block in result.blocks:
    if block.type == "heading":
        print(f"  H{block.level}: {block.text}")
    elif block.type == "table":
        print(f"  Table: {len(block.headers)} cols, {len(block.rows)} rows")
    elif block.type == "change":
        print(f"  {block.change_type} by {block.author}: {block.text}")
    else:
        print(f"  {block.type}: {block.text[:80]}")
```

## Parse Documents

```python
# Parse with different output formats
result = client.parse("report.docx")                        # Block ADT (default)
result = client.parse("report.docx", output_format="markdown")  # Markdown
result = client.parse("report.docx", output_format="html")      # HTML

# Access structured data
print(result.status)          # "success"
print(result.filename)        # "report.docx"
print(result.format)          # "zip-office"
print(result.blocks)          # List[Block]
print(result.metadata.title)  # Document title
print(result.metadata.author) # Document author
print(result.summary.tables)  # Number of tables found
```

## Supported Formats

```python
formats = client.formats()
print(formats.parse)       # ['docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods', 'html', 'md', 'csv', 'epub', 'pdf', 'png', 'jpg']
print(formats.generate)    # ['docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods', 'html', 'md']
print(formats.ai_required) # ['pdf', 'png', 'jpg', 'gif', 'bmp', 'tiff']
```

## Block Types

DocParse returns 9 block types:

| Type | Fields | Description |
|------|--------|-------------|
| `text` | `text`, `style`, `level` | Paragraphs, code blocks |
| `heading` | `text`, `level` (1-6) | Document headings |
| `table` | `headers`, `rows` | Tables with merge tracking |
| `list` | `items`, `ordered` | Ordered/unordered lists |
| `image` | `description`, `mime`, `data_length` | Embedded images |
| `audio` | `transcription`, `mime` | Audio transcriptions |
| `video` | `description`, `mime` | Video descriptions |
| `section` | `kind`, `children` | Slides, sheets, headers/footers |
| `change` | `change_type`, `author`, `date`, `text` | Track changes |

### Table cells

Table cells can be simple strings or merged cells:

```python
for block in result.blocks:
    if block.type == "table":
        for cell in block.headers:
            print(f"  {cell.text} (colspan={cell.col_span}, merged={cell.merged})")
```

### Nested sections

Section blocks contain child blocks (slides, sheets, headers/footers):

```python
for block in result.blocks:
    if block.type == "section":
        print(f"Section: {block.kind}")  # "slide", "sheet", "header", "footer", etc.
        for child in block.children:
            print(f"  {child.type}: {child.text[:50]}")
```

## API Key Management

```python
# Generate a key (requires Firebase auth for the dashboard)
key = client.keys.generate(label="my-app", user_id="user123")
print(key.key)      # dp_a1b2c3d4... (shown once!)
print(key.key_id)   # abc123...
print(key.tier)     # "free"

# Check usage
usage = client.keys.usage(key_id="abc123", user_id="user123")
print(f"Requests today: {usage.usage.requests_today} / {usage.quota.requests_per_day}")
print(f"Pages this month: {usage.usage.pages_this_month} / {usage.quota.pages_per_month}")

# Rotate (new key, old one revoked, same tier)
new_key = client.keys.rotate(key_id="abc123", user_id="user123")
print(new_key.key)  # New key

# Revoke
client.keys.revoke(key_id="abc123", user_id="user123")
```

## Migrating from Unstructured

One import change:

```python
# Before
from unstructured_client import UnstructuredClient
client = UnstructuredClient(server_url="https://api.unstructured.io")

# After
from docparse import UnstructuredClient
client = UnstructuredClient(
    server_url="https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app"
)

# All existing code works unchanged
elements = client.general.partition(file="report.docx")
for el in elements:
    print(f"{el.type}: {el.text[:80]}")
    print(f"  metadata: {el.metadata.filename}")
```

## Error Handling

```python
from docparse import DocParse, DocParseError, AuthError, QuotaError

client = DocParse(api_key="dp_invalid")

try:
    result = client.parse("file.docx")
except AuthError as e:
    print(f"Bad key: {e}")           # 401
except QuotaError as e:
    print(f"Quota exceeded: {e}")    # 429
except DocParseError as e:
    print(f"API error ({e.status_code}): {e}")
```

## Configuration

```python
client = DocParse(
    api_key="dp_your_key",
    base_url="https://your-deployment.run.app",  # Custom endpoint
    timeout=120,                                   # Request timeout (seconds)
)
```

## Links

- [DocParse Website](https://www.sunholo.com/docparse)
- [API Documentation](https://www.sunholo.com/docparse/api.html)
- [GitHub](https://github.com/sunholo-data/docparse)
- [Swagger UI](https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app/api/_meta/docs)
