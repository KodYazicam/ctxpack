# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-10-29

### Added

- `ctxpack mcp`: a local stdio Model Context Protocol server for AI agents.
- MCP tools: `pack_context`, `estimate_tokens`, and `scan_secrets`.
- `@kodyazicam/ctxpack/mcp` export for building the MCP server programmatically.
- Agent setup docs for Claude Desktop, Claude Code, Cursor, and other MCP clients.

### Changed

- `@modelcontextprotocol/server` and `zod` are optional dependencies, loaded only by the MCP command.
- Core CLI and library still work without the MCP SDK; the packer remains local-only and network-free.

## [1.0.1] - 2026-10-29

### Changed

- Releases are now published to npm from GitHub Actions using trusted publishing (OIDC), with provenance and no long-lived npm tokens.

## [1.0.0] - 2026-10-29

### Added

- First public npm release: `@kodyazicam/ctxpack`.
- Git-aware file walking with root and nested `.gitignore` support.
- Token-budgeted markdown, XML, and JSON context packs.
- Secret detection and redaction, including OpenAI, Anthropic, AWS, GitHub,
  Stripe, Slack, Google, Telegram, npm, and PEM key patterns.
- `--dry-run`, `--verbose`, `--summary`, `--include`, and `--ignore` controls.
- Library API for embedding the packer in other tools.

### Notes

- No network calls and no API keys.
- `tiktoken` is optional; the package falls back to a deterministic token
  estimate when it is not installed.
