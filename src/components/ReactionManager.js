// Reaction Manager — auto-react & auto-button click
import { showNotification } from '../utils/ui.js';

export class ReactionManager {
  constructor(contentArea) {
    this.contentArea = contentArea;
    this.activeTab = 'server'; // server | group | dm | all | active
    this.allTokens = [];
    this.tokens = [];
    this.servers = [];
    this.groups = [];
    this.dms = [];
    this.scopeId = '';
    this.mode = 'mirror';
    this.emojis = '';
    this.buttons = '';
    this.listeners = [];
  }

  async init() {
    await Promise.all([this.loadClients(), this.loadServers(), this.loadGroups(), this.loadDMs(), this.refreshListeners()]);
    this.render();
  }

  async loadClients() { try { const r = await window.electronAPI.listClients(); this.allTokens = r.success ? r.clients : []; } catch (e) {} }
  async loadServers() { try { const r = await window.electronAPI.getServers(); this.servers = r.success ? r.servers : []; } catch (e) {} }
  async loadGroups()  { try { const r = await window.electronAPI.getGroups();  this.groups  = r.success ? r.groups  : []; } catch (e) {} }
  async loadDMs()     { try { const r = await window.electronAPI.getDMs();     this.dms     = r.success ? r.dms     : []; } catch (e) {} }

  async refreshListeners() {
    try { const r = await window.electronAPI.listReactions(); this.listeners = r.success ? r.listeners : []; } catch (e) { this.listeners = []; }
    const el = document.getElementById('rm-listeners');
    if (el) el.innerHTML = this.renderListeners();
  }

  render() {
    this.contentArea.innerHTML = `
      <div class="mm-page">
        <div class="mm-header">
          <div class="mm-title-row">
            <span class="mm-icon">💟</span>
            <div>
              <h2 class="mm-title">Reaction Manager</h2>
              <p class="mm-subtitle">Auto-react and auto-click buttons across scopes.</p>
            </div>
          </div>
          <div class="mm-tabs">
            ${this.tabBtn('server', '📡', 'Server')}
            ${this.tabBtn('group',  '👥', 'Group')}
            ${this.tabBtn('dm',     '💬', 'DM')}
            ${this.tabBtn('all',    '🌐', 'All')}
            ${this.tabBtn('active', '⚙️', 'Active')}
          </div>
        </div>
        <div class="mm-body">
          ${this.activeTab === 'active' ? this.renderActive() : this.renderComposer()}
        </div>
      </div>
    `;
  }

  tabBtn(id, icon, label) {
    return `<button class="mm-tab ${this.activeTab === id ? 'active' : ''}" onclick="window.reactionManager.switchTab('${id}')"><span>${icon}</span> ${label}</button>`;
  }
  switchTab(t) { this.activeTab = t; this.render(); if (t === 'active') this.refreshListeners(); }

  renderComposer() {
    return `
      <div class="mm-grid">
        <div class="mm-card">
          <div class="mm-card-head"><span class="mm-card-icon">🎯</span><div><div class="mm-card-title">Scope</div><div class="mm-card-desc">Where to listen</div></div></div>
          ${this.renderScope()}
        </div>

        <div class="mm-card">
          <div class="mm-card-head"><span class="mm-card-icon">👤</span><div><div class="mm-card-title">Accounts</div><div class="mm-card-desc">One or many — empty = active</div></div></div>
          ${this.renderTokenSelector()}
        </div>

        <div class="mm-card">
          <div class="mm-card-head"><span class="mm-card-icon">⚡</span><div><div class="mm-card-title">Mode</div><div class="mm-card-desc">How to react</div></div></div>
          <div class="mm-radio-group">
            <label class="mm-radio ${this.mode === 'mirror' ? 'active' : ''}"><input type="radio" name="rm-mode" value="mirror" ${this.mode === 'mirror' ? 'checked' : ''} onchange="window.reactionManager.mode='mirror'"><div><strong>Mirror</strong><span>React with whatever others react with</span></div></label>
            <label class="mm-radio ${this.mode === 'specific' ? 'active' : ''}"><input type="radio" name="rm-mode" value="specific" ${this.mode === 'specific' ? 'checked' : ''} onchange="window.reactionManager.mode='specific'"><div><strong>Specific</strong><span>Only the emojis listed below</span></div></label>
          </div>
        </div>

        <div class="mm-card">
          <div class="mm-card-head"><span class="mm-card-icon">😊</span><div><div class="mm-card-title">Emojis</div><div class="mm-card-desc">Comma separated (e.g. 👍, ❤️, 🎉)</div></div></div>
          <div class="mm-field"><textarea rows="2" placeholder="👍, ❤️, 🎉" oninput="window.reactionManager.emojis = this.value">${this.escHtml(this.emojis)}</textarea></div>
        </div>

        <div class="mm-card mm-span-2">
          <div class="mm-card-head"><span class="mm-card-icon">🔘</span><div><div class="mm-card-title">Auto-click Buttons</div><div class="mm-card-desc">Comma-separated label names. Account will click any matching button.</div></div></div>
          <div class="mm-field"><input type="text" placeholder="Claim, Accept, Verify" value="${this.escHtml(this.buttons)}" oninput="window.reactionManager.buttons = this.value"></div>
        </div>

        <div class="mm-card mm-span-2 mm-actions-card">
          <button class="mm-btn primary" onclick="window.reactionManager.actionStart()">▶ Start Listener</button>
          <button class="mm-btn ghost small" onclick="window.reactionManager.switchTab('active')">⚙️ View Active</button>
        </div>
      </div>
    `;
  }

  renderScope() {
    if (this.activeTab === 'server') {
      const opts = this.servers.map(s => `<option value="${s.id}" ${s.id === this.scopeId ? 'selected' : ''}>${this.escHtml(s.name)}</option>`).join('');
      return `<div class="mm-field"><label>Server</label><select onchange="window.reactionManager.scopeId = this.value"><option value="">— Select —</option>${opts}</select></div>`;
    }
    if (this.activeTab === 'group') {
      const opts = this.groups.map(g => `<option value="${g.id}">${this.escHtml(g.name)}</option>`).join('');
      return `<div class="mm-field"><label>Group</label><select onchange="window.reactionManager.scopeId = this.value"><option value="">— Select —</option>${opts}</select></div>`;
    }
    if (this.activeTab === 'dm') {
      const opts = this.dms.map(d => `<option value="${d.id}">@${this.escHtml(d.username)}</option>`).join('');
      return `<div class="mm-field"><label>DM</label><select onchange="window.reactionManager.scopeId = this.value"><option value="">— Select —</option>${opts}</select></div>`;
    }
    return `<div class="mm-info-row">🌐 Listens on <strong>everything</strong> — servers, groups, DMs.</div>`;
  }

  renderTokenSelector() {
    if (!this.allTokens.length) return '<div class="mm-info-row mm-muted">No connected accounts. Defaults to active.</div>';
    return `
      <div class="mm-token-grid">
        ${this.allTokens.map(t => `
          <label class="mm-token-chip ${this.tokens.includes(t.name) ? 'on' : ''}">
            <input type="checkbox" ${this.tokens.includes(t.name) ? 'checked' : ''} onchange="window.reactionManager.toggleToken('${t.name}', this.checked)">
            <img src="${t.avatar || '/discord.png'}" onerror="this.src='/discord.png'">
            <div><strong>${this.escHtml(t.name)}</strong><span>${this.escHtml(t.username || '')}</span></div>
          </label>`).join('')}
      </div>
      <div class="mm-token-actions">
        <button class="mm-btn ghost small" onclick="window.reactionManager.selectAll(true)">Select all</button>
        <button class="mm-btn ghost small" onclick="window.reactionManager.selectAll(false)">Clear</button>
      </div>
    `;
  }

  renderActive() {
    return `
      <div class="mm-card mm-span-2">
        <div class="mm-card-head"><span class="mm-card-icon">⚙️</span><div><div class="mm-card-title">Active Listeners</div><div class="mm-card-desc">Currently running on the server</div></div></div>
        <div id="rm-listeners">${this.renderListeners()}</div>
        <button class="mm-btn ghost small" onclick="window.reactionManager.refreshListeners()">↻ Refresh</button>
      </div>
    `;
  }

  renderListeners() {
    if (!this.listeners.length) return '<div class="mm-info-row mm-muted">No active listeners.</div>';
    return this.listeners.map(l => `
      <div class="mm-job-item">
        <div>
          <strong>${l.mode === 'mirror' ? '🪞 Mirror' : '🎯 Specific'}</strong>
          <span class="mm-job-meta">scope: ${this.escHtml(l.scope?.type)} · accounts: ${l.tokens?.length || 1} · emojis: ${l.emojis?.length || 0} · buttons: ${l.buttonNames?.length || 0}</span>
        </div>
        <button class="mm-btn danger small" onclick="window.reactionManager.stop('${l.id}')">Stop</button>
      </div>
    `).join('');
  }

  toggleToken(n, on) {
    if (on && !this.tokens.includes(n)) this.tokens.push(n);
    else if (!on) this.tokens = this.tokens.filter(x => x !== n);
  }
  selectAll(all) { this.tokens = all ? this.allTokens.map(t => t.name) : []; this.render(); }

  async actionStart() {
    let scope;
    if (this.activeTab === 'all')          scope = { type: 'all' };
    else if (this.activeTab === 'server')  scope = this.scopeId ? { type: 'server', id: this.scopeId } : null;
    else if (this.activeTab === 'group')   scope = this.scopeId ? { type: 'group',  id: this.scopeId } : null;
    else if (this.activeTab === 'dm')      scope = this.scopeId ? { type: 'dm',     id: this.scopeId } : null;
    if (!scope) return showNotification('Pick a target');

    const emojis = (this.emojis || '').split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
    const buttonNames = (this.buttons || '').split(/[,]+/).map(s => s.trim()).filter(Boolean);
    if (this.mode === 'specific' && !emojis.length && !buttonNames.length) return showNotification('Add emojis or button names');

    try {
      const r = await window.electronAPI.startReactions({ tokens: this.tokens, scope, mode: this.mode, emojis, buttonNames });
      if (r.success) { showNotification(`Listener started: ${r.listenerId}`); this.switchTab('active'); }
      else showNotification('Failed: ' + r.error);
    } catch (e) { showNotification('Failed: ' + e.message); }
  }

  async stop(id) { await window.electronAPI.stopReactions(id); this.refreshListeners(); }

  escHtml(t) { if (t == null) return ''; return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
}
