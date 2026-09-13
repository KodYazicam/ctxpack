# Contributing to ctxpack

Thanks for helping. Attribution stays with [KodYazicam](https://github.com/KodYazicam) under KYAL-1.0.

## Setup

```bash
npm ci
npm test
npm run build
npm run typecheck
```

## Rules

- TypeScript, strict mode, no `any` unless a test fixture forces it.
- Keep the CLI zero-config. New flags need a test and a README line.
- Token estimates may be approximate; do not pull native `tiktoken` bindings.
- Secret patterns must not log the secret itself.
- Nested `.gitignore` and symlink loops are part of the contract — add a test if you touch the walker.
- Markdown output must survive a file that contains fence markers.

## Pull requests

1. Fork and branch from `main`.
2. Add or update tests.
3. Keep the license notice intact.
