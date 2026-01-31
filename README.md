# AI Relay: Telegram CLI Bot

![CI](https://github.com/oscarhugopaz/airelay/actions/workflows/ci.yml/badge.svg?branch=main)


Minimal Telegram bot that forwards messages to a local CLI agent (Codex by default). Each message is executed locally and the output is sent back to the chat.

## What it does
- Runs your configured CLI agent for every message
- Queues requests per chat to avoid overlapping runs
- Keeps agent session state when JSON output is detected
- Handles text, audio (via Parakeet), images, and documents
- Supports `/thinking`, `/agent`, and `/cron` for runtime tweaks

## Requirements
- Node.js 18+
- Agent CLI on PATH (default: `codex`, or `opencode` when configured)
- Audio (optional): `parakeet-mlx` + `ffmpeg`

## Quick start
```bash
git clone https://github.com/oscarhugopaz/airelay.git
cd airelay
npm install
cp .env.example .env
```

1. Create a Telegram bot with BotFather and get the token.
2. Set `TELEGRAM_BOT_TOKEN` in `.env`.
3. Start the bot:

```bash
npm start
```

If you're running a newer Node version and want to silence deprecation warnings:

```bash
# Silence only the punycode DEP0040 warning
npm run start:no-punycode-warning

# Silence all deprecation warnings
npm run start:quiet
```

Open Telegram, send `/start`, then any message.

## Usage (Telegram)
- Text: send a message and get the agent response
- Audio: send a voice note or audio file (transcribed with Parakeet)
- Images: send a photo or image file (caption becomes the prompt)
- Documents: send a file (caption becomes the prompt)
- `/reset`: clear the chat session (drops the stored session id)
- `/thinking <level>`: set reasoning effort (mapped to `model_reasoning_effort`) for this session
- `/agent <codex|opencode>`: set the CLI agent (persisted in `config.json`)
- `/model [model_id]`: view/set the model for the current agent (persisted in `config.json`)
- `/cron [list|reload|chatid]`: manage cron jobs (see below)
- `/help`: list available commands and scripts
- `/document_scripts confirm`: generate short descriptions for scripts (writes `scripts.json`; requires `ALLOWED_USERS`)
- `/<script> [args]`: run an executable script from `~/.config/airelay/scripts`

### Cron jobs
Cron jobs are loaded from `~/.config/airelay/cron.json` (or `$XDG_CONFIG_HOME/airelay/cron.json`) and are sent to a single Telegram chat (the `cronChatId` configured in `config.json`).

- `/cron chatid`: prints your chat ID (use this value as `cronChatId`).
- `/cron list`: lists configured jobs.
- `/cron add <id> <cron> [timezone] <prompt>`: creates a new job and reloads the scheduler.
- `/cron remove <id>`: removes a job and reloads the scheduler.
- `/cron enable <id>` / `/cron disable <id>`: toggles a job and reloads the scheduler.
- `/cron reload`: reloads `cron.json` without restarting the bot.

### Images in responses
If the agent generates an image, save it under the image folder (default: OS temp under `airelay/images`) and reply with:
```
[[image:/absolute/path]]
```
The bot will send the image back to Telegram.

### Documents in responses
If the agent generates a document (or needs to send a file), save it under the documents folder (default: OS temp under `airelay/documents`) and reply with:
```
[[document:/absolute/path]]
```
The bot will send the document back to Telegram.

## Configuration
The only required environment variable is `TELEGRAM_BOT_TOKEN` in `.env`.

Optional:
- `AIRELAY_SCRIPTS_DIR`: directory for slash scripts (default: `~/.config/airelay/scripts`)
- `AIRELAY_SCRIPT_TIMEOUT_MS`: timeout for slash scripts (default: 120000)
- `ALLOWED_USERS`: comma-separated list of Telegram user IDs allowed to interact with the bot (if unset/empty, the bot refuses to start)
- `AIRELAY_ALLOW_OPEN_BOT`: set to `true` to allow starting without `ALLOWED_USERS` (NOT recommended)
- `AIRELAY_DOWNLOAD_TIMEOUT_MS`: timeout for Telegram file downloads (default: 60000)
- `AIRELAY_MAX_DOWNLOAD_BYTES`: max size for Telegram file downloads in bytes (default: 26214400)
- `AIRELAY_CODEX_YOLO`: set to `true` to enable Codex `--yolo` (default: false)
- `AIRELAY_OPENCODE_PERMISSION`: JSON string for OpenCode permissions (defaults to deny)
- `AIRELAY_OPENCODE_ALLOW_ALL`: set to `true` to use OpenCode allow-all permissions (default: false)

## Config file (optional)
The bot stores `/agent` in a JSON file at:
`~/.config/airelay/config.json` (or `$XDG_CONFIG_HOME/airelay/config.json`).

Example:
```json
{
  "agent": "codex",
  "cronChatId": 123456789
}
```

See `docs/configuration.md` for details.

## Memory + soul files (optional)
If `soul.md` and/or `memory.md` exist next to `config.json`, their contents are injected into the first prompt of a new conversation (`soul.md` first, then `memory.md`).

Location:
`~/.config/airelay/soul.md` and `~/.config/airelay/memory.md` (or under `$XDG_CONFIG_HOME/airelay/`).

## Security notes
This bot executes local commands on your machine. Run it only on trusted hardware, keep the bot private, and avoid sharing the token.

To restrict access, set `ALLOWED_USERS` in `.env` to a comma-separated list of Telegram user IDs. Unauthorized users are ignored (no reply).

Hardening defaults:
- The bot ignores any update that is not a private chat.
- The bot refuses to start without `ALLOWED_USERS` unless `AIRELAY_ALLOW_OPEN_BOT=true`.

## How it works
- Builds a shell command with a base64-encoded prompt to avoid quoting issues
- Executes the command locally via `bash -lc`
- If the agent outputs Codex-style JSON, stores `thread_id` and uses `exec resume`
- Audio is downloaded, transcribed, then forwarded as text
- Images are downloaded into the image folder and included in the prompt

## Troubleshooting
- `ENOENT parakeet-mlx`: install `parakeet-mlx` and ensure it is on PATH.
- `Error processing response.`: check that `codex` is installed and accessible on PATH.
- Telegram `ECONNRESET`: usually transient network, retry.

## License
MIT. See `LICENSE`.
