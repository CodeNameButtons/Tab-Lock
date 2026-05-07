const STORAGE_KEY = 'tabLock_lockedTabs';
const CREDS_KEY = 'tabLock_creds';
const PWD_KEY = 'masterPasswordHash';

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hasPassword() {
  const r = await chrome.storage.local.get(PWD_KEY);
  return !!r[PWD_KEY];
}

async function setPassword(password) {
  await chrome.storage.local.set({ [PWD_KEY]: await hashPassword(password) });
}

async function verifyPassword(password) {
  const r = await chrome.storage.local.get(PWD_KEY);
  if (!r[PWD_KEY]) return true;
  return (await hashPassword(password)) === r[PWD_KEY];
}

async function getLockedTabs() {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  return r[STORAGE_KEY] || [];
}

async function setLockedTabs(tabs) {
  await chrome.storage.local.set({ [STORAGE_KEY]: tabs });
}

async function removeLockedTab(lockedTabId) {
  let tabs = await getLockedTabs();
  const match = tabs.find(t => t.id === lockedTabId);
  tabs = tabs.filter(t => t.id !== lockedTabId);
  await setLockedTabs(tabs);
  if (match) {
    const host = new URL(match.url).hostname;
    const stillLocked = tabs.some(t => {
      try { return new URL(t.url).hostname === host; } catch { return false; }
    });
    // Keep the passkey — reuse on future locks.
    await checkAndSetIcon(match.tabId);
  }
}

async function setIconForTab(tabId, locked) {
  const path = locked ? 'icons/locked.svg' : 'icons/unlocked.svg';
  await chrome.action.setIcon({ path: { 48: path, 96: path }, tabId }).catch(() => {});
}

async function checkAndSetIcon(tabId) {
  try {
    const tabs = await getLockedTabs();
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || !tab.url) return;
    const host = new URL(tab.url).hostname;
    const locked = tabs.some(t => {
      try { return new URL(t.url).hostname === host; } catch { return false; }
    });
    await setIconForTab(tabId, locked);
  } catch {}
}

async function lockTab(tabId, url, title) {
  const tabs = await getLockedTabs();
  if (tabs.find(t => t.tabId === tabId))
    return { success: false, error: 'Already locked' };
  const entry = {
    id: Date.now().toString(),
    tabId, url,
    title: title || 'Locked Tab',
    lockedAt: Date.now()
  };
  tabs.push(entry);
  await setLockedTabs(tabs);
  await setIconForTab(tabId, true);
  return { success: true, lockedTab: entry };
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'get-locked-tabs')
    return getLockedTabs();

  if (message.type === 'lock-tab')
    return lockTab(message.tabId, message.url, message.title);

  if (message.type === 'remove-locked-tab')
    return (async () => {
      const tabs = await getLockedTabs();
      const match = tabs.find(t => t.id === message.lockedTabId);
      await removeLockedTab(message.lockedTabId);
      return { success: true };
    })();

  if (message.type === 'get-known-sites')
    return (async () => {
      const creds = (await chrome.storage.local.get(CREDS_KEY))[CREDS_KEY] || {};
      return Object.keys(creds);
    })();

  if (message.type === 'get-cred')
    return (async () => {
      const host = message.hostname;
      const creds = (await chrome.storage.local.get(CREDS_KEY))[CREDS_KEY] || {};
      return creds[host] || null;
    })();

  if (message.type === 'store-cred')
    return (async () => {
      const host = message.hostname;
      const creds = (await chrome.storage.local.get(CREDS_KEY))[CREDS_KEY] || {};
      creds[host] = message.data;
      await chrome.storage.local.set({ [CREDS_KEY]: creds });
      return { success: true };
    })();

  if (message.type === 'set-icon')
    return (async () => {
      const tabs = await getLockedTabs();
      const tab = tabs.find(t => t.id === message.lockedTabId);
      if (tab) await setIconForTab(tab.tabId, message.locked);
      return { success: true };
    })();

  if (message.type === 'has-password') return hasPassword();
  if (message.type === 'set-password') return (async () => { await setPassword(message.password); return { success: true }; })();
  if (message.type === 'verify-password') return verifyPassword(message.password);
  if (message.type === 'change-password') return (async () => {
    const ok = await verifyPassword(message.oldPassword);
    if (!ok) return { success: false, error: 'Incorrect password' };
    await setPassword(message.newPassword);
    return { success: true };
  })();
  if (message.type === 'notify-locked') return (async () => {
    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/locked.svg',
        title: 'Tab Locked',
        message: message.title + ' — locked due to inactivity'
      });
    } catch {}
    return { success: true };
  })();
  if (message.type === 'check-policy') return (async () => {
    try {
      const self = await chrome.management.get(chrome.runtime.id);
      return { locked: self.mayDisable === false };
    } catch { return { locked: false, error: 'management API unavailable' }; }
  })();
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus?.removeAll();
  setupContextMenus();
  try { chrome.runtime.setUninstallURL('https://github.com/CodeNameButtons/Tab-Lock'); } catch {}
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus?.removeAll();
  setupContextMenus();
  try { chrome.runtime.setUninstallURL('https://github.com/CodeNameButtons/Tab-Lock'); } catch {}
  setTimeout(startHelper, 3000);
});

function setupContextMenus() {
  chrome.contextMenus?.removeAll();
  chrome.contextMenus.create({ id: 'lock-tab', title: 'Lock Tab', contexts: ['page'] });
}

chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'lock-tab') {
    await chrome.storage.local.set({ pendingLock: { tabId: tab.id, url: tab.url, title: tab.title } });
    chrome.action.openPopup();
  }
});

setupContextMenus();

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) checkAndSetIcon(tabId);
});

chrome.webNavigation?.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  try {
    await checkAndSetIcon(details.tabId);
    const tabs = await getLockedTabs();
    const urlObj = new URL(details.url);
    const match = tabs.find(t => {
      try { return new URL(t.url).hostname === urlObj.hostname; }
      catch { return false; }
    });
    if (!match) return;
    match.tabId = details.tabId;
    let all = await getLockedTabs();
    all = all.map(t => t.id === match.id ? { ...t, tabId: details.tabId } : t);
    await setLockedTabs(all);
    await chrome.tabs.sendMessage(details.tabId, { type: 'show-lock-screen', lockedTab: match });
  } catch {}
});