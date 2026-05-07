document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('content');
  const lockBtn = document.getElementById('lockCurrentTab');
  const settingsBtn = document.getElementById('settingsBtn');
  const backBtn = document.getElementById('backBtn');
  const headerTitle = document.getElementById('headerTitle');
  const settingsView = document.getElementById('settingsView');
  const mainFooter = document.getElementById('mainFooter');
  const passwordSetup = document.getElementById('passwordSetup');
  const pwdInput = document.getElementById('pwdInput');
  const pwdConfirm = document.getElementById('pwdConfirm');
  const pwdError = document.getElementById('pwdError');
  const pwdSaveBtn = document.getElementById('pwdSaveBtn');

  const range = document.getElementById('lockMinutes');
  const rangeVal = document.getElementById('lockValue');
  const saveBtn = document.getElementById('saveBtn');
  const savedMsg = document.getElementById('savedMsg');
  const uninstallBtn = document.getElementById('uninstallBtn');
  const resetPwdBtn = document.getElementById('resetPwdBtn');
  const mediaOverride = document.getElementById('mediaOverride');
  const notifyOnLock = document.getElementById('notifyOnLock');

  const pending = await chrome.storage.local.get('pendingLock');
  if (pending.pendingLock) {
    await chrome.storage.local.remove('pendingLock');
    const { tabId, url, title } = pending.pendingLock;
    const locked = await chrome.runtime.sendMessage({ type: 'get-locked-tabs' });
    const already = locked.some(t => t.tabId === tabId);
    if (already) {
      chrome.tabs.reload(tabId);
    } else {
      const result = await chrome.runtime.sendMessage({ type: 'lock-tab', tabId, url, title });
      if (result.success) chrome.tabs.reload(tabId);
    }
    window.close();
    return;
  }

  const hasPwd = await chrome.runtime.sendMessage({ type: 'has-password' });

  function showSetupView() {
    content.style.display = 'none';
    settingsView.style.display = 'none';
    mainFooter.style.display = 'none';
    backBtn.style.display = 'none';
    passwordSetup.style.display = 'block';
    headerTitle.textContent = 'Set Master Password';
  }

  function showMainView() {
    passwordSetup.style.display = 'none';
    content.style.display = '';
    settingsView.style.display = 'none';
    mainFooter.style.display = '';
    backBtn.style.display = 'none';
    headerTitle.textContent = 'Tab Lock';
    loadList();
  }

  function showSettingsView() {
    passwordSetup.style.display = 'none';
    content.style.display = 'none';
    settingsView.style.display = 'block';
    mainFooter.style.display = 'none';
    backBtn.style.display = '';
    headerTitle.textContent = 'Settings';
    checkPolicyStatus();
  }

  async function checkPolicyStatus() {
    const el = document.getElementById('policyStatus');
    if (!el) return;
    try {
      const r = await chrome.runtime.sendMessage({ type: 'check-policy' });
      el.textContent = r.locked ? 'Locked by admin policy' : '';
      el.style.color = 'var(--text-secondary)';
    } catch {
      el.textContent = '';
    }
  }

  if (!hasPwd) {
    showSetupView();

    pwdSaveBtn.addEventListener('click', async () => {
      const pwd = pwdInput.value;
      const confirm = pwdConfirm.value;
      pwdError.textContent = '';
      if (!pwd || pwd.length < 4) { pwdError.textContent = 'Password must be at least 4 characters'; return; }
      if (pwd !== confirm) { pwdError.textContent = 'Passwords do not match'; return; }
      await chrome.runtime.sendMessage({ type: 'set-password', password: pwd });
      pwdInput.value = '';
      pwdConfirm.value = '';
      showMainView();
    });

    pwdInput.addEventListener('keydown', e => { if (e.key === 'Enter') pwdSaveBtn.click(); });
    pwdConfirm.addEventListener('keydown', e => { if (e.key === 'Enter') pwdSaveBtn.click(); });

    return;
  }

  chrome.storage.local.get('tabLockSettings').then(s => {
    const set = s.tabLockSettings || {};
    const mins = set.autoLockMinutes || 5;
    range.value = mins;
    rangeVal.textContent = mins + ' min';
    mediaOverride.checked = set.mediaOverride !== false;
    notifyOnLock.checked = set.notifyOnLock !== false;
  }).catch(() => {});

  range.addEventListener('input', () => {
    rangeVal.textContent = range.value + ' min';
    savedMsg.textContent = '';
  });

  saveBtn.addEventListener('click', async () => {
    const mins = parseInt(range.value);
    await chrome.storage.local.set({
      tabLockSettings: {
        autoLockMinutes: mins,
        mediaOverride: mediaOverride.checked,
        notifyOnLock: notifyOnLock.checked
      }
    });
    savedMsg.textContent = 'Saved';
    setTimeout(() => savedMsg.textContent = '', 2000);
  });

  backBtn.addEventListener('click', showMainView);

  chrome.storage.onChanged.addListener((changes, area) => {
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
    try { tabs = await chrome.runtime.sendMessage({ type: 'get-locked-tabs' }) || []; }
    catch { tabs = []; }

    const known = await chrome.runtime.sendMessage({ type: 'get-known-sites' }).catch(() => []);
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
    s.className = 'remove-dialog';

    const icon = document.createElement('div');
    icon.className = 'remove-dialog-icon';
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
    s.appendChild(icon);

    const label = document.createElement('div');
    label.className = 'remove-dialog-label';
    label.textContent = 'Remove lock for';
    s.appendChild(label);

    const hostname = document.createElement('div');
    hostname.className = 'remove-dialog-host';
    hostname.textContent = new URL(url).hostname;
    s.appendChild(hostname);

    const pwdField = document.createElement('input');
    pwdField.type = 'password';
    pwdField.className = 'pwd-input';
    pwdField.placeholder = 'Enter master password';
    pwdField.autocomplete = 'off';
    pwdField.style.marginBottom = '12px';
    s.appendChild(pwdField);

    const errMsg = document.createElement('div');
    errMsg.className = 'pwd-error';
    errMsg.style.marginBottom = '8px';
    s.appendChild(errMsg);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'remove-dialog-btn';
    confirmBtn.id = 'confirmRemoveBtn';
    confirmBtn.textContent = 'Remove';
    s.appendChild(confirmBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'remove-dialog-cancel';
    cancelBtn.id = 'cancelRemoveBtn';
    cancelBtn.textContent = 'Cancel';
    s.appendChild(cancelBtn);

    content.appendChild(s);

    pwdField.focus();

    cancelBtn.addEventListener('click', loadList);

    async function doRemove() {
      const pwd = pwdField.value;
      if (!pwd) { errMsg.textContent = 'Enter your master password'; pwdField.focus(); return; }
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Verifying...';
      const ok = await chrome.runtime.sendMessage({ type: 'verify-password', password: pwd });
      if (!ok) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Remove';
        errMsg.textContent = 'Incorrect password';
        pwdField.value = '';
        pwdField.focus();
        return;
      }
      confirmBtn.textContent = 'Removing...';
      await chrome.runtime.sendMessage({ type: 'remove-locked-tab', lockedTabId });
      try { await chrome.tabs.sendMessage(tabId, { type: 'hide-lock-screen' }); } catch {}
      content.textContent = '';
      const st = document.createElement('div');
      st.className = 'remove-dialog';
      const si = document.createElement('div');
      si.className = 'remove-status-icon success';
      si.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      st.appendChild(si);
      const t = document.createElement('div');
      t.className = 'remove-status-text';
      t.textContent = 'Removed';
      st.appendChild(t);
      content.appendChild(st);
      setTimeout(loadList, 1200);
    }

    confirmBtn.addEventListener('click', doRemove);
    pwdField.addEventListener('keydown', e => { if (e.key === 'Enter') doRemove(); });
  }

  lockBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await chrome.runtime.sendMessage({
      type: 'lock-tab', tabId: tab.id, url: tab.url, title: tab.title
    });
    if (result.success) {
      const host = new URL(tab.url).hostname;
      const hasCred = await chrome.runtime.sendMessage({ type: 'get-cred', hostname: host }).catch(() => null);
      if (!hasCred) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'create-passkey', lockedTabId: result.lockedTab.id, tabId: tab.id });
        } catch {}
      }
      chrome.tabs.reload(tab.id);
      window.close();
    }
  });

  settingsBtn.addEventListener('click', showSettingsView);

  resetPwdBtn.addEventListener('click', async () => {
    content.textContent = '';
    settingsView.style.display = 'none';
    content.style.display = '';
    mainFooter.style.display = 'none';
    backBtn.style.display = 'none';
    headerTitle.textContent = 'Reset Password';
    const s = document.createElement('div');
    s.className = 'remove-dialog';
    const icon = document.createElement('div');
    icon.className = 'remove-dialog-icon';
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
    s.appendChild(icon);
    const label = document.createElement('div');
    label.className = 'remove-dialog-label';
    label.textContent = 'Reset master password';
    s.appendChild(label);
    const pwdField = document.createElement('input');
    pwdField.type = 'password';
    pwdField.className = 'pwd-input';
    pwdField.placeholder = 'Current password';
    pwdField.autocomplete = 'off';
    pwdField.style.marginBottom = '8px';
    s.appendChild(pwdField);
    const errMsg = document.createElement('div');
    errMsg.className = 'pwd-error';
    errMsg.style.marginBottom = '4px';
    s.appendChild(errMsg);
    const continueBtn = document.createElement('button');
    continueBtn.className = 'remove-dialog-btn';
    continueBtn.textContent = 'Continue';
    continueBtn.style.marginBottom = '12px';
    s.appendChild(continueBtn);
    const orDiv = document.createElement('div');
    orDiv.style.cssText = 'font-size:10px;color:var(--text-secondary);margin-bottom:8px;text-transform:uppercase';
    orDiv.textContent = 'or';
    s.appendChild(orDiv);

    // Check for stored passkeys for forgot password backup
    const knownSites = await chrome.runtime.sendMessage({ type: 'get-known-sites' }).catch(() => []);
    if (knownSites.length > 0) {
      const helloBtn = document.createElement('button');
      helloBtn.className = 'save-btn';
      helloBtn.textContent = 'Forgot password';
      helloBtn.style.marginBottom = '8px';
      s.appendChild(helloBtn);
      helloBtn.addEventListener('click', async () => {
        helloBtn.disabled = true;
        helloBtn.textContent = 'Opening...';
        const host = knownSites[0];
        await chrome.storage.local.set({ pendingVerifyIdentity: { hostname: host } });
        const tabs = await chrome.tabs.query({ url: '*://' + host + '/*' }).catch(() => []);
        if (tabs.length > 0) {
          await chrome.tabs.update(tabs[0].id, { active: true });
          const win = await chrome.windows.getCurrent();
          await chrome.windows.update(win.id, { focused: true });
        } else {
          await chrome.tabs.create({ url: 'https://' + host, active: true });
        }
        window.close();
      });
    } else {
      const noKey = document.createElement('div');
      noKey.style.cssText = 'font-size:10px;color:var(--text-secondary);margin-bottom:8px;text-align:center';
      noKey.textContent = 'No passkeys saved — lock a tab first to use this option';
      s.appendChild(noKey);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'remove-dialog-cancel';
    cancelBtn.textContent = 'Cancel';
    s.appendChild(cancelBtn);
    content.appendChild(s);
    pwdField.focus();

    cancelBtn.addEventListener('click', showSettingsView);

    async function handleContinue() {
      const pwd = pwdField.value;
      if (!pwd) { errMsg.textContent = 'Enter your current password'; pwdField.focus(); return; }
      continueBtn.disabled = true;
      continueBtn.textContent = 'Verifying...';
      const ok = await chrome.runtime.sendMessage({ type: 'verify-password', password: pwd });
      if (!ok) {
        continueBtn.disabled = false;
        continueBtn.textContent = 'Continue';
        errMsg.textContent = 'Incorrect password';
        pwdField.value = '';
        pwdField.focus();
        return;
      }
      showNewPwdView();
    }
    continueBtn.addEventListener('click', handleContinue);
    pwdField.addEventListener('keydown', e => { if (e.key === 'Enter') handleContinue(); });
  });

  uninstallBtn.addEventListener('click', async () => {
    settingsView.style.display = 'none';
    content.style.display = '';
    backBtn.style.display = 'none';
    mainFooter.style.display = 'none';
    headerTitle.textContent = 'Uninstall Extension';
    content.textContent = '';
    const s = document.createElement('div');
    s.className = 'remove-dialog';
    const icon = document.createElement('div');
    icon.className = 'remove-dialog-icon';
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
    s.appendChild(icon);
    const label = document.createElement('div');
    label.className = 'remove-dialog-label';
    label.textContent = 'Enter master password to uninstall';
    s.appendChild(label);
    const pwdField = document.createElement('input');
    pwdField.type = 'password';
    pwdField.className = 'pwd-input';
    pwdField.placeholder = 'Master password';
    pwdField.autocomplete = 'off';
    pwdField.style.marginBottom = '8px';
    s.appendChild(pwdField);
    const errMsg = document.createElement('div');
    errMsg.className = 'pwd-error';
    errMsg.style.marginBottom = '8px';
    s.appendChild(errMsg);
    const uninstallConfirmBtn = document.createElement('button');
    uninstallConfirmBtn.className = 'remove-dialog-btn';
    uninstallConfirmBtn.textContent = 'Uninstall';
    s.appendChild(uninstallConfirmBtn);
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'remove-dialog-cancel';
    cancelBtn.textContent = 'Cancel';
    s.appendChild(cancelBtn);
    content.appendChild(s);
    pwdField.focus();
    cancelBtn.addEventListener('click', showSettingsView);
    uninstallConfirmBtn.addEventListener('click', async () => {
      const pwd = pwdField.value;
      if (!pwd) { errMsg.textContent = 'Enter your master password'; pwdField.focus(); return; }
      uninstallConfirmBtn.disabled = true;
      uninstallConfirmBtn.textContent = 'Verifying...';
      const ok = await chrome.runtime.sendMessage({ type: 'verify-password', password: pwd });
      if (!ok) {
        uninstallConfirmBtn.disabled = false;
        uninstallConfirmBtn.textContent = 'Uninstall';
        errMsg.textContent = 'Incorrect password';
        pwdField.value = '';
        pwdField.focus();
        return;
      }
      uninstallConfirmBtn.textContent = 'Uninstalling...';
      await chrome.management.uninstallSelf();
    });
    pwdField.addEventListener('keydown', e => { if (e.key === 'Enter') uninstallConfirmBtn.click(); });
  });

  loadList();
});

function esc(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}