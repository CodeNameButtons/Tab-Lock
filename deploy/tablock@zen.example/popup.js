document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('content');
  const lockBtn = document.getElementById('lockCurrentTab');
  const settingsBtn = document.getElementById('settingsBtn');
  const backBtn = document.getElementById('backBtn');
  const headerTitle = document.getElementById('headerTitle');
  const settingsView = document.getElementById('settingsView');
  const mainFooter = document.getElementById('mainFooter');

  // Settings elements
  const range = document.getElementById('lockMinutes');
  const rangeVal = document.getElementById('lockValue');
  const saveBtn = document.getElementById('saveBtn');
  const savedMsg = document.getElementById('savedMsg');

  // Pending lock from context menu
  const pending = await browser.storage.local.get('pendingLock');
  if (pending.pendingLock) {
    await browser.storage.local.remove('pendingLock');
    const { tabId, url, title } = pending.pendingLock;
    const locked = await browser.runtime.sendMessage({ type: 'get-locked-tabs' });
    const already = locked.some(t => t.tabId === tabId);
    if (already) {
      browser.tabs.reload(tabId);
    } else {
      const result = await browser.runtime.sendMessage({ type: 'lock-tab', tabId, url, title });
      if (result.success) browser.tabs.reload(tabId);
    }
    window.close();
    return;
  }

  // Views
  function showMainView() {
    content.style.display = '';
    settingsView.style.display = 'none';
    mainFooter.style.display = '';
    backBtn.style.display = 'none';
    headerTitle.textContent = 'Tab Lock';
    loadList();
  }

  function showSettingsView() {
    content.style.display = 'none';
    settingsView.style.display = 'block';
    mainFooter.style.display = 'none';
    backBtn.style.display = '';
    headerTitle.textContent = 'Settings';
  }

  // Settings
  browser.storage.local.get('tabLockSettings').then(s => {
    const mins = (s.tabLockSettings && s.tabLockSettings.autoLockMinutes) || 5;
    range.value = mins;
    rangeVal.textContent = mins + ' min';
  }).catch(() => {});

  range.addEventListener('input', () => {
    rangeVal.textContent = range.value + ' min';
    savedMsg.textContent = '';
  });

  saveBtn.addEventListener('click', async () => {
    const mins = parseInt(range.value);
    await browser.storage.local.set({ tabLockSettings: { autoLockMinutes: mins } });
    savedMsg.textContent = 'Saved: ' + mins + ' min auto-lock';
    setTimeout(() => savedMsg.textContent = '', 2000);
  });

  backBtn.addEventListener('click', showMainView);

  // Auto-refresh when storage changes
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.tabLock_lockedTabs && content.style.display !== 'none') loadList();
  });

  async function loadList() {
    let tabs;
    try { tabs = await browser.runtime.sendMessage({ type: 'get-locked-tabs' }) || []; }
    catch { tabs = []; }

    const known = await browser.runtime.sendMessage({ type: 'get-known-sites' }).catch(() => []);
    const knownUnlocked = known.filter(h => !tabs.some(t => {
      try { return new URL(t.url).hostname === h; } catch { return false; }
    }));

    if (tabs.length === 0 && knownUnlocked.length === 0) {
      content.innerHTML = '<div class="empty-state"><p>No locked tabs</p></div>';
      return;
    }

    let html = '';

    if (tabs.length > 0) {
      html += `<div class="locked-tabs-list">${tabs.map(tab => `
      <div class="tab-item">
        <div class="tab-info">
          <span class="tab-title">${esc(tab.title || 'Locked Tab')}</span>
          <span class="tab-url">${esc(tab.url ? new URL(tab.url).hostname : '')}</span>
        </div>
        <div class="tab-actions">
          <button class="btn-remove" data-id="${tab.id}" data-tabid="${tab.tabId}" data-url="${esc(tab.url || '')}" title="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('')}</div>`;
    }

    if (knownUnlocked.length > 0) {
      html += `<div style="border-top:1px solid var(--border);padding:8px 14px 4px;font-size:10px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Saved Passkeys</div>`;
      html += `<div class="locked-tabs-list">${knownUnlocked.map(h => `
        <div class="tab-item" style="opacity:0.6">
          <div class="tab-info">
            <span class="tab-url">${esc(h)}</span>
          </div>
        </div>
      `).join('')}</div>`;
    }

    content.innerHTML = html;

    content.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lockedTabId = btn.dataset.id;
        const tabId = parseInt(btn.dataset.tabid);
        const hostname = new URL(btn.dataset.url).hostname;

        content.innerHTML = `
          <div class="empty-state" style="gap:2px">
            <p style="font-size:12px;color:var(--text-secondary);margin-bottom:2px">Remove lock for</p>
            <p style="font-weight:600;font-size:14px;margin-bottom:16px">${esc(hostname)}</p>
            <button class="btn-lock" id="confirmRemoveBtn" style="margin-bottom:6px">Remove</button>
            <button class="btn-cancel" id="cancelRemoveBtn">Cancel</button>
          </div>`;

        document.getElementById('cancelRemoveBtn').addEventListener('click', loadList);
        document.getElementById('confirmRemoveBtn').addEventListener('click', async () => {
          content.innerHTML = '<div class="empty-state"><p>Removing...</p></div>';
          await browser.runtime.sendMessage({ type: 'remove-locked-tab', lockedTabId });
          try { await browser.tabs.sendMessage(tabId, { type: 'hide-lock-screen' }); } catch {}
          loadList();
        });
      });
    });
  }

  lockBtn.addEventListener('click', async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const result = await browser.runtime.sendMessage({
      type: 'lock-tab', tabId: tab.id, url: tab.url, title: tab.title
    });
    if (result.success) {
      // Only create passkey if one doesn't already exist for this host
      const host = new URL(tab.url).hostname;
      const hasCred = await browser.runtime.sendMessage({ type: 'get-cred', hostname: host }).catch(() => null);
      if (!hasCred) {
        try {
          await browser.tabs.sendMessage(tab.id, { type: 'create-passkey', lockedTabId: result.lockedTab.id, tabId: tab.id });
        } catch {}
      }
      browser.tabs.reload(tab.id);
      window.close();
    }
  });

  settingsBtn.addEventListener('click', showSettingsView);

  loadList();
});

function esc(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}