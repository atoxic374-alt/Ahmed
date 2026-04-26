# Discord Account Manager

A web-based Discord account manager built originally as an Electron desktop app, converted to run as a full-stack web application. Developed by **Ahmed Dev**.

## Architecture

- **Backend**: Express.js server (`server.js`) on port 5000 serving both the REST API and static frontend files
- **Frontend**: Vanilla JS + HTML/CSS with ES modules (`index.html`, `src/`)
- **Discord integration**: `discord.js-selfbot-v13` — maintains a live Discord client connection in server memory

### Key Files

- `server.js` — Express server with all Discord API endpoints
- `src/api.js` — Browser-side shim that replaces `window.electronAPI` (Electron IPC) with fetch API calls
- `src/main.js` — Frontend entry point
- `src/components/` — UI managers for Friends, Servers, DMs, Groups
- `src/utils/` — Helper utilities (tokenManager, messageDeleter, etc.)
- `src/styles/` — CSS files
- `saved_tokens.json` — Persisted Discord tokens (local file)

## Running

```
node server.js
```

The app runs on port 5000.

## Conversion from Electron

The original app used Electron IPC via `window.electronAPI`. This was replaced with:
1. A REST API in `server.js` mirroring all IPC handlers
2. A browser shim in `src/api.js` that implements `window.electronAPI` using `fetch()`

## Deployment

Uses VM deployment target (not autoscale) because the Discord client maintains persistent in-memory state between requests.

## Credits

Developed and maintained by **Ahmed Dev**.
