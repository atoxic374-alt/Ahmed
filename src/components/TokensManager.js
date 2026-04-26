// Tokens Manager — multi-account control center
import { showNotification, showInputModal } from '../utils/ui.js';

export class TokensManager {
  constructor(contentArea) {
    this.contentArea = contentArea;
    this.tokens = [];      // saved tokens (with autoConnect flag)
    this.clients = [];     // connected clients
    this.activeTab = 'accounts'; // accounts | presence | bio | rotate
    this.selected = [];    // selected token names for batch ops

    // presence form
    this.pStatus = 'online';
    this.pCustom = '';
    this.pEmoji  = '';
    // bio form
    this.bioText = '';
    // rotate form
    this.rotInterval = 120;
    this.rotStates = [{ status: 'online', customStatus: '', emoji: '' }];
  }

  async init() {
    await this.refresh();
    this.render();
  }

  async refresh() {
    try {
      const [tk, cl] = await Promise.all([
        window.electronAPI.getTokens(),
        window.electronAPI.listClients()
      ]);
      this.tokens = tk.success ? tk.tokens : [];
      this.clients = cl.success ? cl.clients : [];
    } catch (e) { /* ignore */ }
  }

  render() {
    this.contentArea.innerHTML = `
      <div class="mm-page">
        <div class="mm-header">
          <div class="mm-title-row">
            <span class="mm-icon">🔑</span>
            <div>
              <h2 class="mm-title">Tokens Manager</h2>
              <p class="mm-subtitle">Save, connect &amp; control multiple accounts at once.</p>
            </div>
          </div>
          <div class="mm-tabs">
            ${this.tabBtn('accounts', '🗝️', 'Accounts')}
            ${this.tabBtn('presence', '🟢', 'Presence')}
            ${this.tabBtn('bio',      '📝', 'Bio')}
            ${this.tabBtn('rotate',   '🔄', 'Rotate Status')}
          </div>
        </div>
        <div class="mm-body">
          ${this.renderTab()}
        </div>
      </div>
    `;
  }

  tabBtn(id, icon, label) {
    return `<button class="mm-tab ${this.activeTab === id ? 'active' : ''}" onclick="window.tokensManager.switchTab('${id}')"><span>${icon}</span> ${label}</button>`;
  }
  switchTab(t) { this.activeTab = t; this.render(); }

  renderTab() {
    if (this.activeTab === 'accounts') return this.renderAccounts();
    if (this.activeTab === 'presence') return this.renderPresence();
    if (this.activeTab === 'bio')      return this.renderBio();
    if (this.activeTab === 'rotate')   return this.renderRotate();
    return '';
  }

  // ─── Accounts tab
  renderAccounts() {
    return `
      <div class="mm-card mm-span-2">
        <div class="mm-card-head"><span class="mm-card-icon">➕</span><div><div class="mm-card-title">Add Token</div><div class="mm-card-desc">Save a Discord token; optionally auto-connect at startup</div></div></div>
        <div class="mm-row-fields">
          <input id="tk-name"  placeholder="Account name (e.g. main)">
          <input id="tk-token" placeholder="Discord token" type="password">
          <label class="mm-toggle"><input type="checkbox" id="tk-auto"> Auto-connect on start</label>
          <button class="mm-btn primary" onclick="window.tokensManager.addToken()">Save</button>
        </div>
      </div>

      <div class="mm-card mm-span-2">
        <div class="mm-card-head">
          <span class="mm-card-icon">🗂️</span>
          <div><div class="mm-card-title">Saved &amp; Connected</div><div class="mm-card-desc">Click an account to make it active in the UI</div></div>
        </div>
        <div class="tk-list">${this.renderTokenList()}</div>
      </div>
    `;
  }

  renderTokenList() {
    const allNames = new Set([...this.tokens.map(t => t.name), ...this.clients.map(c => c.name)]);
    if (!allNames.size) return '<div class="mm-info-row mm-muted">No saved or connected accounts yet.</div>';
    return Array.from(allNames).map(name => {
      const saved = this.tokens.find(t => t.name === name);
      const conn  = this.clients.find(c => c.name === name);
      const isActive = !!conn?.active;
      return `
        <div class="tk-item ${isActive ? 'active' : ''}">
          <img src="${conn?.avatar || '/discord.png'}" onerror="this.src='/discord.png'" class="tk-av">
          <div class="tk-info">
            <div class="tk-name-row">
              <strong>${this.escHtml(name)}</strong>
              ${conn ? `<span class="tk-pill ok">connected</span>` : ''}
              ${saved?.autoConnect ? `<span class="tk-pill auto">auto</span>` : ''}
              ${isActive ? `<span class="tk-pill act">active</span>` : ''}
            </div>
            <div class="tk-tag">${this.escHtml(conn?.username || (saved ? 'saved' : 'no token saved'))}</div>
            <div class="tk-status">${this.dotFor(conn?.status)}</div>
          </div>
          <div class="tk-actions">
            ${conn ? '' : `<button class="mm-btn primary small" onclick="window.tokensManager.connectSaved('${this.esc(name)}')">Connect</button>`}
            ${conn && !isActive ? `<button class="mm-btn ghost small" onclick="window.tokensManager.makeActive('${this.esc(name)}')">Make Active</button>` : ''}
            ${conn ? `<button class="mm-btn warning small" onclick="window.tokensManager.disconnectSaved('${this.esc(name)}')">Disconnect</button>` : ''}
            ${saved ? `<button class="mm-btn ghost small" onclick="window.tokensManager.toggleAuto('${this.esc(name)}', ${!saved.autoConnect})">${saved.autoConnect ? 'Disable Auto' : 'Enable Auto'}</button>` : ''}
            ${saved ? `<button class="mm-btn danger small" onclick="window.tokensManager.deleteToken('${this.esc(name)}')">Delete</button>` : ''}
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
    // Notify other managers to refresh
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

  // ─── Presence tab
  renderPresence() {
    return `
      <div class="mm-card">
        <div class="mm-card-head"><span class="mm-card-icon">🎯</span><div><div class="mm-card-title">Apply To</div><div class="mm-card-desc">Pick accounts (empty = active)</div></div></div>
        ${this.renderTokenChips()}
      </div>

      <div class="mm-card">
        <div class="mm-card-head"><span class="mm-card-icon">🟢</span><div><div class="mm-card-title">Online Status</div><div class="mm-card-desc">Set presence color</div></div></div>
        <div class="mm-radio-group">
          ${['online','idle','dnd','invisible'].map(s => `
            <label class="mm-radio ${this.pStatus === s ? 'active' : ''}">
              <input type="radio" name="tk-pstatus" value="${s}" ${this.pStatus === s ? 'checked' : ''} onchange="window.tokensManager.pStatus='${s}'">
              <div><strong>${s.toUpperCase()}</strong><span>${this.statusDesc(s)}</span></div>
            </label>`).join('')}
        </div>
      </div>

      <div class="mm-card mm-span-2">
        <div class="mm-card-head"><span class="mm-card-icon">💬</span><div><div class="mm-card-title">Custom Status</div><div class="mm-card-desc">Display under your name</div></div></div>
        <div class="mm-row-fields">
          <input placeholder="Emoji (e.g. 🔥 or :fire:)" value="${this.escHtml(this.pEmoji)}" oninput="window.tokensManager.pEmoji=this.value">
          <input placeholder="Status text" value="${this.escHtml(this.pCustom)}" oninput="window.tokensManager.pCustom=this.value">
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="mm-btn primary" onclick="window.tokensManager.applyPresence()">Apply</button>
          <button class="mm-btn ghost"   onclick="window.tokensManager.clearCustom()">Clear Custom</button>
        </div>
      </div>
    `;
  }

  statusDesc(s) {
    return ({ online:'Active', idle:'Away', dnd:'Do Not Disturb', invisible:'Appear offline' })[s] || '';
  }

  renderTokenChips() {
    if (!this.clients.length) return '<div class="mm-info-row mm-muted">No connected accounts.</div>';
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
        <button class="mm-btn ghost small" onclick="window.tokensManager.selectAll(true)">Select all</button>
        <button class="mm-btn ghost small" onclick="window.tokensManager.selectAll(false)">Clear</button>
      </div>
    `;
  }

  toggleSelected(n, on) { if (on && !this.selected.includes(n)) this.selected.push(n); else if (!on) this.selected = this.selected.filter(x => x !== n); }
  selectAll(all) { this.selected = all ? this.clients.map(c => c.name) : []; this.render(); }

  async applyPresence() {
    try {
      const r = await window.electronAPI.setPresence({
        tokens: this.selected,
        status: this.pStatus,
        customStatus: this.pCustom,
        emoji: this.pEmoji || undefined
      });
      const ok = (r.results || []).filter(x => x.ok).length;
      const fail = (r.results || []).length - ok;
      showNotification(`Applied ✓ ${ok}  ✗ ${fail}`);
    } catch (e) { showNotification('Failed: ' + e.message); }
  }

  async clearCustom() {
    this.pCustom = ''; this.pEmoji = '';
    await this.applyPresence();
  }

  // ─── Bio tab
  renderBio() {
    return `
      <div class="mm-card">
        <div class="mm-card-head"><span class="mm-card-icon">🎯</span><div><div class="mm-card-title">Apply To</div><div class="mm-card-desc">Pick accounts (empty = active)</div></div></div>
        ${this.renderTokenChips()}
      </div>
      <div class="mm-card mm-span-2">
        <div class="mm-card-head"><span class="mm-card-icon">📝</span><div><div class="mm-card-title">Profile Bio</div><div class="mm-card-desc">Set the about-me text</div></div></div>
        <div class="mm-field">
          <textarea rows="6" placeholder="Your bio…" oninput="window.tokensManager.bioText=this.value">${this.escHtml(this.bioText)}</textarea>
        </div>
        <button class="mm-btn primary" onclick="window.tokensManager.applyBio()">Apply Bio</button>
      </div>
    `;
  }
  async applyBio() {
    const r = await window.electronAPI.setBio({ tokens: this.selected, bio: this.bioText });
    const ok = (r.results || []).filter(x => x.ok).length;
    const fail = (r.results || []).length - ok;
    showNotification(`Bio ✓ ${ok}  ✗ ${fail}`);
  }

  // ─── Rotate tab
  renderRotate() {
    return `
      <div class="mm-card">
        <div class="mm-card-head"><span class="mm-card-icon">🎯</span><div><div class="mm-card-title">Apply To</div><div class="mm-card-desc">Pick accounts</div></div></div>
        ${this.renderTokenChips()}
      </div>
      <div class="mm-card">
        <div class="mm-card-head"><span class="mm-card-icon">⏱️</span><div><div class="mm-card-title">Interval</div><div class="mm-card-desc">Seconds between rotations (min 15s)</div></div></div>
        <div class="mm-field"><input type="number" min="15" value="${this.rotInterval}" oninput="window.tokensManager.rotInterval=parseInt(this.value||'15')"></div>
      </div>
      <div class="mm-card mm-span-2">
        <div class="mm-card-head"><span class="mm-card-icon">🎬</span><div><div class="mm-card-title">Status Sequence</div><div class="mm-card-desc">Loop through these statuses</div></div></div>
        <div id="tk-rot-states">${this.renderRotStates()}</div>
        <button class="mm-btn ghost mm-add-msg" onclick="window.tokensManager.addRotState()">＋ Add Status</button>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="mm-btn primary" onclick="window.tokensManager.startRotate()">▶ Start Rotation</button>
          <button class="mm-btn danger"  onclick="window.tokensManager.stopRotate()">■ Stop Rotation</button>
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
          <input placeholder="Emoji" value="${this.escHtml(s.emoji)}" oninput="window.tokensManager.rotStates[${i}].emoji=this.value">
          <input placeholder="Custom status text" value="${this.escHtml(s.customStatus)}" oninput="window.tokensManager.rotStates[${i}].customStatus=this.value">
        </div>
      </div>
    `).join('');
  }

  addRotState() { this.rotStates.push({ status: 'online', customStatus: '', emoji: '' }); document.getElementById('tk-rot-states').innerHTML = this.renderRotStates(); }
  removeRotState(i) { this.rotStates.splice(i, 1); document.getElementById('tk-rot-states').innerHTML = this.renderRotStates(); }

  async startRotate() {
    const states = this.rotStates.filter(s => s.status || s.customStatus || s.emoji);
    if (!states.length) return showNotification('Add at least one state');
    const r = await window.electronAPI.startRotation({
      tokens: this.selected, states, intervalMs: this.rotInterval * 1000
    });
    if (r.success) showNotification(`Rotation started for ${(r.rotating || []).length} account(s)`);
    else showNotification('Failed: ' + r.error);
  }

  async stopRotate() {
    await window.electronAPI.stopRotation({ tokens: this.selected });
    showNotification('Rotation stopped');
  }

  esc(s) { return String(s).replace(/'/g, "\\'"); }
  escHtml(t) { if (t == null) return ''; return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
}
