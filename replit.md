# Discord Account Manager

A web-based Discord account manager built originally as an Electron desktop app, converted to run as a full-stack web application. Developed by **Ahmed Dev** (`@4_3a`).

## Architecture

- **Backend**: Express.js server (`server.js`) on port 5000 serving both the REST API and static frontend files.
- **Frontend**: Vanilla JS + HTML/CSS with ES modules (`index.html`, `src/`).
- **Discord integration**: `discord.js-selfbot-v13` — maintains a live multi-client pool in server memory (one client per connected token).

### Key Files

- `server.js` — Express server: multi-client pool, anti-detection helpers, all REST endpoints.
- `src/api.js` — Browser-side shim that replaces `window.electronAPI` with fetch calls.
- `src/main.js` — Frontend entry point and page router.
- `src/components/` — UI managers:
  - Friends, Servers, DMs, Groups (legacy)
  - **TokensManager** — multi-account control, presence, bio, status rotation, per-token actions menu
  - **MessagesManager** — send to server channels / all DMs / all groups, multi-message panels, repeat (fast/natural), schedule
  - **ReactionManager** — auto-react with mirror or specific emojis, auto-click buttons by name (server / DM / group / all)
  - **OldManager** (DM/Group) — message cards now include a **Copy Link** button
- `src/utils/` — Helpers: `tokenManager`, `messageDeleter` (parallel + adaptive throttle), `ui` (notifications, modals)
- `src/styles/managers.css` — Styles for the new managers
- `saved_tokens.json` — Persisted Discord tokens (local file)

## Multi-account / anti-detection

- Multiple tokens can be connected at once. The server keeps a `Map<name, client>` and one `activeName`.
- Legacy endpoints use the active client; new endpoints accept an optional `tokens[]` array to fan out actions.
- All sends go through a humanized helper (`sendTyping` + jittered delay) to mimic real users.
- Message deleter uses a small worker pool with global cooldown on 429s.

## Running

```
node server.js
```

The app runs on port 5000. When started outside Replit, it auto-opens the local URL in the default browser.

## Test mode

Type `test` in the login screen to enter offline test mode — credits show "Ahmed (Test)" with a Discord-style avatar so the UI can be explored without a real token.

## Deployment

Uses **VM deployment** (not autoscale) because the Discord clients maintain persistent in-memory state between requests.

## Credits

Developed and maintained by **Ahmed Dev** (`@4_3a`).
