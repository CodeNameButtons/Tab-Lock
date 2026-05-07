(function() {
  function callWebAuthn(type, args) {
    return new Promise(function(resolve, reject) {
      var id = Math.random().toString(36).substr(2, 10);
      var timeout = setTimeout(function() {
        window.removeEventListener("__tlock_auth_res", handler);
        reject({name: "TimeoutError"});
      }, 35000);
      function handler(e) {
        if (e.detail.id === id) {
          clearTimeout(timeout);
          window.removeEventListener("__tlock_auth_res", handler);
          if (e.detail.success) resolve(e.detail.cred);
          else reject({name: e.detail.error});
        }
      }
      window.addEventListener("__tlock_auth_res", handler);
      window.dispatchEvent(new CustomEvent("__tlock_auth", {detail: {id: id, type: type, args: args}}));
    });
  }

  let overlay = null;
  let currentTab = null;
  let autoLockTimer = null;
  let isUnlocked = false;
  let storedCred = null;

  let AUTO_LOCK_MS = 5 * 60 * 1000;
  let MEDIA_OVERRIDE = true;
  let NOTIFY_ON_LOCK = true;

  chrome.storage.local.get('tabLockSettings').then(s => {
    const set = s.tabLockSettings || {};
    if (set.autoLockMinutes) AUTO_LOCK_MS = set.autoLockMinutes * 60 * 1000;
    if (set.mediaOverride !== undefined) MEDIA_OVERRIDE = set.mediaOverride;
    if (set.notifyOnLock !== undefined) NOTIFY_ON_LOCK = set.notifyOnLock;
  }).catch(() => {});

  function isMediaPlaying() {
    const els = document.querySelectorAll('audio, video');
    for (const el of els) {
      if (!el.paused) return true;
    }
    return false;
  }

  function resetAutoLock() {
    stopAutoLock();
    if (!isUnlocked || !currentTab) return;
    autoLockTimer = setTimeout(() => {
      if (MEDIA_OVERRIDE && isMediaPlaying()) {
        resetAutoLock();
        return;
      }
      isUnlocked = false;
      if (!overlay && currentTab) {
        createUI(currentTab, true);
        if (NOTIFY_ON_LOCK) {
          chrome.runtime.sendMessage({
            type: 'notify-locked',
            title: currentTab.title || document.title || 'Locked Tab',
            hostname: window.location.hostname
          }).catch(() => {});
        }
      }
    }, AUTO_LOCK_MS);
  }

  function setupActivityListeners() {
    const handler = () => { resetAutoLock(); };
    document.addEventListener('click', handler, true);
    document.addEventListener('keydown', handler, true);
    document.addEventListener('mousemove', handler, true);
    document.addEventListener('scroll', handler, true);
    document.addEventListener('touchstart', handler, true);
  }

  function iconHTML(state) {
    return `<div class="tab-lock-icon ${state}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      ${state === 'unlocked'
        ? '<path d="M7 11V7a5 5 0 0 1 9.9-1"/>'
        : '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
      }
    </svg></div>`;
  }

  function createUI(tab, fromAutoLock) {
    if (overlay) return;
    currentTab = tab;
    stopAutoLock();

    overlay = document.createElement('div');
    overlay.id = 'tab-lock-overlay';

    const card = document.createElement('div');
    card.className = 'tab-lock-card';

    const iconContainer = document.createElement('div');
    iconContainer.className = 'tab-lock-icon locked';
    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('fill', 'none');
    iconSvg.setAttribute('stroke', 'currentColor');
    iconSvg.setAttribute('stroke-width', '1.5');
    iconSvg.setAttribute('stroke-linecap', 'round');
    iconSvg.setAttribute('stroke-linejoin', 'round');
    const iconRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    iconRect.setAttribute('x', '3'); iconRect.setAttribute('y', '11');
    iconRect.setAttribute('width', '18'); iconRect.setAttribute('height', '11');
    iconRect.setAttribute('rx', '2'); iconRect.setAttribute('ry', '2');
    const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iconPath.setAttribute('d', 'M7 11V7a5 5 0 0 1 10 0v4');
    iconSvg.appendChild(iconRect);
    iconSvg.appendChild(iconPath);
    iconContainer.appendChild(iconSvg);

    const title = document.createElement('div');
    title.className = 'tab-lock-title';
    title.textContent = 'Tab Locked';

    const siteEl = document.createElement('div');
    siteEl.className = 'tab-lock-site';
    siteEl.textContent = tab.title || 'Locked Tab';

    const body = document.createElement('div');
    body.className = 'tab-lock-body';

    const btn = document.createElement('button');
    btn.className = 'tab-lock-btn';
    btn.id = 'tlock-btn';
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/></svg> Unlock';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'tab-lock-remove';
    removeBtn.id = 'tlock-remove';
    removeBtn.textContent = 'Remove lock';

    const err = document.createElement('div');
    err.className = 'tab-lock-error';
    err.id = 'tlock-err';

    body.appendChild(btn);
    body.appendChild(removeBtn);
    body.appendChild(err);

    if (fromAutoLock) {
      const status = document.createElement('div');
      status.className = 'tab-lock-status';
      status.textContent = 'Auto-locked due to inactivity';
      body.appendChild(status);
    }

    card.appendChild(iconContainer);
    card.appendChild(title);
    card.appendChild(siteEl);
    card.appendChild(body);
    overlay.appendChild(card);

    document.documentElement.appendChild(overlay);

    let statusEl = null;
    let autoCreating = false;

    function setStatus(text) {
      if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.className = 'tab-lock-status';
        btn.parentNode.insertBefore(statusEl, err);
      }
      statusEl.textContent = text;
    }

    function clearStatus() {
      if (statusEl) { statusEl.remove(); statusEl = null; }
    }

    function setIcon(state) {
      const container = overlay.querySelector('.tab-lock-icon');
      if (container) container.className = 'tab-lock-icon ' + state;
    }

    function setRemoveMode(mode) {
      if (mode === 'icon') {
        removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px;display:block;margin:0 auto"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
        removeBtn.style.width = '36px';
        removeBtn.style.height = '36px';
        removeBtn.style.borderRadius = '50%';
        removeBtn.style.border = '1px solid var(--ls-border)';
        removeBtn.style.padding = '0';
        removeBtn.style.fontSize = '0';
        removeBtn.style.opacity = '0.6';
      } else {
        removeBtn.textContent = 'Remove lock';
        removeBtn.style.width = '';
        removeBtn.style.height = '';
        removeBtn.style.borderRadius = '';
        removeBtn.style.border = 'none';
        removeBtn.style.padding = '0';
        removeBtn.style.fontSize = '11px';
        removeBtn.style.opacity = '0.6';
      }
    }

    async function createPasskey() {
      if (autoCreating) return;
      autoCreating = true;
      const exist = await chrome.runtime.sendMessage({ type: 'get-cred', hostname: window.location.hostname }).catch(() => null);
      if (exist) { storedCred = exist; clearStatus(); setIcon('locked'); btn.style.display = ''; autoCreating = false; return; }
      btn.style.display = 'none';
      setStatus('Creating passkey...');
      setIcon('authenticating');
      try {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const cred = await callWebAuthn('create', {
          
            challenge,
            rp: { id: window.location.hostname, name: 'Tab Lock' },
            user: {
              id: new TextEncoder().encode(tab.id),
              name: 'Tab Lock User',
              displayName: 'Tab Lock User'
            },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
            authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
            timeout: 30000
        });
        storedCred = { id: Array.from(new Uint8Array(cred.rawId)), rpId: window.location.hostname };
        await chrome.runtime.sendMessage({ type: 'store-cred', hostname: window.location.hostname, data: storedCred });
        clearStatus();
        setIcon('locked');
        btn.style.display = '';
      } catch (e) {
        autoCreating = false;
        clearStatus();
        setIcon('locked');
        btn.style.display = '';
        if (e.name === 'NotAllowedError') err.textContent = 'Passkey creation cancelled';
        else err.textContent = 'Passkey creation failed';
      }
    }

    chrome.runtime.sendMessage({ type: 'get-cred', hostname: window.location.hostname }).then(cred => {
      storedCred = cred;
      if (!cred && !fromAutoLock && !window.__tablockPasskeyCreated) {
        window.__tablockPasskeyCreated = true;
        createPasskey();
      }
    }).catch(() => {});

    removeBtn.addEventListener('click', async () => {
      if (!storedCred) return;
      await doRemoveAuth(removeBtn, err, tab);
    });

    async function doRemoveAuth(btnEl, errEl, tabData) {
      const hasPwd = await chrome.runtime.sendMessage({ type: 'has-password' });
      if (hasPwd) {
        showPasswordRemoveUI(btnEl, tabData);
        return;
      }
      btnEl.disabled = true;
      btnEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px;display:block;margin:0 auto"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
      setStatus('Authenticating for removal...');
      try {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        await callWebAuthn('get', { challenge, allowCredentials: [{ id: new Uint8Array(storedCred.id), type: 'public-key' }], userVerification: 'required', timeout: 30000 });
        await chrome.runtime.sendMessage({ type: 'remove-locked-tab', lockedTabId: tabData.id });
        setStatus('Lock removed');
        await new Promise(r => setTimeout(r, 1200));
        removeOverlay();
      } catch {
        btnEl.disabled = false;
        btnEl.textContent = 'Remove lock';
        clearStatus();
        errEl.textContent = 'Authentication failed';
      }
    }

    function showPasswordRemoveUI(btnEl, tabData) {
      btnEl.style.display = 'none';
      clearStatus();
      const wrapper = document.createElement('div');
      wrapper.className = 'tlock-pwd-remove';
      wrapper.innerHTML = '<div class="tlock-remove-confirm-text">Enter master password to remove</div><input type="password" class="tlock-pwd-input" placeholder="Password" autocomplete="off"><div class="tlock-pwd-err"></div><button class="tlock-remove-confirm-btn">Remove</button><button class="tlock-remove-cancel-btn">Cancel</button>';
      const card = overlay.querySelector('.tab-lock-card');
      card.appendChild(wrapper);
      const input = wrapper.querySelector('input');
      const errEl2 = wrapper.querySelector('.tlock-pwd-err');
      const confirmBtn2 = wrapper.querySelector('.tlock-remove-confirm-btn');
      const cancelBtn2 = wrapper.querySelector('.tlock-remove-cancel-btn');
      const origRemove = overlay.querySelector('#tlock-remove');
      if (origRemove) origRemove.style.display = 'none';
      input.focus();
      async function submitPwd() {
        const pwd = input.value;
        if (!pwd) { errEl2.textContent = 'Enter your master password'; return; }
        confirmBtn2.disabled = true;
        confirmBtn2.textContent = 'Verifying...';
        const ok = await chrome.runtime.sendMessage({ type: 'verify-password', password: pwd });
        if (!ok) {
          confirmBtn2.disabled = false;
          confirmBtn2.textContent = 'Remove';
          errEl2.textContent = 'Incorrect password';
          input.value = '';
          input.focus();
          return;
        }
        confirmBtn2.textContent = 'Removing...';
        await chrome.runtime.sendMessage({ type: 'remove-locked-tab', lockedTabId: tabData.id });
        wrapper.remove();
        removeOverlay();
      }
      confirmBtn2.addEventListener('click', submitPwd);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submitPwd(); });
      cancelBtn2.addEventListener('click', () => {
        wrapper.remove();
        btnEl.style.display = '';
        if (origRemove) origRemove.style.display = '';
      });
    }

    btn.addEventListener('click', async () => {
      btn.style.display = 'none';
      setRemoveMode('icon');
      setStatus('Authenticating...');
      setIcon('authenticating');

      try {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        await callWebAuthn('get', {
          
            challenge,
            allowCredentials: [{ id: new Uint8Array(storedCred.id), type: 'public-key' }],
            userVerification: 'required',
            timeout: 30000
        });
        setRemoveMode('text');
        setIcon('unlocked');
        setStatus('Unlocked');
        chrome.runtime.sendMessage({ type: 'set-icon', lockedTabId: tab.id, locked: false }).catch(() => {});
        await new Promise(r => setTimeout(r, 400));
        isUnlocked = true;
        removeOverlay();
        resetAutoLock();
      } catch (e) {
        setIcon('locked');
        clearStatus();
        btn.style.display = '';
        if (e.name === 'NotAllowedError') err.textContent = 'Cancelled';
        else err.textContent = 'Authentication failed';
      }
    });
  }

  function stopAutoLock() {
    if (autoLockTimer) { clearTimeout(autoLockTimer); autoLockTimer = null; }
  }

  function removeOverlay() {
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.15s';
      setTimeout(() => { overlay?.remove(); overlay = null; }, 150);
    }
  }

  function esc(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }

  setupActivityListeners();

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => { checkLocked(); checkPendingIdentity(); });
  else { checkLocked(); checkPendingIdentity(); }

  function hostnameMatch(a, b) {
    return a.replace(/^www\./, '') === b.replace(/^www\./, '');
  }

  async function checkPendingIdentity() {
    const p = await chrome.storage.local.get('pendingVerifyIdentity').catch(() => ({}));
    if (p.pendingVerifyIdentity && hostnameMatch(p.pendingVerifyIdentity.hostname, window.location.hostname)) {
      chrome.storage.local.remove('pendingVerifyIdentity');
      setTimeout(() => verifyIdentity(), 500);
    }
  }

  async function checkLocked() {
    try {
      const host = location.hostname;
      const tabs = await chrome.runtime.sendMessage({ type: 'get-locked-tabs' });
      const match = tabs.find(t => { try { return new URL(t.url).hostname === host; } catch { return false; } });
      if (match) {
        createUI(match, false);
        const p = await chrome.storage.local.get('pendingRemove').catch(() => ({}));
        if (p.pendingRemove && p.pendingRemove.lockedTabId === match.id) {
          chrome.storage.local.remove('pendingRemove');
          showRemoveConfirmUI(match.id);
        }
      }
    } catch {}
  }

  chrome.runtime.onMessage.addListener(msg => {
    if (msg.type === 'show-lock-screen') {
      if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', () => createUI(msg.lockedTab, false));
      else createUI(msg.lockedTab, false);
    }
    if (msg.type === 'hide-lock-screen') removeOverlay();
    if (msg.type === 'create-passkey') return createPasskeyForTab(msg.lockedTabId, msg.tabId);
    if (msg.type === 'verify-identity') return verifyIdentity();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.tabLockSettings) {
      const set = (changes.tabLockSettings.newValue || {});
      if (set.autoLockMinutes) AUTO_LOCK_MS = set.autoLockMinutes * 60 * 1000;
      if (set.mediaOverride !== undefined) MEDIA_OVERRIDE = set.mediaOverride;
      if (set.notifyOnLock !== undefined) NOTIFY_ON_LOCK = set.notifyOnLock;
    }
    if (changes.pendingRemove) {
      const pending = changes.pendingRemove.newValue;
      if (!pending) return;
      chrome.storage.local.remove('pendingRemove');
      if (!overlay || !currentTab || currentTab.id !== pending.lockedTabId) return;
      showRemoveConfirmUI(pending.lockedTabId);
    }
    if (changes.pendingVerifyIdentity) {
      const v = changes.pendingVerifyIdentity.newValue;
      if (!v || !hostnameMatch(v.hostname, window.location.hostname)) return;
      chrome.storage.local.remove('pendingVerifyIdentity');
      setTimeout(() => verifyIdentity(), 500);
    }
  });

  async function createPasskeyForTab(lockedTabId) {
    if (!window.isSecureContext) return { success: false };
    const existing = await chrome.runtime.sendMessage({ type: 'get-cred', hostname: window.location.hostname }).catch(() => null);
    if (existing) {
      storedCred = existing;
      return { success: true };
    }
    const available = true;
    if (!available) return { success: false };
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const cred = await callWebAuthn('create', {
        
          challenge,
          rp: { id: window.location.hostname, name: 'Tab Lock' },
          user: {
            id: new TextEncoder().encode('tablock-' + lockedTabId),
            name: 'Tab Lock User',
            displayName: 'Tab Lock User'
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 30000
      });
      const credData = { id: Array.from(new Uint8Array(cred.rawId)), rpId: window.location.hostname };
      await chrome.runtime.sendMessage({ type: 'store-cred', hostname: window.location.hostname, data: credData });
      storedCred = credData;
      return { success: true };
    } catch (e) {
      return { success: false, error: e.name };
    }
  }

  async function verifyIdentity() {
    const host = window.location.hostname;
    const cred = await chrome.runtime.sendMessage({ type: 'get-cred', hostname: host }).catch(() => null);
    if (!cred) return { success: false, error: 'No passkey for this site' };
    if (!window.isSecureContext) return { success: false, error: 'Not a secure page' };

    if (overlay) {
      const card = overlay.querySelector('.tab-lock-card');
      let section = card.querySelector('.tlock-verify');
      if (section) return { success: false, error: 'Already showing' };
      section = document.createElement('div');
      section.className = 'tlock-remove-confirm';
      section.innerHTML = '<div class="tlock-remove-confirm-text">Verify identity</div><button class="tlock-remove-confirm-btn">Verify</button><button class="tlock-remove-cancel-btn">Cancel</button>';
      card.appendChild(section);
      const res = await attachVerifyHandlers(section, cred, host);
      if (res && res.success) showPasswordResetUI(card, overlay);
      return res;
    }

    const dialog = document.createElement('div');
    dialog.id = 'tab-lock-overlay';
    dialog.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(28,27,34,0.85);backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif';
    const card = document.createElement('div');
    card.className = 'tlock-reset-card';
    card.style.cssText = 'width:340px;max-width:calc(100vw - 48px);background:#2b2a33;border:1px solid #3a3945;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);padding:32px 28px 28px;text-align:center';

    const iconDiv = document.createElement('div');
    iconDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;margin:0 auto 16px;width:56px;height:56px;border-radius:50%;background:rgba(0,221,255,0.12)';
    iconDiv.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#00ddff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px"><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="14.5" rx="4" ry="2.5"/><circle cx="9" cy="9.5" r="1" fill="#00ddff" stroke="none"/><circle cx="15" cy="9.5" r="1" fill="#00ddff" stroke="none"/></svg>';
    card.appendChild(iconDiv);

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:20px;font-weight:700;color:#f0f0f4;margin-bottom:4px;letter-spacing:-0.01em';
    titleEl.textContent = 'Verify Identity';
    card.appendChild(titleEl);

    const hostEl = document.createElement('div');
    hostEl.style.cssText = 'font-size:13px;color:#9b9aa5;margin-bottom:24px';
    hostEl.textContent = host;
    card.appendChild(hostEl);

    const body = document.createElement('div');
    body.id = 'tlock-verify-body';
    card.appendChild(body);
    dialog.appendChild(card);
    document.documentElement.appendChild(dialog);

    const wrapper = document.createElement('div');
    const verifyBtn = document.createElement('button');
    verifyBtn.className = 'tlock-remove-confirm-btn';
    verifyBtn.textContent = 'Verify';
    wrapper.appendChild(verifyBtn);
    const cancelBtn2 = document.createElement('button');
    cancelBtn2.className = 'tlock-remove-cancel-btn';
    cancelBtn2.style.cssText = 'display:block;margin:12px auto 0;background:none;border:none;padding:4px 8px;color:#9b9aa5;font-size:11px;font-family:inherit;cursor:pointer;opacity:0.6';
    cancelBtn2.textContent = 'Cancel';
    wrapper.appendChild(cancelBtn2);
    const errEl2 = document.createElement('div');
    errEl2.className = 'tlock-pwd-err';
    errEl2.style.marginTop = '8px';
    wrapper.appendChild(errEl2);
    body.appendChild(wrapper);

    const res = await attachVerifyHandlers(wrapper, cred, host);
    if (res && res.success) {
      showPasswordResetUI(card, dialog);
      return { success: true };
    }
    dialog.remove();
    return res;
  }

  function showPasswordResetUI(card, container) {
    card.textContent = '';
    const icon = document.createElement('div');
    icon.style.cssText = 'display:flex;align-items:center;justify-content:center;margin:0 auto 16px;width:56px;height:56px;border-radius:50%;background:rgba(0,221,255,0.12)';
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#00ddff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
    card.appendChild(icon);
    const title = document.createElement('div');
    title.style.cssText = 'font-size:20px;font-weight:700;color:#f0f0f4;margin-bottom:12px;letter-spacing:-0.01em';
    title.textContent = 'Set New Master Password';
    card.appendChild(title);
    const pwd1 = document.createElement('input');
    pwd1.type = 'password';
    pwd1.className = 'tlock-pwd-input';
    pwd1.placeholder = 'New password';
    pwd1.autocomplete = 'off';
    pwd1.style.marginBottom = '8px';
    card.appendChild(pwd1);
    const pwd2 = document.createElement('input');
    pwd2.type = 'password';
    pwd2.className = 'tlock-pwd-input';
    pwd2.placeholder = 'Confirm new password';
    pwd2.autocomplete = 'off';
    pwd2.style.marginBottom = '8px';
    card.appendChild(pwd2);
    const errEl = document.createElement('div');
    errEl.className = 'tlock-pwd-err';
    errEl.style.marginBottom = '4px';
    card.appendChild(errEl);
    const saveBtn = document.createElement('button');
    saveBtn.className = 'tlock-remove-confirm-btn';
    saveBtn.textContent = 'Save Password';
    card.appendChild(saveBtn);
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'tlock-remove-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.display = 'block';
    cancelBtn.style.margin = '12px auto 0';
    card.appendChild(cancelBtn);

    pwd1.focus();
    cancelBtn.addEventListener('click', () => { container.remove(); });
    saveBtn.addEventListener('click', async () => {
      const p1 = pwd1.value;
      const p2 = pwd2.value;
      if (!p1 || p1.length < 4) { errEl.textContent = 'Password must be at least 4 characters'; return; }
      if (p1 !== p2) { errEl.textContent = 'Passwords do not match'; return; }
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      await chrome.runtime.sendMessage({ type: 'set-password', password: p1 });
      card.textContent = '';
      const okIcon = document.createElement('div');
      okIcon.style.cssText = 'display:flex;align-items:center;justify-content:center;margin:0 auto 16px;width:56px;height:56px;border-radius:50%;background:rgba(42,195,162,0.12)';
      okIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#2ac3a2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px"><polyline points="20 6 9 17 4 12"/></svg>';
      card.appendChild(okIcon);
      const okTitle = document.createElement('div');
      okTitle.style.cssText = 'font-size:20px;font-weight:700;color:#f0f0f4';
      okTitle.textContent = 'Password Saved';
      card.appendChild(okTitle);
      await new Promise(r => setTimeout(r, 1200));
      container.remove();
    });
    pwd1.addEventListener('keydown', e => { if (e.key === 'Enter') pwd2.focus(); });
    pwd2.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });
  }

  function attachVerifyHandlers(container, cred, host) {
    return new Promise(resolve => {
      const confirmBtn = container.querySelector('.tlock-remove-confirm-btn');
      const cancelBtn = container.querySelector('.tlock-remove-cancel-btn');
      const errEl = container.querySelector('.tlock-pwd-err');
      if (!confirmBtn) { resolve({ success: false }); return; }
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Authenticating...';
        try {
          const challenge = new Uint8Array(32);
          crypto.getRandomValues(challenge);
          await callWebAuthn('get', { challenge, allowCredentials: [{ id: new Uint8Array(cred.id), type: 'public-key' }], userVerification: 'required', timeout: 30000 });
          resolve({ success: true });
        } catch {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Verify';
          if (errEl) errEl.textContent = 'Authentication failed';
          resolve({ success: false, error: 'Authentication failed' });
        }
      });
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          container.remove();
          resolve({ success: false, error: 'Cancelled' });
        });
      }
    });
  }

  function showRemoveConfirmUI(lockedTabId) {
    if (!overlay || !currentTab) return;
    const oldRemove = overlay.querySelector('#tlock-remove');
    if (oldRemove) oldRemove.style.display = 'none';
    const card = overlay.querySelector('.tab-lock-card');
    let section = card.querySelector('.tlock-remove-confirm');
    if (section) return;
    section = document.createElement('div');
    section.className = 'tlock-remove-confirm';

    chrome.runtime.sendMessage({ type: 'has-password' }).then(hasPwd => {
      if (hasPwd) {
        section.innerHTML = '<div class="tlock-remove-confirm-text">Enter master password to remove</div><input type="password" class="tlock-pwd-input" placeholder="Password" autocomplete="off"><div class="tlock-pwd-err"></div><button class="tlock-remove-confirm-btn">Remove</button><button class="tlock-remove-cancel-btn">Cancel</button>';
        card.appendChild(section);
        const input = section.querySelector('input');
        const errEl = section.querySelector('.tlock-pwd-err');
        const confirmBtn = section.querySelector('.tlock-remove-confirm-btn');
        const cancelBtn = section.querySelector('.tlock-remove-cancel-btn');
        input.focus();
        async function submitPwd() {
          const pwd = input.value;
          if (!pwd) { errEl.textContent = 'Enter your master password'; return; }
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Verifying...';
          const ok = await chrome.runtime.sendMessage({ type: 'verify-password', password: pwd });
          if (!ok) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Remove';
            errEl.textContent = 'Incorrect password';
            input.value = '';
            input.focus();
            return;
          }
          confirmBtn.textContent = 'Removing...';
          await chrome.runtime.sendMessage({ type: 'remove-locked-tab', lockedTabId });
          section.remove();
          removeOverlay();
        }
        confirmBtn.addEventListener('click', submitPwd);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') submitPwd(); });
        cancelBtn.addEventListener('click', () => {
          section.remove();
          if (oldRemove) oldRemove.style.display = '';
        });
        return;
      }

      const host = window.location.hostname;
      chrome.runtime.sendMessage({ type: 'get-cred', hostname: host }).then(cred => {
        if (!cred) {
          chrome.runtime.sendMessage({ type: 'remove-locked-tab', lockedTabId });
          removeOverlay();
          return;
        }
        storedCred = cred;
        section.innerHTML = '<div class="tlock-remove-confirm-text">Remove lock for this site?</div><button class="tlock-remove-confirm-btn">Confirm</button><button class="tlock-remove-cancel-btn">Cancel</button>';
        card.appendChild(section);
        const confirmBtn = section.querySelector('.tlock-remove-confirm-btn');
        const cancelBtn = section.querySelector('.tlock-remove-cancel-btn');
        confirmBtn.addEventListener('click', async () => {
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Authenticating...';
          try {
            const challenge = new Uint8Array(32);
            crypto.getRandomValues(challenge);
            await callWebAuthn('get', { challenge, allowCredentials: [{ id: new Uint8Array(storedCred.id), type: 'public-key' }], userVerification: 'required', timeout: 30000 });
            await chrome.runtime.sendMessage({ type: 'remove-locked-tab', lockedTabId });
            section.remove();
            setTimeout(removeOverlay, 400);
          } catch {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm';
          }
        });
        cancelBtn.addEventListener('click', () => {
          section.remove();
          if (oldRemove) oldRemove.style.display = '';
        });
      });
    });
  }
})();
