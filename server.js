const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 5000);
const DATA_DIR = path.join(__dirname, '.data');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DISCORD_API = 'https://discord.com/api/v10';

const PresenceUpdateStatus = {
  Online: 'online',
  Idle: 'idle',
  DoNotDisturb: 'dnd',
  Invisible: 'invisible'
};

const DEFAULT_SETTINGS = {
  token: '',
  autoReconnect: false,
  presence: {
    enabled: false,
    status: PresenceUpdateStatus.Online,
    streamName: 'Designing a neon Discord dashboard',
    streamUrl: 'https://twitch.tv/discord',
    state: 'لوحة بث آمنة ✨'
  },
  lastAppliedAt: null
};

let gateway = null;
let heartbeatTimer = null;
let sequence = null;
let clientInfo = null;
let connectionState = 'offline';
let lastError = null;
let activeToken = '';

fs.mkdirSync(DATA_DIR, { recursive: true });

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...clone(DEFAULT_SETTINGS),
      ...parsed,
      presence: { ...clone(DEFAULT_SETTINGS.presence), ...(parsed.presence || {}) }
    };
  } catch {
    return clone(DEFAULT_SETTINGS);
  }
}

function writeSettings(nextSettings) {
  const safe = {
    ...clone(DEFAULT_SETTINGS),
    ...nextSettings,
    presence: { ...clone(DEFAULT_SETTINGS.presence), ...(nextSettings.presence || {}) }
  };
  fs.writeFileSync(SETTINGS_PATH, `${JSON.stringify(safe, null, 2)}\n`, 'utf8');
  return safe;
}

function publicSettings(settings = readSettings()) {
  return {
    autoReconnect: Boolean(settings.autoReconnect),
    hasToken: Boolean(settings.token),
    tokenPreview: settings.token ? `${settings.token.slice(0, 7)}••••${settings.token.slice(-5)}` : '',
    presence: settings.presence,
    lastAppliedAt: settings.lastAppliedAt
  };
}

function cleanToken(token) {
  return String(token || '').trim().replace(/^Bot\s+/i, '');
}

function authHeader(token) {
  return `Bot ${cleanToken(token)}`;
}

function isSupportedStreamingUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return ['twitch.tv', 'youtube.com', 'youtu.be'].some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function normalizePresence(input = {}) {
  const statusValues = new Set(Object.values(PresenceUpdateStatus));
  const next = {
    enabled: Boolean(input.enabled),
    status: statusValues.has(input.status) ? input.status : PresenceUpdateStatus.Online,
    streamName: String(input.streamName || DEFAULT_SETTINGS.presence.streamName).trim().slice(0, 128),
    streamUrl: String(input.streamUrl || DEFAULT_SETTINGS.presence.streamUrl).trim(),
    state: String(input.state || '').trim().slice(0, 128)
  };

  if (next.enabled && !isSupportedStreamingUrl(next.streamUrl)) {
    throw new Error('Streaming URL must be a Twitch or YouTube URL supported by Discord.');
  }

  if (!next.streamName) {
    throw new Error('Streaming name is required.');
  }

  return next;
}

function buildActivities(presence) {
  if (!presence.enabled) return [];
  return [{
    name: presence.streamName,
    type: 1,
    url: presence.streamUrl,
    state: presence.state || undefined
  }];
}

function gatewayPayload(op, d) {
  return JSON.stringify({ op, d });
}

function sendPresence(presence = readSettings().presence) {
  if (!gateway || gateway.readyState !== WebSocket.OPEN) return;
  gateway.send(gatewayPayload(3, {
    since: null,
    activities: buildActivities(presence),
    status: presence.status,
    afk: false
  }));
}

async function discordFetch(endpoint, token) {
  const response = await fetch(`${DISCORD_API}${endpoint}`, {
    headers: { Authorization: authHeader(token), 'User-Agent': 'DiscordPresenceStudio/1.0' }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `Discord API error ${response.status}`);
  }
  return payload;
}

function avatarUrl(user) {
  if (!user?.avatar) return '/discord-mark.svg';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

async function updateClientInfo(token) {
  const user = await discordFetch('/users/@me', token);
  clientInfo = {
    id: user.id,
    tag: user.discriminator && user.discriminator !== '0' ? `${user.username}#${user.discriminator}` : user.username,
    username: user.username,
    avatar: avatarUrl(user)
  };
  return clientInfo;
}

async function getGatewayUrl(token) {
  const payload = await discordFetch('/gateway/bot', token);
  return `${payload.url}/?v=10&encoding=json`;
}

function clearHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

async function disconnectClient() {
  clearHeartbeat();
  if (gateway) {
    try { gateway.close(1000, 'Local disconnect'); } catch {}
  }
  gateway = null;
  sequence = null;
  clientInfo = null;
  activeToken = '';
  connectionState = 'offline';
}

async function connectBot(token) {
  const finalToken = cleanToken(token);
  if (!finalToken) throw new Error('A Discord bot token is required.');

  await disconnectClient();
  connectionState = 'connecting';
  lastError = null;
  activeToken = finalToken;
  await updateClientInfo(finalToken);
  const gatewayUrl = await getGatewayUrl(finalToken);

  await new Promise((resolve, reject) => {
    let settled = false;
    gateway = new WebSocket(gatewayUrl);

    const fail = (error) => {
      lastError = error.message || String(error);
      connectionState = 'offline';
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    gateway.addEventListener('message', (event) => {
      try {
        const packet = JSON.parse(event.data);
        if (packet.s !== null && packet.s !== undefined) sequence = packet.s;

        if (packet.op === 10) {
          clearHeartbeat();
          heartbeatTimer = setInterval(() => {
            if (gateway?.readyState === WebSocket.OPEN) gateway.send(gatewayPayload(1, sequence));
          }, packet.d.heartbeat_interval);

          gateway.send(gatewayPayload(2, {
            token: finalToken,
            intents: 0,
            properties: { os: process.platform, browser: 'Discord Presence Studio', device: 'Discord Presence Studio' },
            presence: {
              since: null,
              activities: buildActivities(readSettings().presence),
              status: readSettings().presence.status,
              afk: false
            }
          }));
        }

        if (packet.t === 'READY') {
          connectionState = 'online';
          if (!settled) {
            settled = true;
            resolve();
          }
        }

        if (packet.op === 9) fail(new Error('Discord rejected the gateway session.'));
      } catch (error) {
        fail(error);
      }
    });

    gateway.addEventListener('error', () => fail(new Error('Discord gateway connection failed.')));
    gateway.addEventListener('close', (event) => {
      clearHeartbeat();
      if (connectionState !== 'offline') connectionState = 'offline';
      if (!settled) fail(new Error(`Discord gateway closed before ready (${event.code}).`));
    });

    setTimeout(() => {
      if (!settled) fail(new Error('Discord gateway connection timed out.'));
    }, 15000);
  });

  return clientInfo;
}

async function applyPresence(presence = readSettings().presence) {
  sendPresence(presence);
}

function statusPayload() {
  return {
    success: true,
    connectionState,
    bot: clientInfo,
    lastError,
    settings: publicSettings()
  };
}

function json(res, payload, status = 200) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function sendError(res, error, status = 400) {
  const message = error?.message || String(error);
  lastError = message;
  json(res, { success: false, error: message }, status);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
  }[ext] || 'application/octet-stream';
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackError, fallbackData) => {
        if (fallbackError) res.writeHead(404).end('Not found');
        else res.writeHead(200, { 'Content-Type': contentType('index.html') }).end(fallbackData);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const route = `${req.method} ${parsedUrl.pathname}`;

    if (route === 'GET /api/status') return json(res, statusPayload());

    if (route === 'POST /api/connect') {
      const body = await readJson(req);
      const settings = readSettings();
      const token = cleanToken(body.token || settings.token || '');
      const autoReconnect = Boolean(body.autoReconnect ?? settings.autoReconnect);
      const saveToken = body.saveToken !== false;
      const bot = await connectBot(token);
      writeSettings({ ...settings, token: saveToken ? token : settings.token, autoReconnect });
      return json(res, { ...statusPayload(), bot });
    }

    if (route === 'POST /api/disconnect') {
      await disconnectClient();
      return json(res, statusPayload());
    }

    if (route === 'POST /api/settings') {
      const body = await readJson(req);
      const current = readSettings();
      const presence = normalizePresence(body.presence || current.presence);
      const settings = writeSettings({
        ...current,
        autoReconnect: Boolean(body.autoReconnect ?? current.autoReconnect),
        presence,
        lastAppliedAt: new Date().toISOString()
      });
      await applyPresence(settings.presence);
      return json(res, statusPayload());
    }

    if (route === 'POST /api/stop-streaming') {
      const current = readSettings();
      const presence = { ...current.presence, enabled: false };
      const settings = writeSettings({ ...current, presence, lastAppliedAt: new Date().toISOString() });
      await applyPresence(settings.presence);
      return json(res, statusPayload());
    }

    if (route === 'POST /api/clear-token') {
      const current = readSettings();
      writeSettings({ ...current, token: '', autoReconnect: false });
      return json(res, statusPayload());
    }

    return serveStatic(req, res, parsedUrl.pathname);
  } catch (error) {
    return sendError(res, error, 400);
  }
});

server.listen(PORT, async () => {
  console.log(`Discord Presence Studio running at http://localhost:${PORT}`);
  const settings = readSettings();
  if (settings.autoReconnect && settings.token) {
    try {
      await connectBot(settings.token);
      console.log('Auto-reconnected to Discord bot account.');
    } catch (error) {
      lastError = error.message;
      console.error(`Auto reconnect failed: ${error.message}`);
    }
  }
});
