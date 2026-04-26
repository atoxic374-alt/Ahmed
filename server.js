const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');
const { Client, RichPresence, CustomStatus } = require('discord.js-selfbot-v13');

const app = express();
const PORT = 5000;

app.use(express.json({ limit: '10mb' }));

// Default Discord-style avatar (used as fallback)
const DEFAULT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="32" fill="#5865F2"/>
  <path fill="#fff" d="M44.6 19.5c-2.3-1-4.7-1.8-7.3-2.2-.3.6-.7 1.4-1 2-2.7-.4-5.4-.4-8 0-.3-.6-.7-1.4-1-2-2.5.5-5 1.3-7.3 2.3-4.6 6.9-5.8 13.6-5.2 20.2 3.1 2.3 6 3.7 8.9 4.6.7-1 1.4-2 1.9-3.1-1.1-.4-2.1-.9-3.1-1.5.3-.2.5-.4.8-.6 5.9 2.7 12.4 2.7 18.3 0 .3.2.5.4.8.6-1 .6-2 1.1-3.1 1.5.6 1.1 1.2 2.1 1.9 3.1 2.9-.9 5.8-2.3 8.9-4.6.7-7.7-1.2-14.3-5.2-20.2zM25.4 36.1c-1.8 0-3.2-1.6-3.2-3.6s1.4-3.6 3.2-3.6 3.3 1.6 3.2 3.6c0 2-1.4 3.6-3.2 3.6zm13.1 0c-1.8 0-3.2-1.6-3.2-3.6s1.4-3.6 3.2-3.6 3.3 1.6 3.2 3.6c0 2-1.4 3.6-3.2 3.6z"/>
</svg>`;
app.get('/discord.png', (req, res) => {
  res.set('Content-Type', 'image/svg+xml').send(DEFAULT_AVATAR_SVG);
});
app.get('/favicon.ico', (req, res) => {
  res.set('Content-Type', 'image/svg+xml').send(DEFAULT_AVATAR_SVG);
});

app.use(express.static(path.join(__dirname)));

const tokensPath = path.join(__dirname, 'saved_tokens.json');
if (!fs.existsSync(tokensPath)) {
  fs.writeFileSync(tokensPath, '[]', 'utf8');
}

// ───────────────────────────────────────────────
// Multi-token client pool
// ───────────────────────────────────────────────
const clients = new Map();              // name -> { client, token, name }
let activeName = null;                  // name of the active client
let discordClient = null;               // alias to active client (for legacy endpoints)

function getActive() { return discordClient; }
function getClientByName(name) {
  const entry = clients.get(name);
  return entry ? entry.client : null;
}
function setActive(name) {
  const entry = clients.get(name);
  if (!entry) return false;
  activeName = name;
  discordClient = entry.client;
  return true;
}

// ───────────────────────────────────────────────
// Anti-detection helpers
// ───────────────────────────────────────────────
function jitter(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function humanizedSend(channel, text, { typing = true } = {}) {
  if (typing && channel.sendTyping) {
    try {
      await channel.sendTyping();
      // typing speed ~ 4-7 chars/sec; cap at 4s
      const delay = Math.min(4000, Math.max(600, text.length * jitter(120, 200)));
      await sleep(delay);
    } catch (e) {}
  }
  return channel.send(text);
}

// Standardized error handler
function ok(res, payload = {}) { res.json({ success: true, ...payload }); }
function fail(res, err) {
  const msg = err?.response?.data?.message || err?.message || String(err);
  res.json({ success: false, error: msg });
}

// ═══════════════════════════════════════════════
//  CONNECT / DISCONNECT (multi-token aware)
// ═══════════════════════════════════════════════

async function connectOne(token, name) {
  const finalName = (name || `acc_${clients.size + 1}`).trim();
  if (clients.has(finalName)) {
    // disconnect previous before re-binding name
    try { await clients.get(finalName).client.destroy(); } catch (e) {}
    clients.delete(finalName);
  }
  const client = new Client({ checkUpdate: false, fetchAllMembers: false });
  await client.login(token);
  clients.set(finalName, { client, token, name: finalName });
  if (!activeName) setActive(finalName);
  return { name: finalName, username: client.user.tag, id: client.user.id };
}

app.post('/api/discord/connect', async (req, res) => {
  try {
    const { token, name } = req.body;
    const info = await connectOne(token, name);
    setActive(info.name);
    ok(res, { username: info.username, name: info.name, id: info.id });
  } catch (e) { fail(res, e); }
});

app.post('/api/discord/disconnect', async (req, res) => {
  try {
    if (discordClient && activeName) {
      try { await discordClient.destroy(); } catch (e) {}
      clients.delete(activeName);
      activeName = null;
      discordClient = null;
      // promote first remaining client
      const next = clients.keys().next().value;
      if (next) setActive(next);
    }
    ok(res);
  } catch (e) { fail(res, e); }
});

app.post('/api/discord/disconnect-all', async (req, res) => {
  try {
    for (const [n, entry] of clients.entries()) {
      try { await entry.client.destroy(); } catch (e) {}
    }
    clients.clear();
    discordClient = null;
    activeName = null;
    ok(res);
  } catch (e) { fail(res, e); }
});

app.get('/api/discord/clients', (req, res) => {
  const list = Array.from(clients.entries()).map(([name, e]) => ({
    name,
    username: e.client.user?.tag || null,
    id: e.client.user?.id || null,
    avatar: e.client.user?.displayAvatarURL?.() || null,
    status: e.client.user?.presence?.status || 'unknown',
    active: name === activeName
  }));
  ok(res, { clients: list, active: activeName });
});

app.post('/api/discord/active', (req, res) => {
  const { name } = req.body;
  if (setActive(name)) return ok(res, { active: activeName });
  fail(res, new Error('Client not found'));
});

// Auto-connect saved tokens that are flagged autoConnect
async function autoConnectSaved() {
  try {
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    for (const t of tokens) {
      if (t.autoConnect) {
        try {
          await connectOne(t.token, t.name);
          console.log(`[auto-connect] ${t.name} ✓`);
        } catch (e) {
          console.log(`[auto-connect] ${t.name} ✗ ${e.message}`);
        }
      }
    }
  } catch (e) {}
}

// ═══════════════════════════════════════════════
//  FRIENDS
// ═══════════════════════════════════════════════
app.get('/api/discord/friends', async (req, res) => {
  try {
    if (!discordClient?.token) return fail(res, new Error('Not connected to Discord'));
    const r = await axios.get('https://discord.com/api/v9/users/@me/relationships', {
      headers: { Authorization: discordClient.token }
    });
    const friends = r.data.filter(x => x.type === 1).map(f => ({
      id: f.user.id,
      username: f.user.username,
      displayName: f.user.global_name || f.user.username,
      avatar: f.user.avatar
        ? `https://cdn.discordapp.com/avatars/${f.user.id}/${f.user.avatar}.png`
        : '/discord.png'
    }));
    ok(res, { friends });
  } catch (e) { fail(res, e); }
});

app.delete('/api/discord/friends/:friendId', async (req, res) => {
  try {
    if (!discordClient?.token) return fail(res, new Error('Not connected'));
    await axios.delete(`https://discord.com/api/v9/users/@me/relationships/${req.params.friendId}`, {
      headers: { Authorization: discordClient.token, 'Content-Type': 'application/json' }
    });
    ok(res);
  } catch (e) { fail(res, e); }
});

// ═══════════════════════════════════════════════
//  SERVERS
// ═══════════════════════════════════════════════
app.get('/api/discord/servers', async (req, res) => {
  try {
    if (!discordClient?.guilds) return fail(res, new Error('Not connected'));
    const servers = Array.from(discordClient.guilds.cache.values())
      .filter(s => s && s.ownerId !== discordClient.user.id)
      .map(s => ({ id: s.id, name: s.name, icon: s.iconURL() || '/discord.png' }));
    ok(res, { servers });
  } catch (e) { fail(res, e); }
});

app.get('/api/discord/servers/:serverId/channels', async (req, res) => {
  try {
    if (!discordClient?.token) return fail(res, new Error('Not connected'));
    const r = await axios.get(`https://discord.com/api/v9/guilds/${req.params.serverId}/channels`, {
      headers: { Authorization: discordClient.token }
    });
    const channels = r.data
      .filter(c => c.type === 0 || c.type === 5) // text + announcement
      .map(c => ({ id: c.id, name: c.name, parent: c.parent_id }));
    ok(res, { channels });
  } catch (e) { fail(res, e); }
});

app.post('/api/discord/servers/:serverId/leave', async (req, res) => {
  try {
    if (!discordClient?.guilds) return fail(res, new Error('Not connected'));
    const guild = discordClient.guilds.cache.get(req.params.serverId);
    if (!guild) return fail(res, new Error('Server not found'));
    await guild.leave();
    ok(res);
  } catch (e) { fail(res, e); }
});

app.post('/api/discord/servers/:serverId/mute', async (req, res) => {
  try {
    if (!discordClient?.token) return fail(res, new Error('Not connected'));
    await axios.patch(`https://discord.com/api/v9/users/@me/guilds/${req.params.serverId}/settings`,
      { muted: true },
      { headers: { Authorization: discordClient.token, 'Content-Type': 'application/json' } });
    ok(res);
  } catch (e) { fail(res, e); }
});

app.post('/api/discord/servers/:serverId/unmute', async (req, res) => {
  try {
    if (!discordClient?.token) return fail(res, new Error('Not connected'));
    await axios.patch(`https://discord.com/api/v9/users/@me/guilds/${req.params.serverId}/settings`,
      { muted: false },
      { headers: { Authorization: discordClient.token, 'Content-Type': 'application/json' } });
    ok(res);
  } catch (e) { fail(res, e); }
});

app.post('/api/discord/read-all', async (req, res) => {
  try {
    if (!discordClient?.token) return fail(res, new Error('Not connected'));
    const guilds = Array.from(discordClient.guilds.cache.values());
    for (const g of guilds) { try { await g.markAsRead(); } catch (e) {} }
    ok(res);
  } catch (e) { fail(res, e); }
});

// ═══════════════════════════════════════════════
//  DMs
// ═══════════════════════════════════════════════
app.get('/api/discord/dms', async (req, res) => {
  try {
    if (!discordClient?.user) return fail(res, new Error('Not connected'));
    const dms = Array.from(discordClient.channels.cache.values())
      .filter(c => c.type === 'DM')
      .map(d => ({
        id: d.id,
        username: d.recipient?.username || 'Unknown',
        displayName: d.recipient?.globalName || d.recipient?.username || 'Unknown',
        avatar: d.recipient?.avatarURL() || '/discord.png'
      }));
    ok(res, { dms });
  } catch (e) { fail(res, e); }
});

app.get('/api/discord/dms/:channelId/messages', async (req, res) => {
  try {
    if (!discordClient?.user) return fail(res, new Error('Not connected'));
    const channel = await discordClient.channels.fetch(req.params.channelId);
    if (!channel || channel.type !== 'DM') return fail(res, new Error('Invalid DM channel'));
    const { before } = req.query;
    const opts = before ? { before, limit: 100 } : { limit: 100 };
    const msgs = await channel.messages.fetch(opts);
    res.json({
      success: true,
      currentUserId: discordClient.user.id,
      messages: Array.from(msgs.values()).map(m => ({
        id: m.id,
        content: m.content,
        isDeletable: m.author.id === discordClient.user.id && !m.system,
        author: { id: m.author.id }
      }))
    });
  } catch (e) { fail(res, e); }
});

app.delete('/api/discord/dms/:channelId/messages/:messageId', async (req, res) => {
  try {
    if (!discordClient?.user) return fail(res, new Error('Not connected'));
    const channel = await discordClient.channels.fetch(req.params.channelId);
    if (!channel || channel.type !== 'DM') return fail(res, new Error('Invalid DM channel'));
    const m = await channel.messages.fetch(req.params.messageId);
    await m.delete();
    ok(res);
  } catch (e) { fail(res, e); }
});

app.post('/api/discord/dms/:channelId/close', async (req, res) => {
  try {
    if (!discordClient?.user) return fail(res, new Error('Not connected'));
    const channel = await discordClient.channels.fetch(req.params.channelId);
    if (!channel || channel.type !== 'DM') return fail(res, new Error('Invalid DM channel'));
    await channel.delete();
    ok(res);
  } catch (e) { fail(res, e); }
});

// ═══════════════════════════════════════════════
//  GROUPS
// ═══════════════════════════════════════════════
app.get('/api/discord/groups', async (req, res) => {
  try {
    if (!discordClient?.user) return fail(res, new Error('Not connected'));
    const groups = Array.from(discordClient.channels.cache.values())
      .filter(c => c.type === 'GROUP_DM')
      .map(g => ({
        id: g.id,
        name: g.name || 'Unnamed Group',
        icon: g.iconURL() || '/discord.png',
        recipients: g.recipients.size
      }));
    ok(res, { groups });
  } catch (e) { fail(res, e); }
});

app.post('/api/discord/groups/:groupId/leave', async (req, res) => {
  try {
    if (!discordClient?.user) return fail(res, new Error('Not connected'));
    const g = await discordClient.channels.fetch(req.params.groupId);
    if (!g || g.type !== 'GROUP_DM') return fail(res, new Error('Invalid group'));
    await g.delete();
    ok(res);
  } catch (e) { fail(res, e); }
});

app.get('/api/discord/groups/:channelId/messages', async (req, res) => {
  try {
    if (!discordClient?.token) return fail(res, new Error('Not connected'));
    const { before } = req.query;
    const url = `https://discord.com/api/v9/channels/${req.params.channelId}/messages?limit=100${before ? `&before=${before}` : ''}`;
    const r = await axios.get(url, {
      headers: { Authorization: discordClient.token, 'Content-Type': 'application/json' }
    });
    res.json({
      success: true,
      currentUserId: discordClient.user.id,
      messages: r.data.map(m => ({ id: m.id, content: m.content, author: { id: m.author.id } }))
    });
  } catch (e) { fail(res, e); }
});

app.delete('/api/discord/groups/:channelId/messages/:messageId', async (req, res) => {
  try {
    if (!discordClient?.token) return fail(res, new Error('Not connected'));
    await axios.delete(`https://discord.com/api/v9/channels/${req.params.channelId}/messages/${req.params.messageId}`, {
      headers: { Authorization: discordClient.token, 'Content-Type': 'application/json' }
    });
    ok(res);
  } catch (e) { fail(res, e); }
});

// ═══════════════════════════════════════════════
//  TOKEN STORAGE (saved tokens with autoConnect)
// ═══════════════════════════════════════════════
function readTokens() { return JSON.parse(fs.readFileSync(tokensPath, 'utf8')); }
function writeTokens(arr) { fs.writeFileSync(tokensPath, JSON.stringify(arr, null, 2)); }

app.get('/api/tokens', (req, res) => {
  try {
    const tokens = readTokens();
    // Mark which are connected
    const enriched = tokens.map(t => ({
      ...t,
      connected: clients.has(t.name)
    }));
    ok(res, { tokens: enriched });
  } catch (e) { fail(res, e); }
});

app.post('/api/tokens', (req, res) => {
  try {
    const { name, token, autoConnect = false } = req.body;
    const tokens = readTokens();
    if (tokens.some(t => t.name === name)) {
      return fail(res, new Error('A token with this name already exists'));
    }
    tokens.push({ name, token, autoConnect: !!autoConnect });
    writeTokens(tokens);
    ok(res);
  } catch (e) { fail(res, e); }
});

app.patch('/api/tokens/:name', (req, res) => {
  try {
    const tokens = readTokens();
    const idx = tokens.findIndex(t => t.name === req.params.name);
    if (idx === -1) return fail(res, new Error('Token not found'));
    tokens[idx] = { ...tokens[idx], ...req.body };
    writeTokens(tokens);
    ok(res);
  } catch (e) { fail(res, e); }
});

app.delete('/api/tokens/:name', (req, res) => {
  try {
    const tokens = readTokens().filter(t => t.name !== req.params.name);
    writeTokens(tokens);
    ok(res);
  } catch (e) { fail(res, e); }
});

// Connect a saved token (without putting it as the active one if there is one already)
app.post('/api/tokens/:name/connect', async (req, res) => {
  try {
    const t = readTokens().find(x => x.name === req.params.name);
    if (!t) return fail(res, new Error('Token not found'));
    const info = await connectOne(t.token, t.name);
    ok(res, info);
  } catch (e) { fail(res, e); }
});

app.post('/api/tokens/:name/disconnect', async (req, res) => {
  try {
    const entry = clients.get(req.params.name);
    if (!entry) return fail(res, new Error('Not connected'));
    try { await entry.client.destroy(); } catch (e) {}
    clients.delete(req.params.name);
    if (activeName === req.params.name) {
      activeName = null;
      discordClient = null;
      const next = clients.keys().next().value;
      if (next) setActive(next);
    }
    ok(res);
  } catch (e) { fail(res, e); }
});

// ═══════════════════════════════════════════════
//  PRESENCE / STATUS / BIO
// ═══════════════════════════════════════════════
const statusRotations = new Map();   // name -> intervalId

function resolvePresence(s) {
  const v = String(s || '').toLowerCase();
  if (['online','idle','dnd','invisible','offline'].includes(v)) return v === 'offline' ? 'invisible' : v;
  return 'online';
}

app.post('/api/presence/set', async (req, res) => {
  try {
    const { tokens = [], status, customStatus, activity, emoji } = req.body;
    const targets = (tokens.length ? tokens : (activeName ? [activeName] : []));
    const results = [];
    for (const n of targets) {
      const c = getClientByName(n);
      if (!c) { results.push({ name: n, ok: false, error: 'not connected' }); continue; }
      try {
        if (status) c.user.setStatus(resolvePresence(status));
        if (customStatus !== undefined) {
          const cs = new CustomStatus(c).setState(customStatus || null);
          if (emoji) cs.setEmoji(emoji);
          c.user.setActivity(cs.toJSON ? cs.toJSON() : cs);
        }
        if (activity) {
          // activity: { name, type } - 0 playing, 1 streaming, 2 listening, 3 watching, 5 competing
          c.user.setActivity(activity.name, { type: activity.type || 0 });
        }
        results.push({ name: n, ok: true });
      } catch (e) { results.push({ name: n, ok: false, error: e.message }); }
    }
    ok(res, { results });
  } catch (e) { fail(res, e); }
});

app.post('/api/presence/bio', async (req, res) => {
  try {
    const { tokens = [], bio = '' } = req.body;
    const targets = (tokens.length ? tokens : (activeName ? [activeName] : []));
    const results = [];
    for (const n of targets) {
      const entry = clients.get(n);
      if (!entry) { results.push({ name: n, ok: false, error: 'not connected' }); continue; }
      try {
        await axios.patch('https://discord.com/api/v9/users/@me/profile',
          { bio },
          { headers: { Authorization: entry.client.token, 'Content-Type': 'application/json' } });
        results.push({ name: n, ok: true });
      } catch (e) { results.push({ name: n, ok: false, error: e.response?.data?.message || e.message }); }
      await sleep(jitter(300, 800));
    }
    ok(res, { results });
  } catch (e) { fail(res, e); }
});

// Status rotation
app.post('/api/presence/rotate/start', (req, res) => {
  try {
    const { tokens = [], states = [], intervalMs = 60000 } = req.body;
    if (!states.length) return fail(res, new Error('No states provided'));
    const targets = (tokens.length ? tokens : (activeName ? [activeName] : []));
    for (const n of targets) {
      if (statusRotations.has(n)) clearInterval(statusRotations.get(n));
      let i = 0;
      const tick = async () => {
        const c = getClientByName(n);
        if (!c) return;
        const s = states[i % states.length]; i++;
        try {
          if (s.status) c.user.setStatus(resolvePresence(s.status));
          if (s.customStatus !== undefined) {
            const cs = new CustomStatus(c).setState(s.customStatus || null);
            if (s.emoji) cs.setEmoji(s.emoji);
            c.user.setActivity(cs.toJSON ? cs.toJSON() : cs);
          }
        } catch (e) {}
      };
      tick();
      const id = setInterval(tick, Math.max(15000, intervalMs)); // min 15s to be safe
      statusRotations.set(n, id);
    }
    ok(res, { rotating: targets });
  } catch (e) { fail(res, e); }
});

app.post('/api/presence/rotate/stop', (req, res) => {
  try {
    const { tokens = [] } = req.body;
    const targets = (tokens.length ? tokens : Array.from(statusRotations.keys()));
    for (const n of targets) {
      const id = statusRotations.get(n);
      if (id) { clearInterval(id); statusRotations.delete(n); }
    }
    ok(res, { stopped: targets });
  } catch (e) { fail(res, e); }
});

// ═══════════════════════════════════════════════
//  MESSAGES MANAGER (send / repeat / schedule)
// ═══════════════════════════════════════════════
const messageJobs = new Map(); // jobId -> { type, timer, info }
let jobCounter = 1;

async function resolveTargets(client, scope) {
  // scope: { type: 'channel'|'all_channels'|'all_dms'|'all_groups', serverId?, channelIds?[] }
  if (!client) return [];
  const out = [];
  if (scope.type === 'channel' && scope.channelIds?.length) {
    for (const id of scope.channelIds) {
      try { out.push(await client.channels.fetch(id)); } catch (e) {}
    }
  } else if (scope.type === 'all_channels' && scope.serverId) {
    try {
      const r = await axios.get(`https://discord.com/api/v9/guilds/${scope.serverId}/channels`, {
        headers: { Authorization: client.token }
      });
      const ids = r.data.filter(c => c.type === 0 || c.type === 5).map(c => c.id);
      for (const id of ids) {
        try { out.push(await client.channels.fetch(id)); } catch (e) {}
      }
    } catch (e) {}
  } else if (scope.type === 'all_dms') {
    out.push(...Array.from(client.channels.cache.values()).filter(c => c.type === 'DM'));
  } else if (scope.type === 'all_groups') {
    out.push(...Array.from(client.channels.cache.values()).filter(c => c.type === 'GROUP_DM'));
  }
  return out.filter(Boolean);
}

async function executeSend({ tokens, scope, messages, mode }) {
  // mode: { type: 'fast'|'natural', perMessageDelayMs?, betweenMessagesMs? }
  const targets = (tokens?.length ? tokens : (activeName ? [activeName] : []));
  const results = [];
  for (const tName of targets) {
    const client = getClientByName(tName);
    if (!client) { results.push({ token: tName, ok: false, error: 'not connected' }); continue; }
    const channels = await resolveTargets(client, scope);
    for (const ch of channels) {
      for (const text of messages) {
        try {
          if (mode?.type === 'natural') {
            await humanizedSend(ch, text);
          } else {
            await ch.send(text);
          }
          results.push({ token: tName, channel: ch.id, ok: true });
        } catch (e) {
          results.push({ token: tName, channel: ch.id, ok: false, error: e.message });
        }
        // gap between messages
        const gap = mode?.type === 'natural'
          ? jitter(1500, 3500)
          : (mode?.perMessageDelayMs ?? 800);
        await sleep(gap);
      }
      // gap between channels
      await sleep(jitter(400, 900));
    }
  }
  return results;
}

app.post('/api/messages/send', async (req, res) => {
  try {
    const { tokens = [], scope, messages = [], mode = { type: 'natural' } } = req.body;
    if (!scope || !messages.length) return fail(res, new Error('scope and messages required'));
    const results = await executeSend({ tokens, scope, messages, mode });
    ok(res, { results });
  } catch (e) { fail(res, e); }
});

app.post('/api/messages/repeat/start', (req, res) => {
  try {
    const { tokens = [], scope, messages = [], mode = { type: 'natural' }, intervalMs = 60000, count = 0 } = req.body;
    if (!scope || !messages.length) return fail(res, new Error('scope and messages required'));
    const id = String(jobCounter++);
    let runs = 0;
    const tick = async () => {
      runs++;
      try { await executeSend({ tokens, scope, messages, mode }); } catch (e) {}
      if (count > 0 && runs >= count) {
        const job = messageJobs.get(id);
        if (job?.timer) clearInterval(job.timer);
        messageJobs.delete(id);
      }
    };
    tick();
    const timer = setInterval(tick, Math.max(2000, intervalMs));
    messageJobs.set(id, { type: 'repeat', timer, info: { tokens, scope, messages, mode, intervalMs, count } });
    ok(res, { jobId: id });
  } catch (e) { fail(res, e); }
});

app.post('/api/messages/schedule', (req, res) => {
  try {
    const { tokens = [], scope, messages = [], mode = { type: 'natural' }, runAt } = req.body;
    if (!scope || !messages.length || !runAt) return fail(res, new Error('scope, messages, runAt required'));
    const ms = new Date(runAt).getTime() - Date.now();
    if (ms < 0) return fail(res, new Error('runAt is in the past'));
    const id = String(jobCounter++);
    const timer = setTimeout(async () => {
      try { await executeSend({ tokens, scope, messages, mode }); } catch (e) {}
      messageJobs.delete(id);
    }, ms);
    messageJobs.set(id, { type: 'schedule', timer, info: { tokens, scope, messages, mode, runAt } });
    ok(res, { jobId: id, runIn: ms });
  } catch (e) { fail(res, e); }
});

app.get('/api/messages/jobs', (req, res) => {
  const list = Array.from(messageJobs.entries()).map(([id, j]) => ({
    id, type: j.type, info: j.info
  }));
  ok(res, { jobs: list });
});

app.post('/api/messages/jobs/:id/stop', (req, res) => {
  const job = messageJobs.get(req.params.id);
  if (!job) return fail(res, new Error('Job not found'));
  if (job.timer) {
    if (job.type === 'repeat') clearInterval(job.timer);
    else clearTimeout(job.timer);
  }
  messageJobs.delete(req.params.id);
  ok(res);
});

// ═══════════════════════════════════════════════
//  REACTION MANAGER (auto-react / auto-button)
// ═══════════════════════════════════════════════
// One handler per (token, scope) combo
const reactionListeners = new Map(); // listenerId -> { tokens, dispose }

function scopeMatches(scope, msg) {
  if (scope.type === 'all') return true;
  if (scope.type === 'server' && msg.guild?.id === scope.id) return true;
  if (scope.type === 'group' && msg.channel?.type === 'GROUP_DM' && msg.channel.id === scope.id) return true;
  if (scope.type === 'dm' && msg.channel?.type === 'DM' && msg.channel.id === scope.id) return true;
  if (scope.type === 'all_dms' && msg.channel?.type === 'DM') return true;
  if (scope.type === 'all_groups' && msg.channel?.type === 'GROUP_DM') return true;
  if (scope.type === 'all_servers' && msg.guild) return true;
  return false;
}

function attachReactionListener({ tokens, scope, mode, emojis = [], buttonNames = [] }) {
  // mode: 'mirror' | 'specific' (mirror => react with whatever emoji someone else used; specific => use given emojis)
  const id = String(jobCounter++);
  const handlers = [];

  for (const tName of tokens) {
    const c = getClientByName(tName);
    if (!c) continue;

    // Auto-react on new messages
    const onMessage = async (msg) => {
      try {
        if (msg.author?.id === c.user.id) return;
        if (!scopeMatches(scope, msg)) return;

        if (mode === 'specific' && emojis.length) {
          for (const em of emojis) {
            try { await msg.react(em); } catch (e) {}
            await sleep(jitter(300, 700));
          }
        }

        // Auto-click buttons
        if (buttonNames.length && msg.components?.length) {
          for (const row of msg.components) {
            for (const comp of row.components || []) {
              const label = comp.label || '';
              if (buttonNames.some(n => label.toLowerCase().includes(n.toLowerCase()))) {
                try {
                  if (typeof comp.click === 'function') await comp.click(msg);
                } catch (e) {}
                await sleep(jitter(400, 900));
              }
            }
          }
        }
      } catch (e) {}
    };

    // Mirror reactions when others react
    const onReactionAdd = async (reaction, user) => {
      try {
        if (user.id === c.user.id) return;
        if (!scopeMatches(scope, reaction.message)) return;
        if (mode === 'mirror') {
          const em = reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name;
          try { await reaction.message.react(em); } catch (e) {}
        }
      } catch (e) {}
    };

    c.on('messageCreate', onMessage);
    c.on('messageReactionAdd', onReactionAdd);
    handlers.push({ client: c, onMessage, onReactionAdd });
  }

  reactionListeners.set(id, {
    tokens, scope, mode, emojis, buttonNames,
    dispose: () => {
      for (const h of handlers) {
        h.client.off('messageCreate', h.onMessage);
        h.client.off('messageReactionAdd', h.onReactionAdd);
      }
    }
  });
  return id;
}

app.post('/api/reactions/start', (req, res) => {
  try {
    const { tokens = [], scope, mode = 'mirror', emojis = [], buttonNames = [] } = req.body;
    if (!scope) return fail(res, new Error('scope required'));
    const targets = (tokens.length ? tokens : (activeName ? [activeName] : []));
    const id = attachReactionListener({ tokens: targets, scope, mode, emojis, buttonNames });
    ok(res, { listenerId: id });
  } catch (e) { fail(res, e); }
});

app.get('/api/reactions/list', (req, res) => {
  const list = Array.from(reactionListeners.entries()).map(([id, l]) => ({
    id, tokens: l.tokens, scope: l.scope, mode: l.mode, emojis: l.emojis, buttonNames: l.buttonNames
  }));
  ok(res, { listeners: list });
});

app.post('/api/reactions/:id/stop', (req, res) => {
  const l = reactionListeners.get(req.params.id);
  if (!l) return fail(res, new Error('Listener not found'));
  l.dispose();
  reactionListeners.delete(req.params.id);
  ok(res);
});

// ═══════════════════════════════════════════════
//  HISTORY (Old Manager) - kept from before
// ═══════════════════════════════════════════════
function snowflakeToMs(id) { return Number(BigInt(id) >> 22n) + 1420070400000; }

function fmtMsg(msg, channel, guild) {
  const ts = msg.timestamp ? new Date(msg.timestamp).getTime() : snowflakeToMs(msg.id);
  const av = msg.author.avatar
    ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
    : '/discord.png';
  return {
    id: msg.id,
    content: msg.content || (msg.attachments?.length ? '[Attachment]' : '[Empty message]'),
    timestamp: ts,
    author: {
      id: msg.author.id,
      username: msg.author.username,
      displayName: msg.author.global_name || msg.author.username,
      avatar: av
    },
    channel: channel || null,
    guild: guild || null
  };
}

app.get('/api/history/user/:userId', async (req, res) => {
  try {
    if (!discordClient?.token) return fail(res, new Error('Not connected'));
    const r = await axios.get(`https://discord.com/api/v9/users/${req.params.userId}`, {
      headers: { Authorization: discordClient.token }
    });
    const u = r.data;
    ok(res, {
      user: {
        id: u.id,
        username: u.username,
        displayName: u.global_name || u.username,
        avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : '/discord.png'
      }
    });
  } catch (e) { res.json({ success: false, error: 'User not found' }); }
});

app.get('/api/history/user-search', async (req, res) => {
  try {
    if (!discordClient?.token) return fail(res, new Error('Not connected'));
    const query = (req.query.q || '').toLowerCase().replace('@', '');
    const frResp = await axios.get('https://discord.com/api/v9/users/@me/relationships', {
      headers: { Authorization: discordClient.token }
    });
    const friend = frResp.data.filter(x => x.type === 1).find(r =>
      r.user.username.toLowerCase().includes(query) ||
      (r.user.global_name || '').toLowerCase().includes(query));
    if (friend) {
      const u = friend.user;
      return ok(res, { user: { id: u.id, username: u.username, displayName: u.global_name || u.username, avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : '/discord.png' } });
    }
    const dmMatch = Array.from(discordClient.channels.cache.values())
      .filter(c => c.type === 'DM' && c.recipient)
      .find(c => c.recipient.username.toLowerCase().includes(query) || (c.recipient.globalName || '').toLowerCase().includes(query));
    if (dmMatch) {
      const u = dmMatch.recipient;
      return ok(res, { user: { id: u.id, username: u.username, displayName: u.globalName || u.username, avatar: u.avatarURL() || '/discord.png' } });
    }
    fail(res, new Error('User not found in your friends or DMs'));
  } catch (e) { fail(res, e); }
});

app.get('/api/history/dm-first-with/:userId', async (req, res) => {
  try {
    if (!discordClient?.token) return fail(res, new Error('Not connected'));
    let dm = Array.from(discordClient.channels.cache.values())
      .find(c => c.type === 'DM' && c.recipient?.id === req.params.userId);
    if (!dm) {
      try {
        const user = await discordClient.users.fetch(req.params.userId);
        dm = await user.createDM();
      } catch (e) { return fail(res, new Error('No DM conversation with this user')); }
    }
    const r = await axios.get(`https://discord.com/api/v9/channels/${dm.id}/messages?limit=1&after=0`, { headers: { Authorization: discordClient.token } });
    if (!r.data.length) return fail(res, new Error('No messages found'));
    ok(res, { message: fmtMsg(r.data[0], { id: dm.id, name: `DM with @${dm.recipient?.username || 'Unknown'}` }, null) });
  } catch (e) { fail(res, e); }
});

app.get('/api/history/oldest-dm', async (req, res) => {
  try {
    if (!discordClient?.token) return fail(res, new Error('Not connected'));
    const dms = Array.from(discordClient.channels.cache.values())
      .filter(c => c.type === 'DM')
      .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
      .slice(0, 30);
    let oldest = null;
    for (const dm of dms) {
      try {
        const r = await axios.get(`https://discord.com/api/v9/channels/${dm.id}/messages?limit=1&after=0`, { headers: { Authorization: discordClient.token } });
        if (r.data.length) {
          const m = fmtMsg(r.data[0], { id: dm.id, name: `DM with @${dm.recipient?.username || 'Unknown'}` }, null);
          if (!oldest || m.timestamp < oldest.timestamp) oldest = m;
        }
        await sleep(120);
      } catch (e) {}
    }
    if (!oldest) return fail(res, new Error('No messages found'));
    ok(res, { message: oldest });
  } catch (e) { fail(res, e); }
});

app.get('/api/history/server-my-first/:serverId', async (req, res) => {
  try {
    if (!discordClient?.token) return fail(res, new Error('Not connected'));
    const myId = discordClient.user.id;
    const guild = discordClient.guilds.cache.get(req.params.serverId);
    const sr = await axios.get(
      `https://discord.com/api/v9/guilds/${req.params.serverId}/messages/search?sort_by=timestamp&sort_order=asc&author_id=${myId}&limit=25`,
      { headers: { Authorization: discordClient.token } });
    const results = sr.data.messages;
    if (!results?.length) return fail(res, new Error('No messages found'));
    const target = results[0].find(m => m.author.id === myId) || results[0][0];
    let chName = target.channel_id;
    try {
      const cr = await axios.get(`https://discord.com/api/v9/channels/${target.channel_id}`, { headers: { Authorization: discordClient.token } });
      chName = cr.data.name;
    } catch (e) {}
    ok(res, { message: fmtMsg(target, { id: target.channel_id, name: chName }, guild ? { id: guild.id, name: guild.name } : null) });
  } catch (e) { fail(res, e); }
});

app.get('/api/history/server-first/:serverId', async (req, res) => {
  try {
    if (!discordClient?.token) return fail(res, new Error('Not connected'));
    const guild = discordClient.guilds.cache.get(req.params.serverId);
    if (!guild) return fail(res, new Error('Server not found'));
    const cr = await axios.get(`https://discord.com/api/v9/guilds/${req.params.serverId}/channels`, { headers: { Authorization: discordClient.token } });
    const channels = cr.data.filter(c => c.type === 0 || c.type === 5).slice(0, 15);
    let oldest = null;
    for (const ch of channels) {
      try {
        const r = await axios.get(`https://discord.com/api/v9/channels/${ch.id}/messages?limit=1&after=0`, { headers: { Authorization: discordClient.token } });
        if (Array.isArray(r.data) && r.data.length) {
          const m = fmtMsg(r.data[0], { id: ch.id, name: ch.name }, { id: guild.id, name: guild.name });
          if (!oldest || m.timestamp < oldest.timestamp) oldest = m;
        }
        await sleep(120);
      } catch (e) {}
    }
    if (!oldest) return fail(res, new Error('No accessible messages'));
    ok(res, { message: oldest });
  } catch (e) { fail(res, e); }
});

app.get('/api/updates', async (req, res) => {
  try {
    const r = await axios.get('https://raw.githubusercontent.com/Bherl1/DiscordAccMgr/refs/heads/main/package.json');
    const latest = r.data.version;
    const current = require('./package.json').version;
    res.json({ hasUpdate: latest > current, version: latest, downloadUrl: `https://github.com/Bherl1/DiscordAccMgr/releases/download/v${latest}/DiscordAccManager-Setup.exe` });
  } catch (e) { res.json({ hasUpdate: false }); }
});

// ═══════════════════════════════════════════════
//  Start server + auto-open browser locally
// ═══════════════════════════════════════════════
app.listen(PORT, '0.0.0.0', async () => {
  const banner = `
╔══════════════════════════════════════════════════╗
║  Discord Account Manager — by Ahmed (@4_3a)      ║
║  Local URL : http://localhost:${PORT}                ║
╚══════════════════════════════════════════════════╝
`;
  console.log(banner);

  // Auto-connect saved tokens (non-blocking)
  autoConnectSaved();

  // Open browser only when running locally (not on Replit)
  const isReplit = !!(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG);
  if (!isReplit && !process.env.NO_OPEN) {
    const url = `http://localhost:${PORT}`;
    const cmd = process.platform === 'win32' ? `start "" "${url}"`
      : process.platform === 'darwin' ? `open "${url}"`
      : `xdg-open "${url}"`;
    exec(cmd, () => {});
  }
});
