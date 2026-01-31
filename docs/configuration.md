# Configuration (config.json + memory.md + soul.md + cron.json)

This bot stores a minimal JSON config with the values set by `/agent`.

## Location
- `~/.config/aipal/config.json`
- If `XDG_CONFIG_HOME` is set, it uses `$XDG_CONFIG_HOME/aipal/config.json`

## Schema
```json
{
  "agent": "codex",
  "models": {
    "codex": "gpt-5"
  },
  "cronChatId": 123456789
}
```

## Fields
- `agent`: which CLI to run (`codex`, `claude`, `gemini`, or `opencode`).
- `models` (optional): a map of agent id → model id, set via `/model`.
- `cronChatId` (optional): Telegram chat id used for cron job messages. You can get it from `/cron chatid`.

If the file is missing, all values are unset and the bot uses defaults.

## Environment variables
- `ALLOWED_USERS` (recommended): comma-separated list of Telegram user IDs allowed to use the bot. If unset/empty, the bot refuses to start (safer default).
- `AIPAL_ALLOW_OPEN_BOT` (optional): set to `true` to allow starting without `ALLOWED_USERS` (NOT recommended).
- `AIPAL_DOWNLOAD_TIMEOUT_MS` (optional): timeout for Telegram file downloads in ms (default: 60000).
- `AIPAL_MAX_DOWNLOAD_BYTES` (optional): max Telegram file download size in bytes (default: 26214400).
- `AIPAL_CODEX_YOLO` / `AIPAL_GEMINI_YOLO` (optional): set to `true` to enable `--yolo` for those CLIs.
- `AIPAL_CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS` (optional): set to `true` to enable `--dangerously-skip-permissions`.
- `AIPAL_OPENCODE_PERMISSION` (optional): JSON string with OpenCode permissions (defaults to deny).
- `AIPAL_OPENCODE_ALLOW_ALL` (optional): set to `true` to force allow-all OpenCode permissions.

## Memory file (optional)
If `memory.md` exists alongside `config.json`, its contents are injected into the very first prompt of a new conversation (i.e. when there is no active session/thread).

Location:
- `~/.config/aipal/memory.md`
- If `XDG_CONFIG_HOME` is set, it uses `$XDG_CONFIG_HOME/aipal/memory.md`

## Soul file (optional)
If `soul.md` exists alongside `config.json`, its contents are injected into the very first prompt of a new conversation, before `memory.md`.

Location:
- `~/.config/aipal/soul.md`
- If `XDG_CONFIG_HOME` is set, it uses `$XDG_CONFIG_HOME/aipal/soul.md`

## Cron jobs file (optional)
Cron jobs live in a separate file:
- `~/.config/aipal/cron.json`
- If `XDG_CONFIG_HOME` is set, it uses `$XDG_CONFIG_HOME/aipal/cron.json`

Schema:
```json
{
  "jobs": [
    {
      "id": "daily-summary",
      "enabled": true,
      "cron": "0 9 * * *",
      "timezone": "Europe/Madrid",
      "prompt": "Dame un resumen del día con mis tareas pendientes."
    }
  ]
}
```

Notes:
- Jobs are only scheduled when `cronChatId` is set in `config.json`.
- Use `/cron reload` after editing `cron.json` to apply changes without restarting the bot.
