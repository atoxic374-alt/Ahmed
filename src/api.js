async function apiCall(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

const TEST_RESPONSES = {
  friends:  { success: true, friends: [
    { id: '111111111111111111', username: 'testfriend', displayName: 'Test Friend', avatar: '/discord.png' },
    { id: '222222222222222222', username: 'demo_user',  displayName: 'Demo User',    avatar: '/discord.png' }
  ]},
  servers:  { success: true, servers: [
    { id: '999000000000000001', name: 'Test Server #1', icon: '/discord.png' },
    { id: '999000000000000002', name: 'Test Server #2', icon: '/discord.png' }
  ]},
  dms:      { success: true, dms: [
    { id: '777000000000000001', username: 'testfriend', displayName: 'Test Friend', avatar: '/discord.png' }
  ]},
  groups:   { success: true, groups: [
    { id: '666000000000000001', name: 'Test Group',  icon: '/discord.png', recipients: 4 }
  ]},
  channels: { success: true, channels: [
    { id: '555000000000000001', name: 'general' },
    { id: '555000000000000002', name: 'random' }
  ]},
  messages: { success: true, messages: [], currentUserId: 'test' },
  clients:  { success: true, active: 'Ahmed (Test)', clients: [
    { name: 'Ahmed (Test)', username: 'AhmedTest#0001', id: '0', avatar: '/discord.png', status: 'online', active: true }
  ]},
  jobs:     { success: true, jobs: [] },
  listeners:{ success: true, listeners: [] },
  results:  { success: true, results: [] },
  ok:       { success: true },
};

function testOr(fallback) {
  return window._testMode ? Promise.resolve(fallback) : null;
}

window.electronAPI = {
  minimize: () => {},
  maximize: () => {},
  close: () => {},

  // ── Token storage
  getTokens:    ()           => apiCall('GET', '/api/tokens'),
  saveToken:    (name, token, autoConnect = false) => apiCall('POST', '/api/tokens', { name, token, autoConnect }),
  updateToken:  (name, patch) => apiCall('PATCH', `/api/tokens/${encodeURIComponent(name)}`, patch),
  deleteToken:  (name)        => apiCall('DELETE', `/api/tokens/${encodeURIComponent(name)}`),
  connectSaved: (name)        => apiCall('POST', `/api/tokens/${encodeURIComponent(name)}/connect`),
  disconnectSaved:(name)      => apiCall('POST', `/api/tokens/${encodeURIComponent(name)}/disconnect`),

  checkUpdates:    () => apiCall('GET', '/api/updates'),
  downloadUpdate:  (url) => { window.open(url, '_blank'); },
  openExternal:    (url) => { window.open(url, '_blank'); },

  // ── Discord auth / clients
  connectDiscord:   (token, name) => apiCall('POST', '/api/discord/connect', { token, name }),
  disconnect:       () => apiCall('POST', '/api/discord/disconnect'),
  disconnectAll:    () => apiCall('POST', '/api/discord/disconnect-all'),
  listClients:      () => testOr(TEST_RESPONSES.clients) || apiCall('GET',  '/api/discord/clients'),
  setActiveClient:  (name) => testOr(TEST_RESPONSES.ok) || apiCall('POST', '/api/discord/active', { name }),

  // ── Friends / Servers / DMs / Groups
  getFriends:       () => testOr(TEST_RESPONSES.friends) || apiCall('GET', '/api/discord/friends'),
  deleteFriend:     (id) => testOr(TEST_RESPONSES.ok) || apiCall('DELETE', `/api/discord/friends/${id}`),

  getServers:       () => testOr(TEST_RESPONSES.servers) || apiCall('GET', '/api/discord/servers'),
  getServerChannels:(id) => testOr(TEST_RESPONSES.channels) || apiCall('GET', `/api/discord/servers/${id}/channels`),
  leaveServer:      (id) => testOr(TEST_RESPONSES.ok) || apiCall('POST', `/api/discord/servers/${id}/leave`),
  muteServer:       (id) => testOr(TEST_RESPONSES.ok) || apiCall('POST', `/api/discord/servers/${id}/mute`),
  unmuteServer:     (id) => testOr(TEST_RESPONSES.ok) || apiCall('POST', `/api/discord/servers/${id}/unmute`),
  readAll:          () => testOr(TEST_RESPONSES.ok) || apiCall('POST', '/api/discord/read-all'),

  getDMs:           () => testOr(TEST_RESPONSES.dms) || apiCall('GET', '/api/discord/dms'),
  getDMMessages:    (id, before) => {
    const q = before ? `?before=${before}` : '';
    return testOr(TEST_RESPONSES.messages) || apiCall('GET', `/api/discord/dms/${id}/messages${q}`);
  },
  deleteDMMessage:  (id, mid) => testOr(TEST_RESPONSES.ok) || apiCall('DELETE', `/api/discord/dms/${id}/messages/${mid}`),
  closeDM:          (id) => testOr(TEST_RESPONSES.ok) || apiCall('POST', `/api/discord/dms/${id}/close`),

  getGroups:        () => testOr(TEST_RESPONSES.groups) || apiCall('GET', '/api/discord/groups'),
  leaveGroup:       (id) => testOr(TEST_RESPONSES.ok) || apiCall('POST', `/api/discord/groups/${id}/leave`),
  getGroupMessages: (id, before) => {
    const q = before ? `?before=${before}` : '';
    return testOr(TEST_RESPONSES.messages) || apiCall('GET', `/api/discord/groups/${id}/messages${q}`);
  },
  deleteGroupMessage:(id, mid) => testOr(TEST_RESPONSES.ok) || apiCall('DELETE', `/api/discord/groups/${id}/messages/${mid}`),

  // ── Presence / Status / Bio
  setPresence:    (payload) => testOr(TEST_RESPONSES.ok) || apiCall('POST', '/api/presence/set', payload),
  setBio:         (payload) => testOr(TEST_RESPONSES.ok) || apiCall('POST', '/api/presence/bio', payload),
  startRotation:  (payload) => testOr(TEST_RESPONSES.ok) || apiCall('POST', '/api/presence/rotate/start', payload),
  stopRotation:   (payload) => testOr(TEST_RESPONSES.ok) || apiCall('POST', '/api/presence/rotate/stop', payload),

  // ── Messages Manager
  sendMessages:    (payload) => testOr(TEST_RESPONSES.results) || apiCall('POST', '/api/messages/send', payload),
  startRepeat:     (payload) => testOr({ success: true, jobId: 'test-1' }) || apiCall('POST', '/api/messages/repeat/start', payload),
  scheduleMessage: (payload) => testOr({ success: true, jobId: 'test-2', runIn: 5000 }) || apiCall('POST', '/api/messages/schedule', payload),
  listMessageJobs: () => testOr(TEST_RESPONSES.jobs) || apiCall('GET', '/api/messages/jobs'),
  stopMessageJob:  (id) => testOr(TEST_RESPONSES.ok) || apiCall('POST', `/api/messages/jobs/${id}/stop`),

  // ── Reaction Manager
  startReactions:   (payload) => testOr({ success: true, listenerId: 'test-r1' }) || apiCall('POST', '/api/reactions/start', payload),
  listReactions:    () => testOr(TEST_RESPONSES.listeners) || apiCall('GET', '/api/reactions/list'),
  stopReactions:    (id) => testOr(TEST_RESPONSES.ok) || apiCall('POST', `/api/reactions/${id}/stop`),
};
