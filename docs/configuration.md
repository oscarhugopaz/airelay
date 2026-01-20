# Configuration (config.json + memory.md + soul.md)

This bot stores a minimal JSON config with the values set by `/agent`.

## Location
- `~/.config/aipal/config.json`
- If `XDG_CONFIG_HOME` is set, it uses `$XDG_CONFIG_HOME/aipal/config.json`

## Schema
```json
{
  "agent": "codex"
}
```

## Fields
- `agent`: which CLI to run (`codex`, `claude`, or `gemini`).

If the file is missing, both values are unset and the bot uses agent defaults.

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
