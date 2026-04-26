async function apiCall(method, url, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

const TEST_RESPONSES = {
  friends:  { success: true, friends: [] },
  servers:  { success: true, servers: [] },
  dms:      { success: true, dms: [] },
  groups:   { success: true, groups: [] },
  messages: { success: true, messages: [], currentUserId: 'test' },
  ok:       { success: true },
};

function testOr(fallback) {
  return window._testMode ? Promise.resolve(fallback) : null;
}

window.electronAPI = {
  minimize: () => {},
  maximize: () => {},
  close: () => {},

  getTokens: () => apiCall('GET', '/api/tokens'),
  saveToken: (name, token) => apiCall('POST', '/api/tokens', { name, token }),
  deleteToken: (name) => apiCall('DELETE', `/api/tokens/${encodeURIComponent(name)}`),

  checkUpdates: () => apiCall('GET', '/api/updates'),
  downloadUpdate: (url) => { window.open(url, '_blank'); },
  openExternal: (url) => { window.open(url, '_blank'); },

  connectDiscord: (token) => apiCall('POST', '/api/discord/connect', { token }),

  getFriends: () => testOr(TEST_RESPONSES.friends) || apiCall('GET', '/api/discord/friends'),
  deleteFriend: (friendId) => testOr(TEST_RESPONSES.ok) || apiCall('DELETE', `/api/discord/friends/${friendId}`),

  getServers: () => testOr(TEST_RESPONSES.servers) || apiCall('GET', '/api/discord/servers'),
  leaveServer: (serverId) => testOr(TEST_RESPONSES.ok) || apiCall('POST', `/api/discord/servers/${serverId}/leave`),
  muteServer: (serverId) => testOr(TEST_RESPONSES.ok) || apiCall('POST', `/api/discord/servers/${serverId}/mute`),
  unmuteServer: (serverId) => testOr(TEST_RESPONSES.ok) || apiCall('POST', `/api/discord/servers/${serverId}/unmute`),
  readAll: () => testOr(TEST_RESPONSES.ok) || apiCall('POST', '/api/discord/read-all'),

  getDMs: () => testOr(TEST_RESPONSES.dms) || apiCall('GET', '/api/discord/dms'),
  getDMMessages: (channelId, beforeId) => {
    const q = beforeId ? `?before=${beforeId}` : '';
    return testOr(TEST_RESPONSES.messages) || apiCall('GET', `/api/discord/dms/${channelId}/messages${q}`);
  },
  deleteDMMessage: (channelId, messageId) => testOr(TEST_RESPONSES.ok) || apiCall('DELETE', `/api/discord/dms/${channelId}/messages/${messageId}`),
  closeDM: (channelId) => testOr(TEST_RESPONSES.ok) || apiCall('POST', `/api/discord/dms/${channelId}/close`),

  getGroups: () => testOr(TEST_RESPONSES.groups) || apiCall('GET', '/api/discord/groups'),
  leaveGroup: (groupId) => testOr(TEST_RESPONSES.ok) || apiCall('POST', `/api/discord/groups/${groupId}/leave`),
  getGroupMessages: (channelId, beforeId) => {
    const q = beforeId ? `?before=${beforeId}` : '';
    return testOr(TEST_RESPONSES.messages) || apiCall('GET', `/api/discord/groups/${channelId}/messages${q}`);
  },
  deleteGroupMessage: (channelId, messageId) => testOr(TEST_RESPONSES.ok) || apiCall('DELETE', `/api/discord/groups/${channelId}/messages/${messageId}`)
};
