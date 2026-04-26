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
