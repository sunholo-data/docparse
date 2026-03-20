# @sunholo/docparse

JavaScript/TypeScript client for the [DocParse](https://www.sunholo.com/docparse) document parsing API. Parse 13 formats, generate 8 — zero dependencies, native fetch.

## Install

```bash
npm install @sunholo/docparse
```

## Quick Start

```typescript
import { DocParse } from '@sunholo/docparse';

const client = new DocParse({ apiKey: 'dp_your_key_here' });

// Parse a document
const result = await client.parse('report.docx');
console.log(`${result.blocks.length} blocks, format: ${result.format}`);

for (const block of result.blocks) {
  switch (block.type) {
    case 'heading':
      console.log(`  H${block.level}: ${block.text}`);
      break;
    case 'table':
      console.log(`  Table: ${block.headers?.length} cols, ${block.rows?.length} rows`);
      break;
    case 'change':
      console.log(`  ${block.changeType} by ${block.author}: ${block.text}`);
      break;
    default:
      console.log(`  ${block.type}: ${block.text?.slice(0, 80)}`);
  }
}
```

## Parse Documents

```typescript
// Parse with different output formats
const blocks = await client.parse('report.docx');                    // Block ADT (default)
const markdown = await client.parse('report.docx', 'markdown');      // Markdown
const html = await client.parse('report.docx', 'html');              // HTML

// Access structured data
console.log(result.status);           // "success"
console.log(result.blocks);           // Block[]
console.log(result.metadata.title);   // Document title
console.log(result.summary.tables);   // Number of tables
```

## Block Types

All 9 block types are fully typed:

```typescript
import type { Block, Cell, ParseResult } from '@sunholo/docparse';

// Type narrowing via block.type
for (const block of result.blocks) {
  if (block.type === 'section') {
    console.log(`Section: ${block.kind}`);  // "slide", "header", etc.
    for (const child of block.blocks ?? []) {
      console.log(`  ${child.type}: ${child.text}`);
    }
  }
}
```

## API Key Management

```typescript
// Generate
const key = await client.keys.generate('my-app', 'user123');
console.log(key.key);    // dp_a1b2c3d4... (shown once!)
console.log(key.tier);   // "free"

// Usage
const usage = await client.keys.usage('keyId123', 'user123');
console.log(`${usage.usage.requestsToday} / ${usage.quota.requestsPerDay} requests`);

// Rotate / Revoke
const newKey = await client.keys.rotate('keyId123', 'user123');
await client.keys.revoke('keyId123', 'user123');
```

## Migrating from Unstructured

```typescript
// Before
import { UnstructuredClient } from 'unstructured-client';
const client = new UnstructuredClient({ serverUrl: 'https://api.unstructured.io' });

// After — one import change
import { UnstructuredClient } from '@sunholo/docparse';
const client = new UnstructuredClient({
  serverUrl: 'https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app'
});

// All existing code works unchanged
const elements = await client.general.partition({ file: 'report.docx' });
```

## Error Handling

```typescript
import { DocParse, DocParseError, AuthError, QuotaError } from '@sunholo/docparse';

try {
  const result = await client.parse('file.docx');
} catch (e) {
  if (e instanceof AuthError) console.log('Bad API key');
  else if (e instanceof QuotaError) console.log('Quota exceeded');
  else if (e instanceof DocParseError) console.log(`API error: ${e.statusCode}`);
}
```

## Configuration

```typescript
const client = new DocParse({
  apiKey: 'dp_your_key',
  baseUrl: 'https://your-deployment.run.app',  // Custom endpoint
  timeout: 120000,                              // Request timeout (ms)
});
```

## Browser Usage

Works in browsers with native `fetch`:

```html
<script type="module">
  import { DocParse } from './node_modules/@sunholo/docparse/src/index.js';

  const client = new DocParse({ apiKey: 'dp_your_key' });
  const health = await client.health();
  console.log(health.status); // "healthy"
</script>
```

## Links

- [DocParse Website](https://www.sunholo.com/docparse)
- [API Documentation](https://www.sunholo.com/docparse/api.html)
- [GitHub](https://github.com/sunholo-data/docparse)
