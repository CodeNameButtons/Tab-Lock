const STORAGE_KEY = 'tabLock_lockedTabs';
const CREDS_KEY = 'tabLock_creds';

async function getLockedTabs() {
  const r = await browser.storage.local.get(STORAGE_KEY);
  return r[STORAGE_KEY] || [];
}

async function setLockedTabs(tabs) {
  await browser.storage.local.set({ [STORAGE_KEY]: tabs });
}

async function removeLockedTab(lockedTabId) {
  let tabs = await getLockedTabs();
  const match = tabs.find(t => t.id === lockedTabId);
  tabs = tabs.filter(t => t.id !== lockedTabId);
  await setLockedTabs(tabs);
  // Only delete cred if no other locked tab uses same hostname
  if (match) {
    const host = new URL(match.url).hostname;
    const stillLocked = tabs.some(t => {
      try { return new URL(t.url).hostname === host; } catch { return false; }
    });
    // Keep the passkey — never delete it. Reuse on future locks.
    await checkAndSetIcon(match.tabId);
  }
}

async function setIconForTab(tabId, locked) {
  const path = locked ? 'icons/locked.svg' : 'icons/unlocked.svg';
  await browser.browserAction.setIcon({ path: { 48: path, 96: path }, tabId }).catch(() => {});
}

async function checkAndSetIcon(tabId) {
  try {
    const tabs = await getLockedTabs();
    const tab = await browser.tabs.get(tabId).catch(() => null);
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

browser.runtime.onMessage.addListener((message) => {
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
      const creds = (await browser.storage.local.get(CREDS_KEY))[CREDS_KEY] || {};
      return Object.keys(creds);
    })();

  if (message.type === 'get-cred')
    return (async () => {
      const host = message.hostname;
      const creds = (await browser.storage.local.get(CREDS_KEY))[CREDS_KEY] || {};
      return creds[host] || null;
    })();

  if (message.type === 'store-cred')
    return (async () => {
      const host = message.hostname;
      const creds = (await browser.storage.local.get(CREDS_KEY))[CREDS_KEY] || {};
      creds[host] = message.data;
      await browser.storage.local.set({ [CREDS_KEY]: creds });
      return { success: true };
    })();

  if (message.type === 'set-icon')
    return (async () => {
      const tabs = await getLockedTabs();
      const tab = tabs.find(t => t.id === message.lockedTabId);
      if (tab) await setIconForTab(tab.tabId, message.locked);
      return { success: true };
    })();
});

browser.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'lock-tab') {
    await browser.storage.local.set({ pendingLock: { tabId: tab.id, url: tab.url, title: tab.title } });
    browser.browserAction.openPopup();
  }
  if (info.menuItemId === 'unlock-tab') {
    let tabs = await getLockedTabs();
    const match = tabs.find(t => t.tabId === tab.id);
    if (match) {
      await removeLockedTab(match.id);
      await setIconForTab(tab.id, false);
    }
    try { await browser.tabs.sendMessage(tab.id, { type: 'hide-lock-screen' }); } catch {}
  }
});

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus?.removeAll();
  browser.contextMenus?.create({ id: 'lock-tab', title: 'Lock Tab', contexts: ['tab', 'page'] });
  browser.contextMenus?.create({ id: 'unlock-tab', title: 'Unlock Tab', contexts: ['tab', 'page'] });

  browser.contextMenus?.onShown.addListener(async (info, tab) => {
    const tabs = await getLockedTabs();
    const isLocked = tabs.some(t => t.tabId === tab.id);
    browser.contextMenus?.update('lock-tab', { visible: !isLocked });
    browser.contextMenus?.update('unlock-tab', { visible: isLocked });
    browser.contextMenus?.refresh();
  });
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) checkAndSetIcon(tabId);
});

browser.webNavigation?.onCompleted.addListener(async (details) => {
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
    await browser.tabs.sendMessage(details.tabId, { type: 'show-lock-screen', lockedTab: match });
  } catch {}
});