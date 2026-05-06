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

  function emptyEl(text) {
    content.textContent = '';
    const s = document.createElement('div');
    s.className = 'empty-state';
    const p = document.createElement('p');
    p.textContent = text;
    s.appendChild(p);
    content.appendChild(s);
  }

  async function loadList() {
    let tabs;
    try { tabs = await browser.runtime.sendMessage({ type: 'get-locked-tabs' }) || []; }
    catch { tabs = []; }

    const known = await browser.runtime.sendMessage({ type: 'get-known-sites' }).catch(() => []);
    const knownUnlocked = known.filter(h => !tabs.some(t => {
      try { return new URL(t.url).hostname === h; } catch { return false; }
    }));

    content.textContent = '';

    if (tabs.length === 0 && knownUnlocked.length === 0) {
      emptyEl('No locked tabs');
      return;
    }

    if (tabs.length > 0) {
      const list = document.createElement('div');
      list.className = 'locked-tabs-list';
      tabs.forEach(tab => {
        const item = document.createElement('div');
        item.className = 'tab-item';

        const info = document.createElement('div');
        info.className = 'tab-info';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'tab-title';
        titleSpan.textContent = tab.title || 'Locked Tab';
        const urlSpan = document.createElement('span');
        urlSpan.className = 'tab-url';
        urlSpan.textContent = tab.url ? new URL(tab.url).hostname : '';
        info.appendChild(titleSpan);
        info.appendChild(urlSpan);

        const actions = document.createElement('div');
        actions.className = 'tab-actions';
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove';
        removeBtn.dataset.id = tab.id;
        removeBtn.dataset.tabid = tab.tabId;
        removeBtn.dataset.url = tab.url || '';
        removeBtn.title = 'Remove';
        removeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        removeBtn.addEventListener('click', () => showRemoveDialog(removeBtn.dataset.id, parseInt(removeBtn.dataset.tabid), removeBtn.dataset.url));
        actions.appendChild(removeBtn);

        item.appendChild(info);
        item.appendChild(actions);
        list.appendChild(item);
      });
      content.appendChild(list);
    }

    if (knownUnlocked.length > 0) {
      const header = document.createElement('div');
      header.style.cssText = 'border-top:1px solid var(--border);padding:8px 14px 4px;font-size:10px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:0.5px';
      header.textContent = 'Saved Passkeys';
      content.appendChild(header);

      const list = document.createElement('div');
      list.className = 'locked-tabs-list';
      knownUnlocked.forEach(h => {
        const item = document.createElement('div');
        item.className = 'tab-item';
        item.style.opacity = '0.6';
        const info = document.createElement('div');
        info.className = 'tab-info';
        const urlSpan = document.createElement('span');
        urlSpan.className = 'tab-url';
        urlSpan.textContent = h;
        info.appendChild(urlSpan);
        item.appendChild(info);
        list.appendChild(item);
      });
      content.appendChild(list);
    }
  }

  function showRemoveDialog(lockedTabId, tabId, url) {
    content.textContent = '';
    const s = document.createElement('div');
    s.className = 'empty-state';
    s.style.cssText = 'gap:2px';

    const label = document.createElement('p');
    label.style.cssText = 'font-size:12px;color:var(--text-secondary);margin-bottom:2px';
    label.textContent = 'Remove lock for';
    s.appendChild(label);

    const hostname = document.createElement('p');
    hostname.style.cssText = 'font-weight:600;font-size:14px;margin-bottom:16px';
    hostname.textContent = new URL(url).hostname;
    s.appendChild(hostname);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn-lock';
    confirmBtn.id = 'confirmRemoveBtn';
    confirmBtn.style.marginBottom = '6px';
    confirmBtn.textContent = 'Remove';
    s.appendChild(confirmBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-cancel';
    cancelBtn.id = 'cancelRemoveBtn';
    cancelBtn.textContent = 'Cancel';
    s.appendChild(cancelBtn);

    content.appendChild(s);

    cancelBtn.addEventListener('click', loadList);
    confirmBtn.addEventListener('click', async () => {
      content.textContent = '';
      const st = document.createElement('div');
      st.className = 'empty-state';
      const p = document.createElement('p');
      p.textContent = 'Removing...';
      st.appendChild(p);
      content.appendChild(st);
      await browser.runtime.sendMessage({ type: 'remove-locked-tab', lockedTabId });
      try { await browser.tabs.sendMessage(tabId, { type: 'hide-lock-screen' }); } catch {}
      loadList();
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