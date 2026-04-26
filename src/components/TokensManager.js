// Tokens Manager — multi-account control center
import { showNotification } from '../utils/ui.js';
import { t } from '../utils/i18n.js';

export class TokensManager {
  constructor(contentArea) {
    this.contentArea = contentArea;
    this.tokens = [];
    this.clients = [];
    this.activeTab = 'accounts'; // accounts | presence | bio | avatar | rotate | activity
    this.selected = [];

    this.pStatus = 'online';
    this.pCustom = '';
    this.pEmoji  = '';
    this.bioText = '';
    this.avatarDataUrl = '';
    this.avatarFileName = '';

    this.rotInterval = 120;
    this.rotStates = [{ status: 'online', customStatus: '', emoji: '' }];

    this.actMin = 60;
    this.actMax = 600;
    this.actModes = { online: true, idle: true, invisible: true, dnd: false };
    this.actRunning = [];
  }

  async init() {
    await this.refresh();
    this.render();
  }

  async refresh() {
    try {
      const [tk, cl, ac] = await Promise.all([
        window.electronAPI.getTokens(),
        window.electronAPI.listClients(),
        window.electronAPI.listActivity ? window.electronAPI.listActivity() : Promise.resolve({ success: true, running: [] })
      ]);
      this.tokens = tk.success ? tk.tokens : [];
      this.clients = cl.success ? cl.clients : [];
      this.actRunning = ac.success ? (ac.running || []) : [];
    } catch (e) { /* ignore */ }
  }

  render() {
    this.contentArea.innerHTML = `
      <div class="mm-page">
        <div class="mm-header glass">
          <div class="mm-title-row">
            <span class="mm-icon pulse">🔑</span>
            <div>
              <h2 class="mm-title">${t('tk.title')}</h2>
              <p class="mm-subtitle">${t('tk.subtitle')}</p>
            </div>
          </div>
          <div class="mm-tabs">
            ${this.tabBtn('accounts', '🗝️', t('tk.tab.accounts'))}
            ${this.tabBtn('presence', '🟢', t('tk.tab.presence'))}
            ${this.tabBtn('bio',      '📝', t('tk.tab.bio'))}
            ${this.tabBtn('avatar',   '🖼️', t('tk.tab.avatar'))}
            ${this.tabBtn('rotate',   '🔄', t('tk.tab.rotate'))}
            ${this.tabBtn('activity', '🧠', t('tk.tab.activity'))}
          </div>
        </div>
        <div class="mm-body fade-in">
          ${this.renderTab()}
        </div>
      </div>
    `;
  }

  tabBtn(id, icon, label) {
    return `<button class="mm-tab ${this.activeTab === id ? 'active' : ''}" onclick="window.tokensManager.switchTab('${id}')"><span>${icon}</span> ${label}</button>`;
  }
  switchTab(tab) { this.activeTab = tab; this.render(); }

  renderTab() {
    switch (this.activeTab) {
      case 'accounts': return this.renderAccounts();
      case 'presence': return this.renderPresence();
      case 'bio':      return this.renderBio();
      case 'avatar':   return this.renderAvatar();
      case 'rotate':   return this.renderRotate();
      case 'activity': return this.renderActivity();
    }
    return '';
  }

  // ─── Accounts tab
  renderAccounts() {
    return `
      <div class="mm-card mm-span-2 lift">
        <div class="mm-card-head"><span class="mm-card-icon">➕</span><div><div class="mm-card-title">${t('tk.add_token')}</div><div class="mm-card-desc">${t('tk.add_desc')}</div></div></div>
        <div class="mm-row-fields">
          <input id="tk-name"  placeholder="${t('tk.account_name')}">
          <input id="tk-token" placeholder="${t('tk.discord_token')}" type="password">
          <label class="mm-toggle"><input type="checkbox" id="tk-auto"> ${t('tk.auto_connect')}</label>
          <button class="mm-btn primary glow" onclick="window.tokensManager.addToken()">${t('tk.save')}</button>
        </div>
      </div>

      <div class="mm-card mm-span-2 lift">
        <div class="mm-card-head">
          <span class="mm-card-icon">🗂️</span>
          <div><div class="mm-card-title">${t('tk.saved_connected')}</div><div class="mm-card-desc">${t('tk.saved_desc')}</div></div>
        </div>
        <div class="tk-list">${this.renderTokenList()}</div>
      </div>
    `;
  }

  renderTokenList() {
    const allNames = new Set([...this.tokens.map(t => t.name), ...this.clients.map(c => c.name)]);
    if (!allNames.size) return `<div class="mm-info-row mm-muted">${t('tk.no_accounts')}</div>`;
    return Array.from(allNames).map(name => {
      const saved = this.tokens.find(x => x.name === name);
      const conn  = this.clients.find(c => c.name === name);
      const isActive = !!conn?.active;
      return `
        <div class="tk-item ${isActive ? 'active' : ''} pop">
          <img src="${conn?.avatar || '/discord.png'}" onerror="this.src='/discord.png'" class="tk-av">
          <div class="tk-info">
            <div class="tk-name-row">
              <strong>${this.escHtml(name)}</strong>
              ${conn ? `<span class="tk-pill ok">connected</span>` : ''}
              ${saved?.autoConnect ? `<span class="tk-pill auto">auto</span>` : ''}
              ${isActive ? `<span class="tk-pill act">active</span>` : ''}
              ${this.actRunning.includes(name) ? `<span class="tk-pill sim">simulator</span>` : ''}
            </div>
            <div class="tk-tag">${this.escHtml(conn?.username || (saved ? 'saved' : 'no token saved'))}</div>
            <div class="tk-status">${this.dotFor(conn?.status)}</div>
          </div>
          <div class="tk-actions">
            ${conn ? '' : `<button class="mm-btn primary small" onclick="window.tokensManager.connectSaved('${this.esc(name)}')">${t('tk.connect')}</button>`}
            ${conn && !isActive ? `<button class="mm-btn ghost small" onclick="window.tokensManager.makeActive('${this.esc(name)}')">${t('tk.make_active')}</button>` : ''}
            ${conn ? `<button class="mm-btn warning small" onclick="window.tokensManager.disconnectSaved('${this.esc(name)}')">${t('tk.dc')}</button>` : ''}
            ${saved ? `<button class="mm-btn ghost small" onclick="window.tokensManager.toggleAuto('${this.esc(name)}', ${!saved.autoConnect})">${saved.autoConnect ? t('tk.disable_auto') : t('tk.enable_auto')}</button>` : ''}
            ${saved ? `<button class="mm-btn danger small" onclick="window.tokensManager.deleteToken('${this.esc(name)}')">${t('tk.delete')}</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  dotFor(status) {
    const colors = { online: '#27ae60', idle: '#e0a335', dnd: '#e03535', invisible: '#777', offline: '#777' };
    if (!status) return '';
    return `<span class="tk-dot" style="background:${colors[status] || '#777'}"></span><span class="tk-status-text">${status}</span>`;
  }

  async addToken() {
    const name = document.getElementById('tk-name').value.trim();
    const token = document.getElementById('tk-token').value.trim();
    const auto = document.getElementById('tk-auto').checked;
    if (!name || !token) return showNotification('Name and token required');
    const r = await window.electronAPI.saveToken(name, token, auto);
    if (!r.success) return showNotification(r.error);
    showNotification('Saved');
    document.getElementById('tk-name').value = '';
    document.getElementById('tk-token').value = '';
    document.getElementById('tk-auto').checked = false;
    if (auto) {
      const c = await window.electronAPI.connectSaved(name);
      if (c.success) showNotification(`Connected: ${name}`);
    }
    await this.refresh(); this.render();
  }

  async connectSaved(name) {
    showNotification(`Connecting ${name}…`);
    const r = await window.electronAPI.connectSaved(name);
    if (r.success) showNotification(`✓ ${name}`); else showNotification(`Failed: ${r.error}`);
    await this.refresh(); this.render();
  }
  async disconnectSaved(name) {
    await window.electronAPI.disconnectSaved(name);
    await this.refresh(); this.render();
  }
  async makeActive(name) {
    await window.electronAPI.setActiveClient(name);
    showNotification(`Active: ${name}`);
    await this.refresh(); this.render();
    window.dispatchEvent(new CustomEvent('active-client-changed'));
  }
  async toggleAuto(name, val) {
    await window.electronAPI.updateToken(name, { autoConnect: val });
    await this.refresh(); this.render();
  }
  async deleteToken(name) {
    await window.electronAPI.deleteToken(name);
    await this.refresh(); this.render();
  }

  // ─── Token chips (selection) shared
  renderTokenChips() {
    if (!this.clients.length) return `<div class="mm-info-row mm-muted">${t('tk.no_accounts')}</div>`;
    return `
      <div class="mm-token-grid">
        ${this.clients.map(c => `
          <label class="mm-token-chip ${this.selected.includes(c.name) ? 'on' : ''}">
            <input type="checkbox" ${this.selected.includes(c.name) ? 'checked' : ''} onchange="window.tokensManager.toggleSelected('${this.esc(c.name)}', this.checked)">
            <img src="${c.avatar || '/discord.png'}" onerror="this.src='/discord.png'">
            <div><strong>${this.escHtml(c.name)}</strong><span>${this.escHtml(c.username || '')}</span></div>
          </label>`).join('')}
      </div>
      <div class="mm-token-actions">
        <button class="mm-btn ghost small" onclick="window.tokensManager.selectAll(true)">${t('tk.select_all')}</button>
        <button class="mm-btn ghost small" onclick="window.tokensManager.selectAll(false)">${t('tk.clear_sel')}</button>
      </div>
    `;
  }
  toggleSelected(n, on) { if (on && !this.selected.includes(n)) this.selected.push(n); else if (!on) this.selected = this.selected.filter(x => x !== n); }
  selectAll(all) { this.selected = all ? this.clients.map(c => c.name) : []; this.render(); }
  _allConnectedNames() { return this.clients.map(c => c.name); }

  // ─── Presence tab
  renderPresence() {
    return `
      <div class="mm-card lift">
        <div class="mm-card-head"><span class="mm-card-icon">🎯</span><div><div class="mm-card-title">${t('tk.apply_to')}</div><div class="mm-card-desc">${t('tk.apply_to_desc')}</div></div></div>
        ${this.renderTokenChips()}
      </div>

      <div class="mm-card lift">
        <div class="mm-card-head"><span class="mm-card-icon">🟢</span><div><div class="mm-card-title">${t('tk.online_status')}</div><div class="mm-card-desc">${t('tk.online_desc')}</div></div></div>
        <div class="mm-radio-group">
          ${['online','idle','dnd','invisible'].map(s => `
            <label class="mm-radio ${this.pStatus === s ? 'active' : ''}">
              <input type="radio" name="tk-pstatus" value="${s}" ${this.pStatus === s ? 'checked' : ''} onchange="window.tokensManager.pStatus='${s}'">
              <div><strong>${s.toUpperCase()}</strong><span>${this.statusDesc(s)}</span></div>
            </label>`).join('')}
        </div>
      </div>

      <div class="mm-card mm-span-2 lift">
        <div class="mm-card-head"><span class="mm-card-icon">💬</span><div><div class="mm-card-title">${t('tk.custom_status')}</div><div class="mm-card-desc">${t('tk.custom_desc')}</div></div></div>
        <div class="mm-row-fields">
          <input placeholder="${t('tk.emoji')}" value="${this.escHtml(this.pEmoji)}" oninput="window.tokensManager.pEmoji=this.value">
          <input placeholder="${t('tk.status_text')}" value="${this.escHtml(this.pCustom)}" oninput="window.tokensManager.pCustom=this.value">
        </div>
        <div class="mm-actions-row">
          <button class="mm-btn primary glow" onclick="window.tokensManager.applyPresence()">${t('tk.apply')}</button>
          <button class="mm-btn ghost"   onclick="window.tokensManager.clearCustom()">${t('tk.clear_custom')}</button>
          <button class="mm-btn success"  onclick="window.tokensManager.applyPresence(true)">${t('tk.apply_all')}</button>
        </div>
      </div>
    `;
  }

  statusDesc(s) {
    return ({ online:'Active', idle:'Away', dnd:'Do Not Disturb', invisible:'Appear offline' })[s] || '';
  }

  async applyPresence(all = false) {
    try {
      const tokens = all ? this._allConnectedNames() : this.selected;
      const r = await window.electronAPI.setPresence({
        tokens,
        status: this.pStatus,
        customStatus: this.pCustom,
        emoji: this.pEmoji || undefined
      });
      const ok = (r.results || []).filter(x => x.ok).length;
      const fail = (r.results || []).length - ok;
      showNotification(`Applied ✓ ${ok}  ✗ ${fail}`);
    } catch (e) { showNotification('Failed: ' + e.message); }
  }
  async clearCustom() { this.pCustom = ''; this.pEmoji = ''; await this.applyPresence(); }

  // ─── Bio tab
  renderBio() {
    return `
      <div class="mm-card lift">
        <div class="mm-card-head"><span class="mm-card-icon">🎯</span><div><div class="mm-card-title">${t('tk.apply_to')}</div><div class="mm-card-desc">${t('tk.apply_to_desc')}</div></div></div>
        ${this.renderTokenChips()}
      </div>
      <div class="mm-card mm-span-2 lift">
        <div class="mm-card-head"><span class="mm-card-icon">📝</span><div><div class="mm-card-title">${t('tk.profile_bio')}</div><div class="mm-card-desc">${t('tk.profile_bio_desc')}</div></div></div>
        <div class="mm-field">
          <textarea rows="6" placeholder="${t('tk.your_bio')}" oninput="window.tokensManager.bioText=this.value">${this.escHtml(this.bioText)}</textarea>
        </div>
        <div class="mm-actions-row">
          <button class="mm-btn primary glow" onclick="window.tokensManager.applyBio()">${t('tk.apply_bio')}</button>
          <button class="mm-btn success" onclick="window.tokensManager.applyBio(true)">${t('tk.apply_all')}</button>
        </div>
      </div>
    `;
  }
  async applyBio(all = false) {
    const tokens = all ? this._allConnectedNames() : this.selected;
    const r = await window.electronAPI.setBio({ tokens, bio: this.bioText });
    const ok = (r.results || []).filter(x => x.ok).length;
    const fail = (r.results || []).length - ok;
    showNotification(`Bio ✓ ${ok}  ✗ ${fail}`);
  }

  // ─── Avatar tab
  renderAvatar() {
    return `
      <div class="mm-card lift">
        <div class="mm-card-head"><span class="mm-card-icon">🎯</span><div><div class="mm-card-title">${t('tk.apply_to')}</div><div class="mm-card-desc">${t('tk.apply_to_desc')}</div></div></div>
        ${this.renderTokenChips()}
      </div>
      <div class="mm-card mm-span-2 lift">
        <div class="mm-card-head"><span class="mm-card-icon">🖼️</span><div><div class="mm-card-title">${t('tk.profile_avatar')}</div><div class="mm-card-desc">${t('tk.profile_avatar_desc')}</div></div></div>
        <div class="tk-avatar-pick">
          <div class="tk-avatar-preview">
            <img id="tk-av-img" src="${this.avatarDataUrl || '/discord.png'}" onerror="this.src='/discord.png'">
          </div>
          <div class="tk-avatar-controls">
            <input type="file" id="tk-av-file" accept="image/*" hidden onchange="window.tokensManager.onPickAvatar(event)">
            <button class="mm-btn ghost" onclick="document.getElementById('tk-av-file').click()">📁 ${t('tk.choose_image')}</button>
            <span class="tk-av-name">${this.escHtml(this.avatarFileName || '—')}</span>
          </div>
        </div>
        <div class="mm-actions-row">
          <button class="mm-btn primary glow" onclick="window.tokensManager.applyAvatar()">${t('tk.apply_avatar')}</button>
          <button class="mm-btn success" onclick="window.tokensManager.applyAvatar(true)">${t('tk.apply_all')}</button>
        </div>
      </div>
    `;
  }
  onPickAvatar(ev) {
    const file = ev.target.files?.[0]; if (!file) return;
    if (file.size > 8 * 1024 * 1024) return showNotification('Image too large (max 8MB)');
    const r = new FileReader();
    r.onload = () => {
      this.avatarDataUrl = r.result;
      this.avatarFileName = file.name;
      const img = document.getElementById('tk-av-img');
      if (img) img.src = r.result;
      const span = document.querySelector('.tk-av-name');
      if (span) span.textContent = file.name;
    };
    r.readAsDataURL(file);
  }
  async applyAvatar(all = false) {
    if (!this.avatarDataUrl) return showNotification('Choose an image first');
    const tokens = all ? this._allConnectedNames() : this.selected;
    const r = await window.electronAPI.setAvatar({ tokens, avatar: this.avatarDataUrl });
    const ok = (r.results || []).filter(x => x.ok).length;
    const fail = (r.results || []).length - ok;
    showNotification(`Avatar ✓ ${ok}  ✗ ${fail}`);
  }

  // ─── Rotate tab
  renderRotate() {
    return `
      <div class="mm-card lift">
        <div class="mm-card-head"><span class="mm-card-icon">🎯</span><div><div class="mm-card-title">${t('tk.apply_to')}</div><div class="mm-card-desc">${t('tk.apply_to_desc')}</div></div></div>
        ${this.renderTokenChips()}
      </div>
      <div class="mm-card lift">
        <div class="mm-card-head"><span class="mm-card-icon">⏱️</span><div><div class="mm-card-title">${t('tk.interval')}</div><div class="mm-card-desc">${t('tk.interval_desc')}</div></div></div>
        <div class="mm-field"><input type="number" min="15" value="${this.rotInterval}" oninput="window.tokensManager.rotInterval=parseInt(this.value||'15')"></div>
      </div>
      <div class="mm-card mm-span-2 lift">
        <div class="mm-card-head"><span class="mm-card-icon">🎬</span><div><div class="mm-card-title">${t('tk.status_seq')}</div><div class="mm-card-desc">${t('tk.status_seq_desc')}</div></div></div>
        <div id="tk-rot-states">${this.renderRotStates()}</div>
        <button class="mm-btn ghost mm-add-msg" onclick="window.tokensManager.addRotState()">${t('tk.add_status')}</button>
        <div class="mm-actions-row">
          <button class="mm-btn primary glow" onclick="window.tokensManager.startRotate()">${t('tk.start_rotation')}</button>
          <button class="mm-btn danger"  onclick="window.tokensManager.stopRotate()">${t('tk.stop_rotation')}</button>
          <button class="mm-btn success" onclick="window.tokensManager.startRotate(true)">${t('tk.apply_all')}</button>
        </div>
      </div>
    `;
  }
  renderRotStates() {
    return this.rotStates.map((s, i) => `
      <div class="mm-msg-panel">
        <div class="mm-msg-head">
          <span>State #${i + 1}</span>
          ${this.rotStates.length > 1 ? `<button class="mm-x" onclick="window.tokensManager.removeRotState(${i})">✕</button>` : ''}
        </div>
        <div class="mm-row-fields">
          <select onchange="window.tokensManager.rotStates[${i}].status=this.value">
            ${['online','idle','dnd','invisible'].map(x => `<option value="${x}" ${s.status === x ? 'selected' : ''}>${x}</option>`).join('')}
          </select>
          <input placeholder="${t('tk.emoji')}" value="${this.escHtml(s.emoji)}" oninput="window.tokensManager.rotStates[${i}].emoji=this.value">
          <input placeholder="${t('tk.status_text')}" value="${this.escHtml(s.customStatus)}" oninput="window.tokensManager.rotStates[${i}].customStatus=this.value">
        </div>
      </div>
    `).join('');
  }
  addRotState() { this.rotStates.push({ status: 'online', customStatus: '', emoji: '' }); document.getElementById('tk-rot-states').innerHTML = this.renderRotStates(); }
  removeRotState(i) { this.rotStates.splice(i, 1); document.getElementById('tk-rot-states').innerHTML = this.renderRotStates(); }

  async startRotate(all = false) {
    const states = this.rotStates.filter(s => s.status || s.customStatus || s.emoji);
    if (!states.length) return showNotification('Add at least one state');
    const tokens = all ? this._allConnectedNames() : this.selected;
    const r = await window.electronAPI.startRotation({ tokens, states, intervalMs: this.rotInterval * 1000 });
    if (r.success) showNotification(`Rotation started for ${(r.rotating || []).length} account(s)`);
    else showNotification('Failed: ' + r.error);
  }
  async stopRotate() {
    await window.electronAPI.stopRotation({ tokens: this.selected });
    showNotification('Rotation stopped');
  }

  // ─── Activity Simulator tab
  renderActivity() {
    return `
      <div class="mm-card lift">
        <div class="mm-card-head"><span class="mm-card-icon">🎯</span><div><div class="mm-card-title">${t('tk.apply_to')}</div><div class="mm-card-desc">${t('tk.apply_to_desc')}</div></div></div>
        ${this.renderTokenChips()}
      </div>
      <div class="mm-card lift">
        <div class="mm-card-head"><span class="mm-card-icon">⏱️</span><div><div class="mm-card-title">${t('tk.activity_min')} / ${t('tk.activity_max')}</div><div class="mm-card-desc">${t('tk.activity_desc')}</div></div></div>
        <div class="mm-row-fields">
          <input type="number" min="15" value="${this.actMin}" oninput="window.tokensManager.actMin=parseInt(this.value||'60')" placeholder="${t('tk.activity_min')}">
          <input type="number" min="30" value="${this.actMax}" oninput="window.tokensManager.actMax=parseInt(this.value||'600')" placeholder="${t('tk.activity_max')}">
        </div>
      </div>
      <div class="mm-card mm-span-2 lift">
        <div class="mm-card-head"><span class="mm-card-icon">🧠</span><div><div class="mm-card-title">${t('tk.activity_title')}</div><div class="mm-card-desc">${t('tk.activity_modes')}</div></div></div>
        <div class="mm-radio-group" style="margin-top:8px">
          ${['online','idle','invisible','dnd'].map(m => `
            <label class="mm-radio ${this.actModes[m] ? 'active' : ''}">
              <input type="checkbox" ${this.actModes[m] ? 'checked' : ''} onchange="window.tokensManager.actModes['${m}']=this.checked; this.parentElement.classList.toggle('active', this.checked)">
              <div><strong>${m.toUpperCase()}</strong><span>${this.statusDesc(m)}</span></div>
            </label>`).join('')}
        </div>
        <div class="mm-actions-row">
          <button class="mm-btn primary glow" onclick="window.tokensManager.startActivity()">${t('tk.start_activity')}</button>
          <button class="mm-btn danger" onclick="window.tokensManager.stopActivity()">${t('tk.stop_activity')}</button>
          <button class="mm-btn success" onclick="window.tokensManager.startActivity(true)">${t('tk.apply_all')}</button>
        </div>
        ${this.actRunning.length ? `<div class="mm-info-row" style="margin-top:14px"><strong>Simulating:</strong> ${this.actRunning.map(n => `<span class="tk-pill sim">${this.escHtml(n)}</span>`).join(' ')}</div>` : ''}
      </div>
    `;
  }
  async startActivity(all = false) {
    const tokens = all ? this._allConnectedNames() : this.selected;
    const modes = Object.keys(this.actModes).filter(k => this.actModes[k]);
    if (!modes.length) return showNotification('Pick at least one mode');
    const r = await window.electronAPI.startActivity({ tokens, modes, minSec: this.actMin, maxSec: this.actMax });
    if (r.success) {
      showNotification(`Simulator started for ${(r.simulating || []).length} account(s)`);
      this.actRunning = r.simulating || [];
      this.render();
    } else showNotification('Failed: ' + r.error);
  }
  async stopActivity() {
    const r = await window.electronAPI.stopActivity({ tokens: this.selected });
    showNotification(`Simulator stopped`);
    await this.refresh(); this.render();
  }

  esc(s) { return String(s).replace(/'/g, "\\'"); }
  escHtml(t) { if (t == null) return ''; return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
}
