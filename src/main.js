import { checkForUpdates } from './utils/updates.js';
import { loadSavedTokens, saveToken } from './utils/tokenManager.js';
import { DMManager } from './components/DMManager.js';
import { ServerManager } from './components/ServerManager.js';
import { FriendsManager } from './components/FriendsManager.js';
import { GroupManager } from './components/GroupManager.js';
import { OldManager } from './components/OldManager.js';
import { MessagesManager } from './components/MessagesManager.js';
import { ReactionManager } from './components/ReactionManager.js';
import { TokensManager } from './components/TokensManager.js';
import { showInfoModal } from './utils/ui.js';
import { copyToClipboard } from './utils/clipboard.js';
import { getFriendsList } from './utils/discord.js';

// ── Theme toggle ──
(function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') document.body.classList.add('light-theme');
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = saved === 'light' ? '☀️' : '🌙';
})();

document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light-theme');
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = isLight ? '☀️' : '🌙';
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

// Discord-style default avatar (used for Test mode)
const DISCORD_DEFAULT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="32" fill="#5865F2"/>
  <path fill="#fff" d="M44.6 19.5c-2.3-1-4.7-1.8-7.3-2.2-.3.6-.7 1.4-1 2-2.7-.4-5.4-.4-8 0-.3-.6-.7-1.4-1-2-2.5.5-5 1.3-7.3 2.3-4.6 6.9-5.8 13.6-5.2 20.2 3.1 2.3 6 3.7 8.9 4.6.7-1 1.4-2 1.9-3.1-1.1-.4-2.1-.9-3.1-1.5.3-.2.5-.4.8-.6 5.9 2.7 12.4 2.7 18.3 0 .3.2.5.4.8.6-1 .6-2 1.1-3.1 1.5.6 1.1 1.2 2.1 1.9 3.1 2.9-.9 5.8-2.3 8.9-4.6.7-7.7-1.2-14.3-5.2-20.2zM25.4 36.1c-1.8 0-3.2-1.6-3.2-3.6s1.4-3.6 3.2-3.6 3.3 1.6 3.2 3.6c0 2-1.4 3.6-3.2 3.6zm13.1 0c-1.8 0-3.2-1.6-3.2-3.6s1.4-3.6 3.2-3.6 3.3 1.6 3.2 3.6c0 2-1.4 3.6-3.2 3.6z"/>
</svg>`)}`;

window._discordDefaultAvatar = DISCORD_DEFAULT_AVATAR;

window.dmManager       = new DMManager(document.getElementById('dms-page'));
window.serverManager   = new ServerManager(document.getElementById('servers-page'));
window.friendsManager  = new FriendsManager(document.getElementById('friends-page'));
window.groupManager    = new GroupManager(document.getElementById('groups-page'));
window.oldManager      = new OldManager(document.getElementById('history-page'));
window.messagesManager = new MessagesManager(document.getElementById('messages-page'));
window.reactionManager = new ReactionManager(document.getElementById('reactions-page'));
window.tokensManager   = new TokensManager(document.getElementById('tokens-page'));

window.copyToClipboard = copyToClipboard;
window.getFriendsList = getFriendsList;

// Copy message link with animated feedback
window.copyMessageLink = async (btn, link) => {
  try {
    await navigator.clipboard.writeText(link);
    btn.classList.add('copied');
    const lbl = btn.querySelector('.om-copy-link-text');
    const orig = lbl ? lbl.textContent : '';
    if (lbl) lbl.textContent = 'Copied!';
    setTimeout(() => {
      btn.classList.remove('copied');
      if (lbl) lbl.textContent = orig;
    }, 1400);
  } catch (e) {
    console.error('Failed to copy link:', e);
  }
};

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page-container');
const userProfile = document.getElementById('userProfile');
const loginNavItem = document.getElementById('loginNavItem');

function showUserProfile(username, avatar) {
  const userInitial = document.getElementById('userInitial');
  const userName = document.getElementById('userName');
  const userAvatarImg = document.getElementById('userAvatarImg');
  const userAvatarBox = document.getElementById('userAvatar');

  userName.textContent = username;
  if (avatar) {
    userAvatarImg.src = avatar;
    userAvatarImg.style.display = 'block';
    userAvatarBox.style.display = 'none';
  } else {
    userInitial.textContent = (username || '?').charAt(0).toUpperCase();
    userAvatarImg.style.display = 'none';
    userAvatarBox.style.display = 'flex';
  }
  userProfile.classList.add('visible');
}

function hideUserProfile() {
  userProfile.classList.remove('visible');
}

function toggleNavItems(show) {
  document.querySelectorAll('.nav-item:not(#loginNavItem)').forEach(item => {
    item.classList.toggle('hidden', !show);
  });
  loginNavItem.classList.toggle('hidden', show);
}

function switchPage(pageId) {
  pages.forEach(page => {
    page.classList.remove('active');
    if (page.id === `${pageId}-page`) {
      setTimeout(() => page.classList.add('active'), 50);
    }
  });

  navItems.forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === pageId) item.classList.add('active');
  });

  switch (pageId) {
    case 'friends':   window.friendsManager.refreshFriendsList();   break;
    case 'servers':   window.serverManager.refreshServersList();    break;
    case 'dms':       window.dmManager.refreshDMsList();            break;
    case 'groups':    window.groupManager.refreshGroupsList();      break;
    case 'history':   window.oldManager.init();                      break;
    case 'messages':  window.messagesManager.init();                 break;
    case 'reactions': window.reactionManager.init();                 break;
    case 'tokens':    window.tokensManager.init();                   break;
  }
}

toggleNavItems(false);
switchPage('login');

navItems.forEach(item => {
  item.addEventListener('click', () => switchPage(item.dataset.page));
});

window.addEventListener('active-client-changed', () => {
  // Re-load some panels lazily on active switch
});

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await checkForUpdates();
    await loadSavedTokens();
  } catch (e) { console.error('Init error:', e); }
});

document.getElementById('minimizeBtn').addEventListener('click', () => {});
document.getElementById('maximizeBtn').addEventListener('click', () => {});
document.getElementById('closeBtn').addEventListener('click', () => {});
document.getElementById('infoBtn').addEventListener('click', showInfoModal);
document.getElementById('saveTokenBtn').addEventListener('click', () => saveToken(tokenInput.value, status));

document.getElementById('disconnectBtn').addEventListener('click', async () => {
  try { await window.electronAPI.disconnect(); } catch (e) {}
  hideUserProfile();
  toggleNavItems(false);
  switchPage('login');
  tokenInput.value = '';
  status.textContent = '';
});

const connectBtn = document.getElementById('connectBtn');
const tokenInput = document.getElementById('tokenInput');
const status = document.getElementById('status');

connectBtn.addEventListener('click', async () => {
  const token = tokenInput.value;
  if (!token) {
    status.textContent = 'Please enter a token';
    status.className = 'error';
    return;
  }

  const btnText = connectBtn.querySelector('.btn-text');
  const loader = connectBtn.querySelector('.loader');
  btnText.style.display = 'none';
  loader.style.display = 'inline-block';
  connectBtn.disabled = true;

  if (token.toLowerCase() === 'test') {
    window._testMode = true;
    status.textContent = 'Connected as Ahmed (Test)';
    status.className = 'success';
    showUserProfile('Ahmed (Test)', DISCORD_DEFAULT_AVATAR);
    toggleNavItems(true);
    switchPage('tokens');
    btnText.style.display = 'inline-block';
    loader.style.display = 'none';
    connectBtn.disabled = false;
    return;
  }

  window._testMode = false;

  try {
    const result = await window.electronAPI.connectDiscord(token);
    if (result.success) {
      status.textContent = `Connected as ${result.username}`;
      status.className = 'success';
      // Try to fetch avatar from clients list
      let avatar = null;
      try {
        const cl = await window.electronAPI.listClients();
        const me = cl.success ? cl.clients.find(c => c.active) : null;
        avatar = me?.avatar || null;
      } catch (e) {}
      showUserProfile(result.username, avatar);
      toggleNavItems(true);
      switchPage('tokens');
    } else {
      status.textContent = result.error;
      status.className = 'error';
    }
  } catch (error) {
    status.textContent = 'Connection failed';
    status.className = 'error';
  } finally {
    btnText.style.display = 'inline-block';
    loader.style.display = 'none';
    connectBtn.disabled = false;
  }
});
