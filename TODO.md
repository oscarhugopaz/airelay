# TODO (Hardening)

Este documento lista acciones de hardening recomendadas para este proyecto. No son cambios realizados: es un checklist para revisar y priorizar.

## P0 (Crítico) — bloquear antes de exponer

- [ ] **Fail-closed si no hay `ALLOWED_USERS`**
  - Estado actual: el bot se niega a arrancar si `ALLOWED_USERS` está vacío (fail-closed).
  - Recomendación: en producción, no arrancar sin `ALLOWED_USERS` salvo que exista un flag explícito de “modo público”.
  - Referencia: [src/index.js](src/index.js#L114-L147)

- [ ] **Revisar/limitar permisos peligrosos en agentes**
  - `codex`: `--yolo` debe ser opt-in.
  - `opencode`: permisos deben default-deny.
  - Recomendación: defaults “safe” + habilitar modo riesgoso solo con env explícita y documentación clara (ya implementado; revisar que docs/ops lo reflejen).
  - Referencias:
    - [src/agents/codex.js](src/agents/codex.js#L4-L33)
    - [src/agents/opencode.js](src/agents/opencode.js#L3-L35)

- [ ] **Hardening de logs/errores para evitar leak de secretos**
  - Riesgo: `console.error(err)` puede imprimir payloads grandes y potencialmente incluir el comando/args (incl. `PROMPT_B64=...`) o stdout/stderr con datos sensibles.
  - Recomendación: loggear solo `err.message`, `err.code`, y un `requestId`; tratar stdout/stderr con redacción/recorte.
  - Zonas relevantes: múltiples `catch` con `console.error(err)` en [src/index.js](src/index.js)

## P1 (Alto) — reducir superficie de DoS / abuso

- [ ] **Limitar tamaño de descargas de Telegram**
  - Estado actual: descarga en streaming a disco con límite de bytes y timeout.
  - Riesgo: DoS por archivos grandes (RAM spike) o descargas lentas.
  - Recomendación: streaming a disco, límite por `Content-Length`/contador de bytes, timeout con `AbortController`.
  - Referencia: [src/index.js](src/index.js#L458-L477)

- [ ] **Limitar concurrencia global**
  - Estado actual: hay cola por chat (`enqueue`), pero sin un límite global entre chats.
  - Riesgo: múltiples chats pueden disparar ejecuciones concurrentes del agente (CPU/RAM) y saturar el host.
  - Recomendación: semáforo global (máx N ejecuciones simultáneas), backpressure y mensajes de “server busy”.
  - Referencia: [src/index.js](src/index.js#L785-L793)

- [ ] **Asegurar timeouts y buffers con valores defensivos**
  - Estado actual: timeouts existen (`AIRELAY_AGENT_TIMEOUT_MS`, `AIRELAY_SCRIPT_TIMEOUT_MS`) y `AGENT_MAX_BUFFER`.
  - Recomendación: documentar defaults, poner límites máximos razonables, y diferenciar timeouts para listados (`/model`) vs ejecuciones largas.
  - Referencia: [src/index.js](src/index.js#L100-L117)

## P2 (Medio) — defensa en profundidad en filesystem

- [ ] **Hacer configurable el directorio de almacenamiento temporal**
  - Problema: hoy se usa `os.tmpdir()` (p.ej. `/var/folders/.../T`) para descargas y adjuntos; es correcto para “temporal”, pero es menos predecible operacionalmente y puede cambiar/limpiarse por el sistema.
  - Recomendación: agregar env var tipo `AIRELAY_STORAGE_DIR` para definir el base dir (default: `path.join(os.tmpdir(), 'airelay')`) y derivar `IMAGE_DIR`/`DOCUMENT_DIR` desde ahí.
  - Nota: mantener validación de rutas (`isPathInside`) y considerar si audios/transcripciones deben seguir siendo efímeros (borrado inmediato) o también configurables.
  - Zonas relevantes: definición de `IMAGE_DIR`/`DOCUMENT_DIR` y `downloadTelegramFile` en [src/index.js](src/index.js)

- [ ] **Endurecer permisos de `SCRIPTS_DIR`**
  - Estado actual: se validan nombre y path del script y se requiere ejecutable (bien), pero el riesgo real es quién puede escribir ahí.
  - Recomendación: owner-only (`0700` o equivalente), usuario dedicado, no permitir escritura por otros usuarios/grupos.
  - Referencias:
    - Validación/ejecución: [src/index.js](src/index.js#L382-L423)
    - Descubrimiento de scripts ejecutables: [src/script-manager.js](src/script-manager.js#L33-L67)

- [ ] **Considerar “feature flags” para capacidades peligrosas**
  - Ejemplos: habilitar scripts, habilitar documentos/imagenes, habilitar cron, habilitar transcripción.
  - Objetivo: poder desplegar con un set mínimo de capacidades y activar gradualmente.

- [ ] **Controlar crecimiento de `threads.json`**
  - Estado actual: se persisten threads por chat y puede crecer sin límite con el tiempo.
  - Recomendación: TTL/expiración, máximo de threads, o rotación.
  - Referencia: [src/config-store.js](src/config-store.js#L61-L88)

## P3 (Bajo) — calidad y robustez

- [ ] **Sanitización/escape en mensajes**
  - Estado actual: `markdownToTelegramHtml` escapa HTML y limita URLs a `http(s)` y `tg://`.
  - Recomendación: mantener esta propiedad; revisar edge-cases (entidades HTML, links malformados) y añadir tests si faltan.
  - Referencia: [src/message-utils.js](src/message-utils.js#L14-L123)

- [ ] **Path hardening (ya bastante bien)**
  - Estado actual: `isPathInside` usa `realpath` (mitiga symlinks) y se valida que imágenes/documentos estén dentro de `IMAGE_DIR`/`DOCUMENT_DIR`.
  - Recomendación: mantener y asegurar que las rutas base no sean symlinks inesperados en runtime.
  - Referencias:
    - `isPathInside`: [src/message-utils.js](src/message-utils.js#L219-L241)
    - Envío de adjuntos: [src/index.js](src/index.js#L705-L784)

## Operacional (deployment) — recomendado si se expone fuera de local

- [ ] **Ejecutar como usuario dedicado sin privilegios**
  - Sin acceso a llaves SSH, tokens adicionales, ni carpetas sensibles.

- [ ] **Aislamiento (contenedor/sandbox) y FS restringido**
  - Permitir solo `~/.config/airelay` y `/tmp/airelay` (y lo estrictamente necesario).

- [ ] **Reducir egress si es posible**
  - Especialmente importante si el agente/CLI puede hacer llamadas de red.

- [ ] **Higiene de secretos**
  - Guardar `TELEGRAM_BOT_TOKEN` como secreto (no en logs), proteger `.env` y backups.

## Estado de dependencias

- [x] `npm audit --omit=dev`: 0 vulnerabilidades encontradas (a fecha 2026-01-31).
