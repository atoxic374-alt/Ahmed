const $ = (id) => document.getElementById(id);

const fields = {
  token: $('token'),
  autoReconnect: $('autoReconnect'),
  enabled: $('enabled'),
  streamName: $('streamName'),
  streamUrl: $('streamUrl'),
  state: $('state'),
  status: $('status')
};

const ui = {
  botAvatar: $('botAvatar'),
  botName: $('botName'),
  botMeta: $('botMeta'),
  statusDot: $('statusDot'),
  previewAvatar: $('previewAvatar'),
  previewStatus: $('previewStatus'),
  previewName: $('previewName'),
  previewStreamName: $('previewStreamName'),
  previewUrl: $('previewUrl'),
  previewState: $('previewState'),
  savedState: $('savedState'),
  tokenState: $('tokenState'),
  lastApplied: $('lastApplied'),
  toast: $('toast')
};

function toast(message, type = 'info') {
  ui.toast.textContent = `${type === 'error' ? '⚠️' : '✅'} ${message}`;
  ui.toast.style.color = type === 'error' ? '#ff9aa5' : '#6ef3ff';
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ar', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }).format(new Date(value));
}

function setPresenceFields(presence) {
  fields.enabled.checked = Boolean(presence.enabled);
  fields.streamName.value = presence.streamName || '';
  fields.streamUrl.value = presence.streamUrl || '';
  fields.state.value = presence.state || '';
  fields.status.value = presence.status || 'online';
}

function getPresenceFields() {
  return {
    enabled: fields.enabled.checked,
    streamName: fields.streamName.value,
    streamUrl: fields.streamUrl.value,
    state: fields.state.value,
    status: fields.status.value
  };
}

function renderPreview(bot, presence) {
  const fallback = '/discord-mark.svg';
  ui.previewAvatar.src = bot?.avatar || fallback;
  ui.previewName.textContent = bot?.tag || 'Your Bot';
  ui.previewStreamName.textContent = presence.enabled ? presence.streamName : 'Streaming متوقف حاليًا';
  ui.previewUrl.textContent = presence.streamUrl || 'https://twitch.tv/discord';
  ui.previewUrl.href = presence.streamUrl || 'https://twitch.tv/discord';
  ui.previewState.textContent = presence.state || '—';
  ui.previewStatus.className = `mini-status ${presence.status || 'online'}`;
}

function render(payload) {
  const { connectionState, bot, settings } = payload;
  const presence = settings.presence;

  fields.autoReconnect.checked = settings.autoReconnect;
  setPresenceFields(presence);

  ui.botAvatar.src = bot?.avatar || '/discord-mark.svg';
  ui.botName.textContent = bot?.tag || 'غير متصل';
  ui.botMeta.textContent = `الحالة: ${connectionState}${settings.tokenPreview ? ` · ${settings.tokenPreview}` : ''}`;
  ui.statusDot.className = `status-dot ${connectionState === 'online' ? 'online' : connectionState === 'connecting' ? 'connecting' : ''}`;
  ui.tokenState.textContent = settings.hasToken ? 'محفوظ' : 'لا يوجد';
  ui.savedState.textContent = settings.autoReconnect ? 'تلقائي' : 'يدوي';
  ui.lastApplied.textContent = formatDate(settings.lastAppliedAt);
  renderPreview(bot, presence);
}

async function refresh() {
  const payload = await api('/api/status');
  render(payload);
}

for (const input of [fields.enabled, fields.streamName, fields.streamUrl, fields.state, fields.status]) {
  input.addEventListener('input', () => renderPreview(null, getPresenceFields()));
}

$('connectForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    toast('جاري الاتصال بديسكورد...');
    const payload = await api('/api/connect', {
      method: 'POST',
      body: {
        token: fields.token.value,
        autoReconnect: fields.autoReconnect.checked,
        saveToken: true
      }
    });
    fields.token.value = '';
    render(payload);
    toast('تم الاتصال وتطبيق الإعدادات المحفوظة.');
  } catch (error) {
    toast(error.message, 'error');
  }
});

$('presenceForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = await api('/api/settings', {
      method: 'POST',
      body: {
        autoReconnect: fields.autoReconnect.checked,
        presence: getPresenceFields()
      }
    });
    render(payload);
    toast('تم تطبيق Streaming presence فورًا.');
  } catch (error) {
    toast(error.message, 'error');
  }
});

$('stopBtn').addEventListener('click', async () => {
  try {
    const payload = await api('/api/stop-streaming', { method: 'POST' });
    render(payload);
    toast('تم إيقاف الستريمنق.');
  } catch (error) {
    toast(error.message, 'error');
  }
});

$('disconnectBtn').addEventListener('click', async () => {
  const payload = await api('/api/disconnect', { method: 'POST' });
  render(payload);
  toast('تم فصل البوت محليًا.');
});

$('clearTokenBtn').addEventListener('click', async () => {
  const payload = await api('/api/clear-token', { method: 'POST' });
  render(payload);
  toast('تم حذف التوكن المحفوظ وإيقاف إعادة الاتصال.');
});

refresh().catch((error) => toast(error.message, 'error'));
