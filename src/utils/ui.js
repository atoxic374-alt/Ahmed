export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    showNotification('Copied to clipboard!');
  } catch (error) {
    console.error('Failed to copy:', error);
  }
};

export const showNotification = (message) => {
  const notification = document.createElement('div');
  notification.className = 'copy-notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2000);
};

// Discord-style preview toast for test mode — shows what would have been sent.
export const showTestPreview = (action, text, where, idx, total) => {
  const tag = ({ send: 'SEND', repeat: 'REPEAT', schedule: 'SCHEDULE', react: 'REACT' }[action] || 'TEST');
  const card = document.createElement('div');
  card.className = 'test-preview-card';
  const safe = String(text || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  card.innerHTML = `
    <div class="tp-head">
      <div class="tp-av">
        <svg viewBox="0 0 64 64" width="36" height="36">
          <rect width="64" height="64" rx="32" fill="#5865F2"/>
          <path fill="#fff" d="M44.6 19.5c-2.3-1-4.7-1.8-7.3-2.2-.3.6-.7 1.4-1 2-2.7-.4-5.4-.4-8 0-.3-.6-.7-1.4-1-2-2.5.5-5 1.3-7.3 2.3-4.6 6.9-5.8 13.6-5.2 20.2 3.1 2.3 6 3.7 8.9 4.6.7-1 1.4-2 1.9-3.1-1.1-.4-2.1-.9-3.1-1.5.3-.2.5-.4.8-.6 5.9 2.7 12.4 2.7 18.3 0 .3.2.5.4.8.6-1 .6-2 1.1-3.1 1.5.6 1.1 1.2 2.1 1.9 3.1 2.9-.9 5.8-2.3 8.9-4.6.7-7.7-1.2-14.3-5.2-20.2zM25.4 36.1c-1.8 0-3.2-1.6-3.2-3.6s1.4-3.6 3.2-3.6 3.3 1.6 3.2 3.6c0 2-1.4 3.6-3.2 3.6zm13.1 0c-1.8 0-3.2-1.6-3.2-3.6s1.4-3.6 3.2-3.6 3.3 1.6 3.2 3.6c0 2-1.4 3.6-3.2 3.6z"/>
        </svg>
      </div>
      <div class="tp-meta">
        <div class="tp-name">Ahmed (Test) <span class="tp-tag">${tag}</span></div>
        <div class="tp-where">→ ${where} ${total > 1 ? `· #${idx}/${total}` : ''}</div>
      </div>
      <button class="tp-x" aria-label="close">×</button>
    </div>
    <div class="tp-body">${safe || '<em>(empty message)</em>'}</div>
    <div class="tp-foot">AHMED · @4_3a</div>
  `;
  card.querySelector('.tp-x').addEventListener('click', () => card.remove());
  let host = document.getElementById('test-preview-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'test-preview-host';
    document.body.appendChild(host);
  }
  host.appendChild(card);
  setTimeout(() => card.classList.add('in'), 10);
  setTimeout(() => { card.classList.remove('in'); card.classList.add('out'); }, 6500);
  setTimeout(() => card.remove(), 7200);
};

export const showProgressModal = (title, total) => {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';

  const content = document.createElement('div');
  content.className = 'modal-content';

  const titleEl = document.createElement('h2');
  titleEl.textContent = title;

  const progressContainer = document.createElement('div');
  progressContainer.className = 'progress-container';

  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';

  const progress = document.createElement('div');
  progress.className = 'progress';
  progress.style.width = '0%';

  const progressText = document.createElement('div');
  progressText.className = 'progress-text';
  progressText.textContent = `0/${total}`;

  progressBar.appendChild(progress);
  progressContainer.appendChild(progressBar);
  progressContainer.appendChild(progressText);

  content.appendChild(titleEl);
  content.appendChild(progressContainer);
  modal.appendChild(content);

  document.body.appendChild(modal);

  return {
    updateProgress: (completed) => {
      const percent = (completed / total) * 100;
      progress.style.width = `${percent}%`;
      progressText.textContent = `${completed}/${total}`;
    },
    closeModal: () => modal.remove()
  };
};

export const showInfoModal = () => {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  const content = document.createElement('div');
  content.className = 'modal-content info-modal';

  content.innerHTML = `
    <div class="info-badge">
      <svg viewBox="0 0 24 24" width="42" height="42" fill="none">
        <circle cx="12" cy="12" r="11" stroke="#5865f2" stroke-width="1.5"/>
        <path d="M9 12l2 2 4-4" stroke="#5865f2" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <h2 class="info-app-name">Discord Account Manager</h2>
    <p class="info-version">Version 1.5.6</p>
    <div class="info-divider"></div>
    <div class="info-owner-card">
      <div class="info-owner-icon">A</div>
      <div class="info-owner-details">
        <span class="info-owner-label">Developed by</span>
        <span class="info-owner-name">Ahmed</span>
        <span class="info-owner-handle">@4_3a</span>
      </div>
    </div>
    <div class="info-rights">
      <span>© 2025 Ahmed — All Rights Reserved</span>
    </div>
    <button class="info-close-btn" id="infoCloseBtn">Close</button>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);
  modal.querySelector('#infoCloseBtn').addEventListener('click', () => modal.remove());
};

export const showInputModal = (title, message) => {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const titleEl = document.createElement('h2');
    titleEl.textContent = title;

    const messageEl = document.createElement('p');
    messageEl.textContent = message;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'modal-input';

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'button-group';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      const value = input.value.trim();
      if (value) {
        resolve(value);
        modal.remove();
      }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'secondary-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      resolve(null);
      modal.remove();
    });

    buttonGroup.appendChild(saveBtn);
    buttonGroup.appendChild(cancelBtn);

    content.appendChild(titleEl);
    content.appendChild(messageEl);
    content.appendChild(input);
    content.appendChild(buttonGroup);
    modal.appendChild(content);

    document.body.appendChild(modal);
    input.focus();
  });
};
