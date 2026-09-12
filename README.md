<p align="center">
  <img src="assets/banner.svg" alt="ctxpack" width="100%">
</p>

<p align="center">
  <strong>Pack a codebase into LLM-ready context.</strong><br/>
  Respects <code>.gitignore</code>, budgets tokens, redacts secrets.
</p>

<p align="center">
  <a href="https://github.com/KodYazicam/ctxpack/actions"><img src="https://img.shields.io/github/actions/workflow/status/KodYazicam/ctxpack/ci.yml?style=flat-square" alt="CI"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square" alt="Node">
  <img src="https://img.shields.io/badge/license-KYAL--1.0-7C3AED?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/author-KodYazicam-0D0D0D?style=flat-square" alt="Author">
</p>

---

`ctxpack` walks a project, ranks the files that actually matter (README, package manifests, `src/`), and writes a single prompt you can paste into ChatGPT, Claude, Copilot, Cursor, or any local model. It is a real CLI, not a wrapper around an API.

```bash
npx @kodyazicam/ctxpack . -o prompt.md
```

## Table of contents

- [Why it exists](#why-it-exists)
- [Requirements](#requirements)
- [Install](#install)
- [Quick start](#quick-start)
- [CLI reference](#cli-reference)
- [What is included / skipped](#what-is-included--skipped)
- [Token budget](#token-budget)
- [Secret redaction](#secret-redaction)
- [Output formats](#output-formats)
- [Library API](#library-api)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [License](#license--kyal-10)

## Why it exists

Pasting a zip into a chat window dumps `node_modules`, lockfiles, binaries, and secrets. `ctxpack` does the boring part:

- skips gitignored files, binaries, lockfiles, and `.env` (keeps `.env.example`)
- estimates tokens and drops low-value files when you set a budget
- redacts AWS keys, GitHub tokens, OpenAI keys, Slack tokens, private keys
- emits **markdown**, **xml** (Anthropic-style), or **json**
- ranks README / `package.json` / `src/` higher than tests and docs so the budget is spent on the files a model actually needs

## Requirements

- Node.js **20+**
- A directory you can read (no network, no API key)

## Install

```bash
# one-shot
npx @kodyazicam/ctxpack . -o prompt.md

# global (binary is still `ctxpack`)
npm install -g @kodyazicam/ctxpack
ctxpack --help

# from a clone
git clone https://github.com/KodYazicam/ctxpack.git
cd ctxpack
npm install
npm test
npm run build
node dist/cli.js . -o /tmp/prompt.md
```

## Quick start

```bash
# whole repo, default 80k token budget, markdown
ctxpack . -o prompt.md

# only source, small chat model
ctxpack ./src --max-tokens 12000 -o chat.md

# Claude-style XML
ctxpack . --format xml -o claude.xml

# JSON for a pipeline
ctxpack . --format json -o context.json
```

Paste `prompt.md` into the model. The file starts with a repository tree, then one fenced block per kept file.

## CLI reference

```text
ctxpack [dir] [options]

  [dir]                    Root to walk (default: .)
  -o, --out <file>         Write to file (default: stdout)
  -m, --max-tokens <n>     Token budget (default: 80000)
  -f, --format <fmt>       markdown | xml | json  (default: markdown)
      --no-redact          Keep secret-like strings (not recommended)
      --no-tree            Skip the repository tree section
      --ignore <glob>      Extra ignore glob (repeatable)
      --include <glob>     Only include matching paths (repeatable)
  -h, --help
  -v, --version
```

Exit codes: `0` success, `1` bad flags.

Status goes to **stderr** so you can pipe stdout:

```
wrote /tmp/prompt.md  files=42  dropped=8  tokens≈11840  redacted=2
```

## What is included / skipped

Always skipped:

| Path | Why |
| --- | --- |
| `node_modules/`, `.git/`, `dist/`, `build/`, `coverage/`, `.next/` | Noise |
| `.venv/`, `__pycache__/`, lockfiles | Noise |
| `.env`, `.env.*` | Secrets |
| Binaries (png, pdf, wasm, fonts, archives) | Not text |

Always kept if present: `.env.example`, `.env.sample`, `.env.template`.

Also respects the project's `.gitignore`. `--ignore` adds more globs. `--include src/** --include README.md` is a whitelist: only matching paths are packed.

## Token budget

Tokens are an **estimate** (cl100k-ish, no native tiktoken). Good enough to stay under a model's window.

Priority (high → low): README, package/pyproject/cargo/go manifests, `src/` / `lib/`, `index.*`, source extensions, then tests/docs. Large files are penalized. When the budget is full, remaining files go to `dropped` — they still appear in the tree only if they were **kept**.

A file larger than 200 KB is truncated in the pack with `/* [truncated by ctxpack] */`.

## Secret redaction

On by default. Patterns:

- AWS access keys (`AKIA…`)
- GitHub tokens (`ghp_`, `gho_`, …)
- OpenAI-like keys (`sk-…`)
- Slack tokens (`xox…`)
- PEM private keys
- Generic `password=` / `api_key=` assignments

Use `--no-redact` only on a machine you trust. The CLI still prints a warning if matches were found.

## Output formats

**markdown** — headings + fenced code. Best for ChatGPT / Copilot paste.

**xml** — `<context><file path="…">`. Best for Claude.

**json** — `{ generator, author, root, tree, files: [{ path, tokens, size, truncated, content }] }`.

Every format includes attribution: KodYazicam / ctxpack.

## Library API

```ts
import { pack, estimateTokens, findSecrets, redactSecrets, walkFiles } from "ctxpack";

const result = pack({
  root: process.cwd(),
  maxTokens: 16_000,
  format: "markdown",   // "xml" | "json"
  redact: true,
  tree: true,
  extraIgnore: ["vendor/**"],
  include: ["src/**", "README.md"],
});

result.output;         // string
result.files;          // kept files
result.dropped;        // over budget
result.tokens;         // estimate of output
result.redactedCount;
```

| Export | Purpose |
| --- | --- |
| `pack(options)` | Walk, rank, budget, render |
| `estimateTokens(text)` | Fast cl100k-ish estimate |
| `findSecrets(text)` / `redactSecrets(text)` | Secret scan |
| `walkFiles(options)` | Gitignore-aware walker |
| `runCli(argv)` | Same as the binary |

## Examples

```bash
# monorepo app only
ctxpack . --include apps/web/** --include packages/ui/** -o web.md

# ignore generated clients
ctxpack . --ignore generated/** --ignore "*.gen.ts" -o prompt.md

# CI artifact
ctxpack . --max-tokens 24000 -o "$RUNNER_TEMP/context.md"
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Output is huge | `--max-tokens 8000` and/or `--include src/**` |
| Missing files | They may be gitignored, binary, or dropped by budget. Check stderr `dropped=` |
| Secrets still visible | Pattern may not match. Add `--ignore` for that file. Never use `--no-redact` in CI logs |
| `Unknown option` | Flags are GNU-style. Put the directory first: `ctxpack ./src -o out.md` |
| Estimate feels low/high | It is approximate. Tighten `--max-tokens` rather than trusting an exact count |

## FAQ

**Does it upload my code?** No. Local filesystem only.

**Can I pack a single file?** `--include path/to/file.ts`.

**Windows paths?** Globs use `/`. The walker normalizes separators.

**Should I commit `prompt.md`?** No. It can contain source and (if you disabled redaction) secrets. Add it to `.gitignore`.

## License — KYAL-1.0

Free to use, copy, modify, and ship. **Attribution is mandatory.**

```
Author : Batuhan (KodYazicam)
Project: ctxpack
Source : https://github.com/KodYazicam/ctxpack
```

Keep this credit in LICENSE, README, and any public product that embeds ctxpack. See [LICENSE](./LICENSE).

<p align="center"><sub>Built by <a href="https://github.com/KodYazicam">KodYazicam</a></sub></p>
