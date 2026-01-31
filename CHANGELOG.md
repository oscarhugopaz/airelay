# Changelog

All notable changes to this project will be documented in this file.

## [0.1.10] - 2026-01-31
### Removed
- Dropped unused agent integrations (only `codex` and `opencode` remain).

## [0.1.9] - 2026-01-31
### Changed
- Rebranded from Aipal to Airelay (AI Relay).
- Default config paths now live under `~/.config/airelay` (or `$XDG_CONFIG_HOME/airelay`).
- Environment variable prefix migrated from `AIPAL_*` to `AIRELAY_*`.

### Security
- Ignore non-private chats by default.
- Fail-closed startup: the bot refuses to start when `ALLOWED_USERS` is empty, unless `AIRELAY_ALLOW_OPEN_BOT=true`.
- Harden Telegram downloads with streaming, timeout (`AIRELAY_DOWNLOAD_TIMEOUT_MS`), and max bytes (`AIRELAY_MAX_DOWNLOAD_BYTES`).
- Make dangerous agent flags opt-in (`AIRELAY_CODEX_YOLO`).
- OpenCode permissions are safe-by-default (deny) unless explicitly overridden.

## [0.1.8] - 2026-01-26
### Added
- `ALLOWED_USERS` environment variable to restrict bot access to an allowlist of Telegram user IDs.
- `/help` command to list built-in commands and executable scripts.
- `/document_scripts confirm` command to generate short script descriptions and persist them to `scripts.json`.
- `opencode` agent integration.
- `/model` command to view/set the model for the current agent (persisted in `config.json`).

### Changed
- If an agent exits non-zero but produces usable stdout, the bot returns that output instead of failing hard.

### Documentation
- Fixed `AIRELAY_SCRIPTS_DIR` default path typo.
- Thanks @JcMinarro for the contributions in this release.

## [0.1.7] - 2026-01-25
### Added
- Internal cron scheduler for scheduled tasks within the same bot session.
- `/cron` command to list jobs, reload config, and get chat ID.
- Cron jobs config in `~/.config/airelay/cron.json`.

## [0.1.6] - 2026-01-21
### Added
- Agent session resume improvements.

## [0.1.5] - 2026-01-20
### Added
- Agent registry with adapters for multiple CLIs.

### Changed
- Headless mode improvements to avoid hangs.
- Headless JSON mode improvements.
- `/model` support removed; model is no longer passed between CLIs.

## [0.1.4] - 2026-01-20
### Added
- Load optional memory.md into the first prompt of a new conversation.

### Documentation
- Document memory.md alongside config.json.

## [0.1.3] - 2026-01-15
### Added
- Reply with transcript for audio messages.

### Changed
- Add timestamps to bot logs.

### Documentation
- Update local agent notes.

## [0.1.2] - 2026-01-13
- Earlier changes were tracked only in GitHub releases.
