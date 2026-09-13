<p align="center">
  <img src="assets/banner.svg" alt="ctxpack" width="100%">
</p>

<p align="center">
  <strong>Pack a codebase into LLM-ready context.</strong><br/>
  Respects nested <code>.gitignore</code>, budgets the <em>rendered</em> output, redacts secrets, never uploads anything.
</p>

<p align="center">
  <a href="https://github.com/KodYazicam/ctxpack/actions"><img src="https://img.shields.io/github/actions/workflow/status/KodYazicam/ctxpack/ci.yml?style=flat-square" alt="CI"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square" alt="Node">
  <img src="https://img.shields.io/badge/license-KYAL--1.0-7C3AED?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/author-KodYazicam-0D0D0D?style=flat-square" alt="Author">
</p>

---

`ctxpack` walks a project, ranks the files a model actually needs (README, package manifests, `src/`), and writes a single prompt you can paste into ChatGPT, Claude, Copilot, Cursor, or a local model. It is a real CLI with zero runtime dependencies. There is no API key and no network call.

```bash
git clone https://github.com/KodYazicam/ctxpack.git
cd ctxpack && npm ci && npm run build
node dist/cli.js . -o prompt.md
```

After `npm ci && npm run build`, the CLI is `node dist/cli.js`. `npm link` in this clone puts `ctxpack` on your PATH. From another project that file-depends on this repo:

```ts
import { pack } from "@kodyazicam/ctxpack";
```

## Table of contents

- [Why it exists](#why-it-exists)
- [Requirements](#requirements)
- [Install](#install)
- [Quick start](#quick-start)
- [CLI reference](#cli-reference)
- [What is included / skipped](#what-is-included--skipped)
- [Gitignore, nested rules, and symlinks](#gitignore-nested-rules-and-symlinks)
- [Token budget](#token-budget)
- [Secret redaction](#secret-redaction)
- [Markdown fences](#markdown-fences)
- [Output formats](#output-formats)
- [Library API](#library-api)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [License](#license--kyal-10)

## Why it exists

Pasting a zip into a chat window dumps `node_modules`, lockfiles, binaries, and secrets. `ctxpack` does the boring part:

- skips gitignored files (root **and** nested `.gitignore`), binaries, lockfiles, and `.env` (keeps `.env.example`)
- estimates tokens of the **rendered** pack (fences + tree + attribution count against the budget)
- redacts AWS, GitHub, OpenAI (`sk-` / `sk-proj-` / `sk-svcacct-`), Anthropic, Stripe, Slack, and PEM private keys
- emits **markdown**, **xml** (Anthropic-style), or **json**
- ranks README / `package.json` / `src/` higher than tests and docs so the budget is spent on the files a model actually needs
- `--dry-run --verbose` prints the keep/drop plan without writing a file

## Requirements

- Node.js **20+**
- A directory you can read (no network, no API key)

## Install

Not on npm. Clone and build:

```bash
git clone https://github.com/KodYazicam/ctxpack.git
cd ctxpack
npm ci
npm test
npm run build
node dist/cli.js . -o prompt.md
# optional: npm link   →  ctxpack --help
```

## Quick start

```bash
# whole repo, default 80k token budget, markdown
ctxpack . -o prompt.md

# see what would be kept without writing
ctxpack . --dry-run --verbose

# only source, small chat model
ctxpack ./src --max-tokens 12000 -o chat.md

# Claude-style XML
ctxpack . --format xml -o claude.xml

# JSON for a pipeline
ctxpack . --format json -o context.json
```

Paste `prompt.md` into the model. The file starts with a repository tree of **kept** files, then one fenced block per file.

## CLI reference

```text
ctxpack [dir] [options]

  [dir]                    Root to walk (default: .)
  -o, --out <file>         Write to file (default: stdout)
  -m, --max-tokens <n>     Token budget of the rendered output (default: 80000)
  -f, --format <fmt>       markdown | xml | json  (default: markdown)
      --no-redact          Keep secret-like strings (not recommended)
      --no-tree            Skip the repository tree section
      --ignore <glob>      Extra ignore glob (repeatable)
      --include <glob>     Only include matching paths (repeatable)
      --dry-run            Print keep/drop to stderr; write nothing
      --verbose            List every kept and dropped path
  -h, --help
  -v, --version            Reads version from package.json
```

Exit codes: `0` success, `1` bad flags or I/O errors that the CLI catches.

Status goes to **stderr** so you can pipe stdout:

```
wrote /tmp/prompt.md  files=42  dropped=8  tokens≈11840  redacted=2
```

## What is included / skipped

Always skipped:

| Path | Why |
| --- | --- |
| `node_modules/`, `.git/`, `dist/`, `build/`, `coverage/`, `.next/` | Noise |
| `.venv/`, `__pycache__/`, lockfiles (`package-lock.json`, `Cargo.lock`, `go.sum`, …) | Noise |
| `.env`, `.env.*` | Secrets |
| Binaries (png, pdf, wasm, fonts, archives) | Not text |

Always kept if present: `.env.example`, `.env.sample`, `.env.template`.

`--include src/** --include README.md` is a whitelist: only matching paths are packed. Globs understand `*`, `**` at the end (`src/**`), and exact prefixes.

## Gitignore, nested rules, and symlinks

1. Built-in defaults (table above).
2. The root `.gitignore`.
3. Every nested `.gitignore` (a `pkg/.gitignore` that lists `generated.ts` only applies under `pkg/`).
4. `--ignore` globs last.

Directory-only rules (`node_modules/`) skip the directory and everything inside it. Negations (`!.env.example`) work.

Symlinks that loop, or that `realpath` cannot resolve, are skipped so a malicious or accidental link farm cannot hang the walker.

## Token budget

Tokens are an **estimate** (cl100k-ish heuristic). If you `npm i tiktoken` next to ctxpack, `estimateTokens` uses the real cl100k_base encoder; the package stays optional so the CLI has zero required deps. The budget is applied to file contents **plus** a small per-file fence overhead **plus** the header, so markdown wrappers do not secretly blow the window.

Priority (high → low): README, package/pyproject/cargo/go manifests, `src/` / `lib/`, `index.*`, source extensions, then tests/docs. Large files are penalized. When the budget is full, remaining files go to `dropped`. The tree lists **kept** files only; `--verbose` lists drops.

A file larger than 200 KB is truncated in the pack with `/* [truncated by ctxpack] */`.

## Secret redaction

On by default. Patterns:

- AWS access keys (`AKIA…`)
- GitHub tokens (`ghp_`, `gho_`, `github_pat_`)
- OpenAI-like keys (`sk-` 32+, `sk-proj-…`, `sk-svcacct-…`)
- Anthropic (`sk-ant-…`)
- Stripe live keys and `whsec_`
- Slack tokens (`xox…`)
- PEM private keys
- Generic quoted `password=` / `api_key=` assignments

Use `--no-redact` only on a machine you trust. The CLI still prints a warning if matches were found. See [SECURITY.md](./SECURITY.md).

## Markdown fences

If a packed file itself contains `` ``` ``, ctxpack lengthens the fence (```` ````, then longer) so the pack stays valid markdown. XML and JSON formats do not have this problem.

## Output formats

**markdown** — headings + fenced code. Best for ChatGPT / Copilot paste.

**xml** — `<context><file path="…">`. Best for Claude. `& < > " '` are escaped.

**json** — `{ generator, author, root, tree, files: [{ path, tokens, size, truncated, content }] }`.

Every format includes attribution: KodYazicam / ctxpack.

## Library API

After `npm install /path/to/ctxpack` (this clone):

```ts
import { pack, estimateTokens, findSecrets, redactSecrets, walkFiles } from "@kodyazicam/ctxpack";

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
| `packageVersion()` | Version from package.json |

## Examples

```bash
# monorepo app only
ctxpack . --include apps/web/** --include packages/ui/** -o web.md

# ignore generated clients
ctxpack . --ignore generated/** --ignore "*.gen.ts" -o prompt.md

# CI artifact
ctxpack . --max-tokens 24000 -o "$RUNNER_TEMP/context.md"

# inspect ranking
ctxpack . --dry-run --verbose 2> plan.txt
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Output is huge | `--max-tokens 8000` and/or `--include src/**` |
| Missing files | They may be gitignored (including nested), binary, or dropped by budget. `--verbose` |
| Secrets still visible | Pattern may not match. `--ignore` that file. Never `--no-redact` in CI logs |
| `Unknown option` | Flags are GNU-style. Put the directory first: `ctxpack ./src -o out.md` |
| Estimate feels low/high | It is approximate. Tighten `--max-tokens` |
| Markdown looks broken | File contained fences; ctxpack lengthens them. Re-run on latest |

## FAQ

**Does it upload my code?** No. Local filesystem only.

**Can I pack a single file?** `--include path/to/file.ts`.

**Windows paths?** Globs use `/`. The walker normalizes separators.

**Should I commit `prompt.md`?** No. It can contain source and (if you disabled redaction) secrets. Add it to `.gitignore`.

**Is it on npm?** No. Clone this repo. The package name in `package.json` is `@kodyazicam/ctxpack` so a local `npm link` does not collide with the unrelated public `ctxpack` package.

## License — KYAL-1.0

Free to use, copy, modify, and ship. **Attribution is mandatory.** This is not an OSI-approved license; it is MIT-shaped plus a credit requirement.

```
Author : Batuhan (KodYazicam)
Project: ctxpack
Source : https://github.com/KodYazicam/ctxpack
```

Keep this credit in LICENSE, README, and any public product that embeds ctxpack. See [LICENSE](./LICENSE).

<p align="center"><sub>Built by <a href="https://github.com/KodYazicam">KodYazicam</a></sub></p>
