# Configuration (config.json + memory.md + soul.md + cron.json)

This bot stores a minimal JSON config with the values set by `/agent`.

## Location
- `~/.config/airelay/config.json`
- If `XDG_CONFIG_HOME` is set, it uses `$XDG_CONFIG_HOME/airelay/config.json`

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
- `agent`: which CLI to run (`codex` or `opencode`).
- `models` (optional): a map of agent id → model id, set via `/model`.
- `cronChatId` (optional): Telegram chat id used for cron job messages. You can get it from `/cron chatid`.

If the file is missing, all values are unset and the bot uses defaults.

## Environment variables
- `ALLOWED_USERS` (recommended): comma-separated list of Telegram user IDs allowed to use the bot. If unset/empty, the bot refuses to start (safer default).
- `AIRELAY_ALLOW_OPEN_BOT` (optional): set to `true` to allow starting without `ALLOWED_USERS` (NOT recommended).
- `AIRELAY_DOWNLOAD_TIMEOUT_MS` (optional): timeout for Telegram file downloads in ms (default: 60000).
- `AIRELAY_MAX_DOWNLOAD_BYTES` (optional): max Telegram file download size in bytes (default: 26214400).
- `AIRELAY_CODEX_YOLO` (optional): set to `true` to enable Codex `--yolo`.
- `AIRELAY_OPENCODE_PERMISSION` (optional): JSON string with OpenCode permissions (defaults to deny).
- `AIRELAY_OPENCODE_ALLOW_ALL` (optional): set to `true` to force allow-all OpenCode permissions.

## Memory file (optional)
If `memory.md` exists alongside `config.json`, its contents are injected into the very first prompt of a new conversation (i.e. when there is no active session/thread).

Location:
- `~/.config/airelay/memory.md`
- If `XDG_CONFIG_HOME` is set, it uses `$XDG_CONFIG_HOME/airelay/memory.md`

## Soul file (optional)
If `soul.md` exists alongside `config.json`, its contents are injected into the very first prompt of a new conversation, before `memory.md`.

Location:
- `~/.config/airelay/soul.md`
- If `XDG_CONFIG_HOME` is set, it uses `$XDG_CONFIG_HOME/airelay/soul.md`

## Cron jobs file (optional)
Cron jobs live in a separate file:
- `~/.config/airelay/cron.json`
- If `XDG_CONFIG_HOME` is set, it uses `$XDG_CONFIG_HOME/airelay/cron.json`

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

You can also create and manage jobs from chat via `/cron add`, `/cron remove`, `/cron enable`, and `/cron disable`.
