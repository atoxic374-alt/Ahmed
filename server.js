const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { Client } = require('discord.js-selfbot-v13');

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const tokensPath = path.join(__dirname, 'saved_tokens.json');
if (!fs.existsSync(tokensPath)) {
  fs.writeFileSync(tokensPath, '[]', 'utf8');
}

let discordClient = null;

app.post('/api/discord/connect', async (req, res) => {
  try {
    const { token } = req.body;
    if (discordClient) {
      await discordClient.destroy();
      discordClient = null;
    }
    discordClient = new Client({ checkUpdate: false, fetchAllMembers: false });
    await discordClient.login(token);
    res.json({ success: true, username: discordClient.user.tag });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/discord/disconnect', async (req, res) => {
  try {
    if (discordClient) {
      await discordClient.destroy();
      discordClient = null;
    }
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/discord/friends', async (req, res) => {
  try {
    if (!discordClient || !discordClient.token) {
      return res.json({ success: false, error: 'Not connected to Discord' });
    }
    const response = await axios.get('https://discord.com/api/v9/users/@me/relationships', {
      headers: { 'Authorization': discordClient.token }
    });
    const friends = response.data
      .filter(r => r.type === 1)
      .map(f => ({
        id: f.user.id,
        username: f.user.username,
        displayName: f.user.global_name || f.user.username,
        avatar: f.user.avatar ? `https://cdn.discordapp.com/avatars/${f.user.id}/${f.user.avatar}.png` : '/discord.png'
      }));
    res.json({ success: true, friends });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.delete('/api/discord/friends/:friendId', async (req, res) => {
  try {
    if (!discordClient || !discordClient.token) {
      return res.json({ success: false, error: 'Not connected to Discord' });
    }
    await axios.delete(`https://discord.com/api/v9/users/@me/relationships/${req.params.friendId}`, {
      headers: { 'Authorization': discordClient.token, 'Content-Type': 'application/json' }
    });
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/discord/servers', async (req, res) => {
  try {
    if (!discordClient || !discordClient.guilds) {
      return res.json({ success: false, error: 'Not connected' });
    }
    const servers = Array.from(discordClient.guilds.cache.values())
      .filter(server => server && server.ownerId !== discordClient.user.id)
      .map(server => ({
        id: server.id,
        name: server.name,
        icon: server.iconURL() || '/discord.png'
      }));
    res.json({ success: true, servers });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/discord/servers/:serverId/leave', async (req, res) => {
  try {
    if (!discordClient || !discordClient.guilds) {
      return res.json({ success: false, error: 'Not connected' });
    }
    const guild = discordClient.guilds.cache.get(req.params.serverId);
    if (!guild) return res.json({ success: false, error: 'Server not found' });
    await guild.leave();
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/discord/servers/:serverId/mute', async (req, res) => {
  try {
    if (!discordClient || !discordClient.token) {
      return res.json({ success: false, error: 'Not connected' });
    }
    await axios.patch(`https://discord.com/api/v9/users/@me/guilds/${req.params.serverId}/settings`,
      { muted: true },
      { headers: { 'Authorization': discordClient.token, 'Content-Type': 'application/json' } }
    );
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/discord/servers/:serverId/unmute', async (req, res) => {
  try {
    if (!discordClient || !discordClient.token) {
      return res.json({ success: false, error: 'Not connected' });
    }
    await axios.patch(`https://discord.com/api/v9/users/@me/guilds/${req.params.serverId}/settings`,
      { muted: false },
      { headers: { 'Authorization': discordClient.token, 'Content-Type': 'application/json' } }
    );
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/discord/read-all', async (req, res) => {
  try {
    if (!discordClient || !discordClient.token) {
      return res.json({ success: false, error: 'Not connected' });
    }
    const guilds = Array.from(discordClient.guilds.cache.values());
    for (const guild of guilds) {
      try { await guild.markAsRead(); } catch (e) {}
    }
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/discord/dms', async (req, res) => {
  try {
    if (!discordClient || !discordClient.user) {
      return res.json({ success: false, error: 'Not connected to Discord' });
    }
    const dms = Array.from(discordClient.channels.cache.values())
      .filter(channel => channel.type === 'DM')
      .map(dm => ({
        id: dm.id,
        username: dm.recipient?.username || 'Unknown User',
        displayName: dm.recipient?.globalName || dm.recipient?.username || 'Unknown User',
        avatar: dm.recipient?.avatarURL() || '/discord.png'
      }));
    res.json({ success: true, dms });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/discord/dms/:channelId/messages', async (req, res) => {
  try {
    if (!discordClient || !discordClient.user) {
      return res.json({ success: false, error: 'Not connected to Discord' });
    }
    const channel = await discordClient.channels.fetch(req.params.channelId);
    if (!channel || channel.type !== 'DM') {
      return res.json({ success: false, error: 'Invalid DM channel' });
    }
    const { before } = req.query;
    const options = before ? { before, limit: 100 } : { limit: 100 };
    const messages = await channel.messages.fetch(options);
    res.json({
      success: true,
      currentUserId: discordClient.user.id,
      messages: Array.from(messages.values()).map(msg => ({
        id: msg.id,
        content: msg.content,
        isDeletable: msg.author.id === discordClient.user.id && !msg.system,
        author: { id: msg.author.id }
      }))
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.delete('/api/discord/dms/:channelId/messages/:messageId', async (req, res) => {
  try {
    if (!discordClient || !discordClient.user) {
      return res.json({ success: false, error: 'Not connected to Discord' });
    }
    const channel = await discordClient.channels.fetch(req.params.channelId);
    if (!channel || channel.type !== 'DM') {
      return res.json({ success: false, error: 'Invalid DM channel' });
    }
    const message = await channel.messages.fetch(req.params.messageId);
    await message.delete();
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/discord/dms/:channelId/close', async (req, res) => {
  try {
    if (!discordClient || !discordClient.user) {
      return res.json({ success: false, error: 'Not connected to Discord' });
    }
    const channel = await discordClient.channels.fetch(req.params.channelId);
    if (!channel || channel.type !== 'DM') {
      return res.json({ success: false, error: 'Invalid DM channel' });
    }
    await channel.delete();
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/discord/groups', async (req, res) => {
  try {
    if (!discordClient || !discordClient.user) {
      return res.json({ success: false, error: 'Not connected to Discord' });
    }
    const groups = Array.from(discordClient.channels.cache.values())
      .filter(channel => channel.type === 'GROUP_DM')
      .map(group => ({
        id: group.id,
        name: group.name || 'Unnamed Group',
        icon: group.iconURL() || '/discord.png',
        recipients: group.recipients.size
      }));
    res.json({ success: true, groups });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/discord/groups/:groupId/leave', async (req, res) => {
  try {
    if (!discordClient || !discordClient.user) {
      return res.json({ success: false, error: 'Not connected to Discord' });
    }
    const group = await discordClient.channels.fetch(req.params.groupId);
    if (!group || group.type !== 'GROUP_DM') {
      return res.json({ success: false, error: 'Invalid group' });
    }
    await group.delete();
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/discord/groups/:channelId/messages', async (req, res) => {
  try {
    if (!discordClient || !discordClient.token) {
      return res.json({ success: false, error: 'Not connected' });
    }
    const { before } = req.query;
    const url = `https://discord.com/api/v9/channels/${req.params.channelId}/messages?limit=100${before ? `&before=${before}` : ''}`;
    const response = await axios.get(url, {
      headers: { 'Authorization': discordClient.token, 'Content-Type': 'application/json' }
    });
    res.json({
      success: true,
      currentUserId: discordClient.user.id,
      messages: response.data.map(msg => ({
        id: msg.id,
        content: msg.content,
        author: { id: msg.author.id }
      }))
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.delete('/api/discord/groups/:channelId/messages/:messageId', async (req, res) => {
  try {
    if (!discordClient || !discordClient.token) {
      return res.json({ success: false, error: 'Not connected' });
    }
    await axios.delete(`https://discord.com/api/v9/channels/${req.params.channelId}/messages/${req.params.messageId}`, {
      headers: { 'Authorization': discordClient.token, 'Content-Type': 'application/json' }
    });
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/tokens', (req, res) => {
  try {
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    res.json({ success: true, tokens });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/tokens', (req, res) => {
  try {
    const { name, token } = req.body;
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    if (tokens.some(t => t.name === name)) {
      return res.json({ success: false, error: 'A token with this name already exists' });
    }
    tokens.push({ name, token });
    fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.delete('/api/tokens/:name', (req, res) => {
  try {
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    const newTokens = tokens.filter(t => t.name !== req.params.name);
    fs.writeFileSync(tokensPath, JSON.stringify(newTokens, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ══════════════════════════════════════════════
//  Old Manager — History Endpoints
// ══════════════════════════════════════════════

function snowflakeToMs(id) {
  return Number(BigInt(id) >> 22n) + 1420070400000;
}

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

// Look up user by Discord ID
app.get('/api/history/user/:userId', async (req, res) => {
  try {
    if (!discordClient?.token) return res.json({ success: false, error: 'Not connected' });
    const r = await axios.get(`https://discord.com/api/v9/users/${req.params.userId}`, {
      headers: { Authorization: discordClient.token }
    });
    const u = r.data;
    res.json({
      success: true,
      user: {
        id: u.id,
        username: u.username,
        displayName: u.global_name || u.username,
        avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : '/discord.png'
      }
    });
  } catch (e) {
    res.json({ success: false, error: 'User not found' });
  }
});

// Search user by username through friends + DM recipients
app.get('/api/history/user-search', async (req, res) => {
  try {
    if (!discordClient?.token) return res.json({ success: false, error: 'Not connected' });
    const query = (req.query.q || '').toLowerCase().replace('@', '');

    const frResp = await axios.get('https://discord.com/api/v9/users/@me/relationships', {
      headers: { Authorization: discordClient.token }
    });
    const friend = frResp.data.filter(r => r.type === 1).find(r =>
      r.user.username.toLowerCase().includes(query) ||
      (r.user.global_name || '').toLowerCase().includes(query)
    );
    if (friend) {
      const u = friend.user;
      return res.json({ success: true, user: { id: u.id, username: u.username, displayName: u.global_name || u.username, avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : '/discord.png' } });
    }

    const dmMatch = Array.from(discordClient.channels.cache.values())
      .filter(c => c.type === 'DM' && c.recipient)
      .find(c => c.recipient.username.toLowerCase().includes(query) || (c.recipient.globalName || '').toLowerCase().includes(query));
    if (dmMatch) {
      const u = dmMatch.recipient;
      return res.json({ success: true, user: { id: u.id, username: u.username, displayName: u.globalName || u.username, avatar: u.avatarURL() || '/discord.png' } });
    }

    res.json({ success: false, error: 'User not found in your friends or DMs' });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// First message with a specific user
app.get('/api/history/dm-first-with/:userId', async (req, res) => {
  try {
    if (!discordClient?.token) return res.json({ success: false, error: 'Not connected' });
    let dm = Array.from(discordClient.channels.cache.values())
      .find(c => c.type === 'DM' && c.recipient?.id === req.params.userId);
    if (!dm) {
      try {
        const user = await discordClient.users.fetch(req.params.userId);
        dm = await user.createDM();
      } catch (e) {
        return res.json({ success: false, error: 'No DM conversation with this user' });
      }
    }
    const r = await axios.get(
      `https://discord.com/api/v9/channels/${dm.id}/messages?limit=1&after=0`,
      { headers: { Authorization: discordClient.token } }
    );
    if (!r.data.length) return res.json({ success: false, error: 'No messages found in this conversation' });
    res.json({ success: true, message: fmtMsg(r.data[0], { id: dm.id, name: `DM with @${dm.recipient?.username || 'Unknown'}` }, null) });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Oldest DM across all channels
app.get('/api/history/oldest-dm', async (req, res) => {
  try {
    if (!discordClient?.token) return res.json({ success: false, error: 'Not connected' });
    const dms = Array.from(discordClient.channels.cache.values())
      .filter(c => c.type === 'DM')
      .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
      .slice(0, 30);
    let oldest = null;
    for (const dm of dms) {
      try {
        const r = await axios.get(
          `https://discord.com/api/v9/channels/${dm.id}/messages?limit=1&after=0`,
          { headers: { Authorization: discordClient.token } }
        );
        if (r.data.length) {
          const m = fmtMsg(r.data[0], { id: dm.id, name: `DM with @${dm.recipient?.username || 'Unknown'}` }, null);
          if (!oldest || m.timestamp < oldest.timestamp) oldest = m;
        }
        await new Promise(x => setTimeout(x, 120));
      } catch (e) {}
    }
    if (!oldest) return res.json({ success: false, error: 'No messages found in any DM' });
    res.json({ success: true, message: oldest });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// My first message in a server
app.get('/api/history/server-my-first/:serverId', async (req, res) => {
  try {
    if (!discordClient?.token) return res.json({ success: false, error: 'Not connected' });
    const myId = discordClient.user.id;
    const guild = discordClient.guilds.cache.get(req.params.serverId);
    const sr = await axios.get(
      `https://discord.com/api/v9/guilds/${req.params.serverId}/messages/search?sort_by=timestamp&sort_order=asc&author_id=${myId}&limit=25`,
      { headers: { Authorization: discordClient.token } }
    );
    const results = sr.data.messages;
    if (!results?.length) return res.json({ success: false, error: 'No messages found from you in this server' });
    const target = results[0].find(m => m.author.id === myId) || results[0][0];
    let chName = target.channel_id;
    try {
      const cr = await axios.get(`https://discord.com/api/v9/channels/${target.channel_id}`, { headers: { Authorization: discordClient.token } });
      chName = cr.data.name;
    } catch (e) {}
    res.json({ success: true, message: fmtMsg(target, { id: target.channel_id, name: chName }, guild ? { id: guild.id, name: guild.name } : null) });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// First message ever in a server (by anyone)
app.get('/api/history/server-first/:serverId', async (req, res) => {
  try {
    if (!discordClient?.token) return res.json({ success: false, error: 'Not connected' });
    const guild = discordClient.guilds.cache.get(req.params.serverId);
    if (!guild) return res.json({ success: false, error: 'Server not found' });
    const cr = await axios.get(`https://discord.com/api/v9/guilds/${req.params.serverId}/channels`, { headers: { Authorization: discordClient.token } });
    const channels = cr.data.filter(c => c.type === 0 || c.type === 5).slice(0, 15);
    let oldest = null;
    for (const ch of channels) {
      try {
        const r = await axios.get(
          `https://discord.com/api/v9/channels/${ch.id}/messages?limit=1&after=0`,
          { headers: { Authorization: discordClient.token } }
        );
        if (Array.isArray(r.data) && r.data.length) {
          const m = fmtMsg(r.data[0], { id: ch.id, name: ch.name }, { id: guild.id, name: guild.name });
          if (!oldest || m.timestamp < oldest.timestamp) oldest = m;
        }
        await new Promise(x => setTimeout(x, 120));
      } catch (e) {}
    }
    if (!oldest) return res.json({ success: false, error: 'No accessible messages found in this server' });
    res.json({ success: true, message: oldest });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.get('/api/updates', async (req, res) => {
  try {
    const response = await axios.get('https://raw.githubusercontent.com/Bherl1/DiscordAccMgr/refs/heads/main/package.json');
    const latestVersion = response.data.version;
    const currentVersion = require('./package.json').version;
    res.json({
      hasUpdate: latestVersion > currentVersion,
      version: latestVersion,
      downloadUrl: `https://github.com/Bherl1/DiscordAccMgr/releases/download/v${latestVersion}/DiscordAccManager-Setup.exe`
    });
  } catch (error) {
    res.json({ hasUpdate: false });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Discord Account Manager running on port ${PORT}`);
});
