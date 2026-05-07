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
    await checkAndSetIcon(match.tabId);
  }
}

async function setIconForTab(tabId, locked) {
  const path = locked ? 'icons/locked.svg' : 'icons/unlocked.svg';
  try { await chrome.action.setIcon({ path: { 48: path }, tabId }); } catch {}
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'get-locked-tabs') { getLockedTabs().then(sendResponse); return true; }
  if (message.type === 'lock-tab') { lockTab(message.tabId, message.url, message.title).then(sendResponse); return true; }
  if (message.type === 'remove-locked-tab') {
    removeLockedTab(message.lockedTabId).then(() => sendResponse({ success: true }));
    return true;
  }
  if (message.type === 'get-known-sites') {
    chrome.storage.local.get(CREDS_KEY).then(r => sendResponse(Object.keys(r[CREDS_KEY] || {})));
    return true;
  }
  if (message.type === 'get-cred') {
    chrome.storage.local.get(CREDS_KEY).then(r => sendResponse((r[CREDS_KEY] || {})[message.hostname] || null));
    return true;
  }
  if (message.type === 'store-cred') {
    chrome.storage.local.get(CREDS_KEY).then(r => {
      const creds = r[CREDS_KEY] || {};
      creds[message.hostname] = message.data;
      chrome.storage.local.set({ [CREDS_KEY]: creds }).then(() => sendResponse({ success: true }));
    });
    return true;
  }
  if (message.type === 'set-icon') {
    getLockedTabs().then(tabs => {
      const tab = tabs.find(t => t.id === message.lockedTabId);
      if (tab) setIconForTab(tab.tabId, message.locked);
      sendResponse({ success: true });
    });
    return true;
  }
  if (message.type === 'has-password') { hasPassword().then(sendResponse); return true; }
  if (message.type === 'set-password') { setPassword(message.password).then(() => sendResponse({ success: true })); return true; }
  if (message.type === 'verify-password') { verifyPassword(message.password).then(sendResponse); return true; }
  if (message.type === 'change-password') {
    verifyPassword(message.oldPassword).then(ok => {
      if (!ok) return sendResponse({ success: false, error: 'Incorrect password' });
      setPassword(message.newPassword).then(() => sendResponse({ success: true }));
    });
    return true;
  }
  if (message.type === 'notify-locked') {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/locked.svg',
        title: 'Tab Locked',
        message: message.title + ' — locked due to inactivity'
      });
    } catch {}
    sendResponse({ success: true });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: 'lock-tab', title: 'Lock Tab', contexts: ['page'] });
  try { chrome.runtime.setUninstallURL('https://github.com/CodeNameButtons/Tab-Lock'); } catch {}
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'lock-tab') {
    chrome.storage.local.set({ pendingLock: { tabId: tab.id, url: tab.url, title: tab.title } });
    chrome.action.openPopup();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) checkAndSetIcon(tabId);
});

chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  try {
    await checkAndSetIcon(details.tabId);
    const tabs = await getLockedTabs();
    const urlObj = new URL(details.url);
    const match = tabs.find(t => {
      try { return new URL(t.url).hostname === urlObj.hostname; } catch { return false; }
    });
    if (!match) return;
    match.tabId = details.tabId;
    let all = await getLockedTabs();
    all = all.map(t => t.id === match.id ? { ...t, tabId: details.tabId } : t);
    await setLockedTabs(all);
    try { chrome.tabs.sendMessage(details.tabId, { type: 'show-lock-screen', lockedTab: match }); } catch {}
  } catch {}
});
