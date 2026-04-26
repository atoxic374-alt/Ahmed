// Messages Manager — send / repeat / schedule
import { showNotification } from '../utils/ui.js';

export class MessagesManager {
  constructor(contentArea) {
    this.contentArea = contentArea;
    this.activeTab = 'server';     // 'server' | 'dms' | 'groups' | 'jobs'
    this.messages = [''];          // panels
    this.tokens = [];              // selected token names (empty => active)
    this.allTokens = [];
    this.servers = [];
    this.channels = [];
    this.selectedServerId = null;
    this.sendToAllChannels = false;
    this.selectedChannelIds = [];
    this.dms = [];
    this.groups = [];
    this.selectedDMs = [];
    this.selectedGroups = [];
    this.mode = 'natural';
    this.intervalSec = 60;
    this.repeatCount = 0;
    this.scheduleAt = '';
    this.jobs = [];
  }

  async init() {
    await this.loadClients();
    this.render();
    this.refreshJobs();
  }

  async loadClients() {
    try {
      const r = await window.electronAPI.listClients();
      this.allTokens = r.success ? r.clients : [];
    } catch (e) { this.allTokens = []; }
  }

  async refreshJobs() {
    try {
      const r = await window.electronAPI.listMessageJobs();
      this.jobs = r.success ? r.jobs : [];
      const el = document.getElementById('mm-jobs-list');
      if (el) el.innerHTML = this.renderJobsList();
    } catch (e) {}
  }

  render() {
    this.contentArea.innerHTML = `
      <div class="mm-page">
        <div class="mm-header">
          <div class="mm-title-row">
            <span class="mm-icon">✉️</span>
            <div>
              <h2 class="mm-title">Messages Manager</h2>
              <p class="mm-subtitle">Send, repeat &amp; schedule messages — across accounts.</p>
            </div>
          </div>
          <div class="mm-tabs">
            ${this.tabBtn('server', '📡', 'Servers')}
            ${this.tabBtn('dms',    '💬', 'All DMs')}
            ${this.tabBtn('groups', '👥', 'Groups')}
            ${this.tabBtn('jobs',   '⚙️', 'Active Jobs')}
          </div>
        </div>

        <div class="mm-body">
          ${this.activeTab === 'jobs' ? this.renderJobsTab() : this.renderComposerTab()}
        </div>
      </div>
    `;
    this.bindGlobalEvents();
    if (this.activeTab === 'server') this.loadServers();
  }

  tabBtn(id, icon, label) {
    return `<button class="mm-tab ${this.activeTab === id ? 'active' : ''}" onclick="window.messagesManager.switchTab('${id}')"><span>${icon}</span> ${label}</button>`;
  }

  switchTab(t) {
    this.activeTab = t;
    this.render();
    if (t === 'jobs') this.refreshJobs();
  }

  renderComposerTab() {
    return `
      <div class="mm-grid">
        <div class="mm-card">
          <div class="mm-card-head"><span class="mm-card-icon">🎯</span><div><div class="mm-card-title">Target</div><div class="mm-card-desc">Where to send</div></div></div>
          ${this.renderTargetSection()}
        </div>

        <div class="mm-card">
          <div class="mm-card-head"><span class="mm-card-icon">👤</span><div><div class="mm-card-title">Accounts</div><div class="mm-card-desc">Pick one or many — empty = active</div></div></div>
          ${this.renderTokenSelector()}
        </div>

        <div class="mm-card mm-span-2">
          <div class="mm-card-head"><span class="mm-card-icon">📝</span><div><div class="mm-card-title">Messages</div><div class="mm-card-desc">Add multiple messages, sent in order</div></div></div>
          <div id="mm-messages">${this.renderMessagePanels()}</div>
          <button class="mm-btn ghost mm-add-msg" onclick="window.messagesManager.addMessage()">＋ Add Message Panel</button>
        </div>

        <div class="mm-card">
          <div class="mm-card-head"><span class="mm-card-icon">⚡</span><div><div class="mm-card-title">Mode</div><div class="mm-card-desc">Speed &amp; stealth</div></div></div>
          <div class="mm-radio-group">
            <label class="mm-radio ${this.mode === 'natural' ? 'active' : ''}"><input type="radio" name="mm-mode" value="natural" ${this.mode === 'natural' ? 'checked' : ''} onchange="window.messagesManager.mode='natural';window.messagesManager.refreshModeUI()"><div><strong>Natural</strong><span>Typing simulation, randomized delays</span></div></label>
            <label class="mm-radio ${this.mode === 'fast' ? 'active' : ''}"><input type="radio" name="mm-mode" value="fast" ${this.mode === 'fast' ? 'checked' : ''} onchange="window.messagesManager.mode='fast';window.messagesManager.refreshModeUI()"><div><strong>Fast</strong><span>Minimal delay (higher detection risk)</span></div></label>
          </div>
        </div>

        <div class="mm-card">
          <div class="mm-card-head"><span class="mm-card-icon">⏰</span><div><div class="mm-card-title">Repeat / Schedule</div><div class="mm-card-desc">Optional timers</div></div></div>
          <div class="mm-field"><label>Repeat every (seconds)</label><input type="number" min="2" id="mm-int" value="${this.intervalSec}"></div>
          <div class="mm-field"><label>Stop after N runs (0 = forever)</label><input type="number" min="0" id="mm-count" value="${this.repeatCount}"></div>
          <div class="mm-field"><label>Schedule once at</label><input type="datetime-local" id="mm-sched" value="${this.scheduleAt}"></div>
        </div>

        <div class="mm-card mm-span-2 mm-actions-card">
          <button class="mm-btn primary" onclick="window.messagesManager.actionSendNow()">🚀 Send Now</button>
          <button class="mm-btn warning" onclick="window.messagesManager.actionRepeat()">🔁 Start Repeating</button>
          <button class="mm-btn success" onclick="window.messagesManager.actionSchedule()">📅 Schedule</button>
        </div>
      </div>
    `;
  }

  renderTargetSection() {
    if (this.activeTab === 'server') {
      const opts = this.servers.map(s => `<option value="${s.id}" ${s.id === this.selectedServerId ? 'selected' : ''}>${this.escHtml(s.name)}</option>`).join('');
      return `
        <div class="mm-field"><label>Server</label>
          <select id="mm-server" onchange="window.messagesManager.onServerChange(this.value)">
            <option value="">— Select server —</option>${opts}
          </select>
        </div>
        <label class="mm-toggle"><input type="checkbox" id="mm-allch" ${this.sendToAllChannels ? 'checked' : ''} onchange="window.messagesManager.sendToAllChannels = this.checked; window.messagesManager.renderChannels()"> Send to ALL channels</label>
        <div id="mm-channels-wrap">${this.renderChannelsSection()}</div>
      `;
    }
    if (this.activeTab === 'dms') {
      return `<div class="mm-info-row">📨 Sends to <strong>all open DMs</strong> for the selected accounts.</div>
              <button class="mm-btn ghost small" onclick="window.messagesManager.previewDMs()">Preview targets</button>
              <div id="mm-dm-preview" class="mm-preview"></div>`;
    }
    if (this.activeTab === 'groups') {
      return `<div class="mm-info-row">👥 Sends to <strong>all group chats</strong> for the selected accounts.</div>
              <button class="mm-btn ghost small" onclick="window.messagesManager.previewGroups()">Preview targets</button>
              <div id="mm-grp-preview" class="mm-preview"></div>`;
    }
    return '';
  }

  renderChannelsSection() {
    if (this.sendToAllChannels) return '<div class="mm-info-row">All text channels will be targeted.</div>';
    if (!this.channels.length) return '<div class="mm-info-row mm-muted">Select a server to load channels…</div>';
    return `
      <div class="mm-channels">
        ${this.channels.map(c => `
          <label class="mm-chip ${this.selectedChannelIds.includes(c.id) ? 'on' : ''}">
            <input type="checkbox" data-cid="${c.id}" ${this.selectedChannelIds.includes(c.id) ? 'checked' : ''} onchange="window.messagesManager.toggleChannel('${c.id}', this.checked)">
            <span>#${this.escHtml(c.name)}</span>
          </label>`).join('')}
      </div>
    `;
  }

  renderTokenSelector() {
    if (!this.allTokens.length) return '<div class="mm-info-row mm-muted">No connected accounts. Defaults to active.</div>';
    return `
      <div class="mm-token-grid">
        ${this.allTokens.map(t => `
          <label class="mm-token-chip ${this.tokens.includes(t.name) ? 'on' : ''}">
            <input type="checkbox" data-tname="${t.name}" ${this.tokens.includes(t.name) ? 'checked' : ''} onchange="window.messagesManager.toggleToken('${t.name}', this.checked)">
            <img src="${t.avatar || '/discord.png'}" onerror="this.src='/discord.png'">
            <div><strong>${this.escHtml(t.name)}</strong><span>${this.escHtml(t.username || '')}</span></div>
          </label>
        `).join('')}
      </div>
      <div class="mm-token-actions">
        <button class="mm-btn ghost small" onclick="window.messagesManager.selectAllTokens(true)">Select all</button>
        <button class="mm-btn ghost small" onclick="window.messagesManager.selectAllTokens(false)">Clear</button>
      </div>
    `;
  }

  renderMessagePanels() {
    return this.messages.map((m, i) => `
      <div class="mm-msg-panel" data-i="${i}">
        <div class="mm-msg-head">
          <span>Message #${i + 1}</span>
          ${this.messages.length > 1 ? `<button class="mm-x" onclick="window.messagesManager.removeMessage(${i})" title="Remove">✕</button>` : ''}
        </div>
        <textarea rows="3" placeholder="Type message…" oninput="window.messagesManager.updateMessage(${i}, this.value)">${this.escHtml(m)}</textarea>
      </div>
    `).join('');
  }

  renderJobsTab() {
    return `
      <div class="mm-card mm-span-2">
        <div class="mm-card-head"><span class="mm-card-icon">⚙️</span><div><div class="mm-card-title">Active Jobs</div><div class="mm-card-desc">Repeating &amp; scheduled jobs running on the server</div></div></div>
        <div id="mm-jobs-list">${this.renderJobsList()}</div>
        <button class="mm-btn ghost small" onclick="window.messagesManager.refreshJobs()">↻ Refresh</button>
      </div>
    `;
  }

  renderJobsList() {
    if (!this.jobs.length) return '<div class="mm-info-row mm-muted">No active jobs.</div>';
    return this.jobs.map(j => `
      <div class="mm-job-item">
        <div>
          <strong>${j.type === 'repeat' ? '🔁 Repeating' : '📅 Scheduled'}</strong>
          <span class="mm-job-meta">${j.info.tokens?.length || 1} account(s) · ${j.info.messages?.length || 0} msg(s) · ${j.info.scope?.type || ''}</span>
        </div>
        <button class="mm-btn danger small" onclick="window.messagesManager.stopJob('${j.id}')">Stop</button>
      </div>
    `).join('');
  }

  // ─── Events
  bindGlobalEvents() {
    document.getElementById('mm-int')?.addEventListener('input',  e => this.intervalSec = parseInt(e.target.value || '0'));
    document.getElementById('mm-count')?.addEventListener('input', e => this.repeatCount = parseInt(e.target.value || '0'));
    document.getElementById('mm-sched')?.addEventListener('input', e => this.scheduleAt = e.target.value);
  }

  refreshModeUI() {
    document.querySelectorAll('.mm-radio').forEach(el => {
      el.classList.toggle('active', el.querySelector('input')?.checked);
    });
  }

  // ─── Servers / channels
  async loadServers() {
    try {
      const r = await window.electronAPI.getServers();
      this.servers = r.success ? r.servers : [];
      const sel = document.getElementById('mm-server');
      if (sel) {
        sel.innerHTML = '<option value="">— Select server —</option>' +
          this.servers.map(s => `<option value="${s.id}" ${s.id === this.selectedServerId ? 'selected' : ''}>${this.escHtml(s.name)}</option>`).join('');
      }
    } catch (e) {}
  }

  async onServerChange(id) {
    this.selectedServerId = id || null;
    this.selectedChannelIds = [];
    this.channels = [];
    if (!id) { this.renderChannels(); return; }
    try {
      const r = await window.electronAPI.getServerChannels(id);
      this.channels = r.success ? r.channels : [];
    } catch (e) { this.channels = []; }
    this.renderChannels();
  }

  renderChannels() {
    const w = document.getElementById('mm-channels-wrap');
    if (w) w.innerHTML = this.renderChannelsSection();
  }

  toggleChannel(id, on) {
    if (on && !this.selectedChannelIds.includes(id)) this.selectedChannelIds.push(id);
    else if (!on) this.selectedChannelIds = this.selectedChannelIds.filter(x => x !== id);
  }

  toggleToken(name, on) {
    if (on && !this.tokens.includes(name)) this.tokens.push(name);
    else if (!on) this.tokens = this.tokens.filter(x => x !== name);
  }

  selectAllTokens(all) {
    this.tokens = all ? this.allTokens.map(t => t.name) : [];
    this.render();
  }

  // ─── Messages
  addMessage() { this.messages.push(''); document.getElementById('mm-messages').innerHTML = this.renderMessagePanels(); }
  removeMessage(i) { this.messages.splice(i, 1); document.getElementById('mm-messages').innerHTML = this.renderMessagePanels(); }
  updateMessage(i, val) { this.messages[i] = val; }

  // ─── Previews
  async previewDMs() {
    const r = await window.electronAPI.getDMs();
    const w = document.getElementById('mm-dm-preview');
    if (!r.success) { w.innerHTML = `<div class="mm-error">${this.escHtml(r.error)}</div>`; return; }
    w.innerHTML = `<div class="mm-preview-title">${r.dms.length} DM(s)</div>` +
      r.dms.map(d => `<div class="mm-preview-row"><img src="${d.avatar}" onerror="this.src='/discord.png'"><span>@${this.escHtml(d.username)}</span></div>`).join('');
  }

  async previewGroups() {
    const r = await window.electronAPI.getGroups();
    const w = document.getElementById('mm-grp-preview');
    if (!r.success) { w.innerHTML = `<div class="mm-error">${this.escHtml(r.error)}</div>`; return; }
    w.innerHTML = `<div class="mm-preview-title">${r.groups.length} Group(s)</div>` +
      r.groups.map(g => `<div class="mm-preview-row"><img src="${g.icon}" onerror="this.src='/discord.png'"><span>${this.escHtml(g.name)} · ${g.recipients} ppl</span></div>`).join('');
  }

  // ─── Build payload
  buildPayload() {
    const messages = this.messages.map(m => (m || '').trim()).filter(Boolean);
    if (!messages.length) { showNotification('Add at least one message'); return null; }

    let scope;
    if (this.activeTab === 'server') {
      if (!this.selectedServerId) { showNotification('Select a server'); return null; }
      if (this.sendToAllChannels) scope = { type: 'all_channels', serverId: this.selectedServerId };
      else {
        if (!this.selectedChannelIds.length) { showNotification('Select at least one channel'); return null; }
        scope = { type: 'channel', channelIds: this.selectedChannelIds };
      }
    } else if (this.activeTab === 'dms')    scope = { type: 'all_dms' };
    else if (this.activeTab === 'groups')   scope = { type: 'all_groups' };

    return {
      tokens: this.tokens,
      scope,
      messages,
      mode: { type: this.mode, perMessageDelayMs: this.mode === 'fast' ? 400 : 1500 }
    };
  }

  async actionSendNow() {
    const p = this.buildPayload(); if (!p) return;
    showNotification('Sending…');
    try {
      const r = await window.electronAPI.sendMessages(p);
      const ok = (r.results || []).filter(x => x.ok).length;
      const fail = (r.results || []).length - ok;
      showNotification(`Sent ✓ ${ok}  ✗ ${fail}`);
    } catch (e) { showNotification('Failed: ' + e.message); }
  }

  async actionRepeat() {
    const p = this.buildPayload(); if (!p) return;
    p.intervalMs = Math.max(2000, (this.intervalSec || 60) * 1000);
    p.count = this.repeatCount || 0;
    try {
      const r = await window.electronAPI.startRepeat(p);
      if (r.success) showNotification(`Job started: ${r.jobId}`); else showNotification('Failed: ' + r.error);
    } catch (e) { showNotification('Failed: ' + e.message); }
  }

  async actionSchedule() {
    const p = this.buildPayload(); if (!p) return;
    if (!this.scheduleAt) { showNotification('Pick a date/time'); return; }
    p.runAt = new Date(this.scheduleAt).toISOString();
    try {
      const r = await window.electronAPI.scheduleMessage(p);
      if (r.success) showNotification(`Scheduled in ${(r.runIn / 1000) | 0}s`); else showNotification('Failed: ' + r.error);
    } catch (e) { showNotification('Failed: ' + e.message); }
  }

  async stopJob(id) {
    await window.electronAPI.stopMessageJob(id);
    this.refreshJobs();
  }

  escHtml(t) {
    if (t === null || t === undefined) return '';
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}
