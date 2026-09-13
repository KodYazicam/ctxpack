# Security Policy

## Supported versions

Supported line: `main` on GitHub. This tool is not published to npm.

## What ctxpack does with your files

ctxpack reads a directory on the local machine and writes a prompt file. It never opens a network socket. There is no telemetry.

It **will** put source into the output file. Treat `prompt.md` as sensitive:

- Do not commit it.
- Do not paste it into a public gist if the repo is private.
- `--no-redact` leaves secret-like strings intact. Do not use it in CI logs.

## Secret redaction

Redaction is regex-based. It is a seatbelt, not a vault. It matches:

- AWS access keys (`AKIA…`)
- GitHub tokens (`ghp_`, `gho_`, `github_pat_`)
- OpenAI keys (`sk-…`, `sk-proj-…`, `sk-svcacct-…`)
- Anthropic (`sk-ant-…`)
- Stripe live / webhook secrets
- Slack tokens
- PEM private keys
- Quoted `password=` / `api_key=` assignments

It will miss custom formats. If a file must never leave the machine, `--ignore` it.

## Reporting a vulnerability

Email is not required. Open a **private** GitHub security advisory on [KodYazicam/ctxpack](https://github.com/KodYazicam/ctxpack/security/advisories/new), or an issue without a proof-of-concept payload if that is all you have.

Please include:

- ctxpack version (`node dist/cli.js --version`)
- Node version
- Whether the issue is in the walker, redaction, or the CLI write path
