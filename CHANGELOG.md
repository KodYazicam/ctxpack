# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
