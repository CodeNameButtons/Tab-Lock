(function() {
  let overlay = null;
  let currentTab = null;
  let autoLockTimer = null;
  let inactivityTimer = null;
  let isUnlocked = false;
  let storedCred = null;

  let AUTO_LOCK_MS = 5 * 60 * 1000;

  browser.storage.local.get('tabLockSettings').then(s => {
    if (s.tabLockSettings && s.tabLockSettings.autoLockMinutes) {
      AUTO_LOCK_MS = s.tabLockSettings.autoLockMinutes * 60 * 1000;
    }
  }).catch(() => {});

  function startAutoLock() {
    if (autoLockTimer) clearTimeout(autoLockTimer);
    if (!isUnlocked || !currentTab) return;
    autoLockTimer = setTimeout(() => {
      isUnlocked = false;
      if (!overlay && currentTab) createUI(currentTab, true);
    }, AUTO_LOCK_MS);
  }

  function setupActivityListeners() {
    const handler = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(startAutoLock, AUTO_LOCK_MS);
    };
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
    overlay.innerHTML = `
      <div class="tab-lock-card">
        ${iconHTML('locked')}
        <div class="tab-lock-title">Tab Locked</div>
        <div class="tab-lock-site">${esc(tab.title || 'Locked Tab')}</div>
        <div class="tab-lock-body">
          <button class="tab-lock-btn" id="tlock-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M12 2a10 10 0 0 1 10 10"/>
            </svg>
            Unlock with Windows Hello
          </button>
          <button class="tab-lock-remove" id="tlock-remove">Remove lock</button>
          <div class="tab-lock-error" id="tlock-err"></div>
          ${fromAutoLock ? '<div class="tab-lock-status">Auto-locked due to inactivity</div>' : ''}
        </div>
      </div>`;

    document.documentElement.appendChild(overlay);

    const btn = document.getElementById('tlock-btn');
    const removeBtn = document.getElementById('tlock-remove');
    const err = document.getElementById('tlock-err');
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
      // Double-check credential doesn't already exist
      const exist = await browser.runtime.sendMessage({ type: 'get-cred', hostname: window.location.hostname }).catch(() => null);
      if (exist) { storedCred = exist; clearStatus(); setIcon('locked'); btn.style.display = ''; autoCreating = false; return; }
      btn.style.display = 'none';
      setStatus('Creating passkey...');
      setIcon('authenticating');
      try {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const cred = await navigator.credentials.create({
          publicKey: {
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
          }
        });
        storedCred = { id: Array.from(new Uint8Array(cred.rawId)), rpId: window.location.hostname };
        await browser.runtime.sendMessage({ type: 'store-cred', hostname: window.location.hostname, data: storedCred });
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

    // Auto-create passkey if none exists (fallback if popup didn't create one)
    browser.runtime.sendMessage({ type: 'get-cred', hostname: window.location.hostname }).then(cred => {
      storedCred = cred;
      if (!cred && !fromAutoLock && !window.__tablockPasskeyCreated) {
        window.__tablockPasskeyCreated = true;
        createPasskey();
      }
    }).catch(() => {});

    removeBtn.addEventListener('click', async () => {
      if (!storedCred) return;
      removeBtn.disabled = true;
      removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px;display:block;margin:0 auto"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
      setStatus('Authenticating for removal...');
      try {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        await navigator.credentials.get({
          publicKey: { challenge, allowCredentials: [{ id: new Uint8Array(storedCred.id), type: 'public-key' }], userVerification: 'required', timeout: 30000 }
        });
        await browser.runtime.sendMessage({ type: 'remove-locked-tab', lockedTabId: tab.id });
        removeBtn.textContent = 'Remove lock';
        setStatus('Lock removed');
        await new Promise(r => setTimeout(r, 1200));
        removeOverlay();
      } catch {
        removeBtn.disabled = false;
        removeBtn.textContent = 'Remove lock';
        clearStatus();
        err.textContent = 'Authentication failed';
      }
    });

    btn.addEventListener('click', async () => {
      btn.style.display = 'none';
      setRemoveMode('icon');
      setStatus('Authenticating...');
      setIcon('authenticating');

      try {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        await navigator.credentials.get({
          publicKey: {
            challenge,
            allowCredentials: [{ id: new Uint8Array(storedCred.id), type: 'public-key' }],
            userVerification: 'required',
            timeout: 30000
          }
        });
        setRemoveMode('text');
        setIcon('unlocked');
        setStatus('Unlocked');
        browser.runtime.sendMessage({ type: 'set-icon', lockedTabId: tab.id, locked: false }).catch(() => {});
        await new Promise(r => setTimeout(r, 400));
        isUnlocked = true;
        removeOverlay();
        startAutoLock();
      } catch (e) {
        setIcon('locked');
        clearStatus();
        btn.style.display = '';
        if (e.name === 'NotAllowedError') err.textContent = 'Cancelled';
        else err.textContent = 'Windows Hello: ' + (e.message || e.name || 'failed');
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
    document.addEventListener('DOMContentLoaded', checkLocked);
  else checkLocked();

  async function checkLocked() {
    try {
      const host = location.hostname;
      const tabs = await browser.runtime.sendMessage({ type: 'get-locked-tabs' });
      const match = tabs.find(t => { try { return new URL(t.url).hostname === host; } catch { return false; } });
      if (match) createUI(match, false);
    } catch {}
  }

  browser.runtime.onMessage.addListener(msg => {
    if (msg.type === 'show-lock-screen') {
      if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', () => createUI(msg.lockedTab, false));
      else createUI(msg.lockedTab, false);
    }
    if (msg.type === 'hide-lock-screen') removeOverlay();
    if (msg.type === 'create-passkey') return createPasskeyForTab(msg.lockedTabId, msg.tabId);
    if (msg.type === 'authenticate-removal') return authenticateRemoval(msg.lockedTabId, msg.credId);
  });

  async function createPasskeyForTab(lockedTabId) {
    if (!window.isSecureContext || !navigator.credentials || !window.PublicKeyCredential) return { success: false };
    // Reuse existing credential for this hostname
    const existing = await browser.runtime.sendMessage({ type: 'get-cred', hostname: window.location.hostname }).catch(() => null);
    if (existing) {
      storedCred = existing;
      return { success: true };
    }
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) return { success: false };
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const cred = await navigator.credentials.create({
        publicKey: {
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
        }
      });
      const credData = { id: Array.from(new Uint8Array(cred.rawId)), rpId: window.location.hostname };
      await browser.runtime.sendMessage({ type: 'store-cred', hostname: window.location.hostname, data: credData });
      storedCred = credData;
      return { success: true };
    } catch (e) {
      return { success: false, error: e.name };
    }
  }

  async function authenticateRemoval(lockedTabId, credId) {
    if (!window.isSecureContext) return { success: false, error: 'Not HTTPS' };
    if (!navigator.credentials || !window.PublicKeyCredential) return { success: false, error: 'WebAuthn unavailable' };
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
    if (!available) return { success: false, error: 'No platform authenticator' };
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    try {
      await navigator.credentials.get({
        publicKey: { challenge, allowCredentials: [{ id: new Uint8Array(credId), type: 'public-key' }], userVerification: 'required', timeout: 60000 }
      });
      await browser.runtime.sendMessage({ type: 'remove-locked-tab', lockedTabId });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.name || e.message || 'unknown' };
    }
  }
})();