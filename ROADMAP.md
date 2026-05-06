# Tab Lock — Roadmap

## ✅ Completed

- **Master password system** — Set on first launch, required to remove locks and uninstall. SHA-256 hashed.
- **Reset password flow** — Enter current password OR click "Forgot password" → verify via platform auth in-tab → set new password.
- **Platform detection** — Button text and messages adapt to OS: Windows Hello, Touch ID (macOS), Face ID (iOS), Biometrics (Android), Passkey (Linux).
- **Media-aware inactivity** — Toggle in settings: media playback can override the auto-lock timer.
- **Notify on auto-lock** — Toggle in settings: sends a system notification when a tab auto-locks in the background.
- **Passkey persistence** — Passkeys are never deleted on lock removal, so re-locking a site reuses the existing credential.
- **Enterprise policy tooling** — `scripts/install-policy.bat` and `.sh` lock the extension via Firefox's `policies.json`. Settings view shows whether the policy is active.
- **Context menu** — Right-click → "Lock Tab" on any page or tab.
- **Version 1.1.0** — Published to XPI and source zip.

## Phase 1: Bug Fixes (Current)

- [ ] **Tab re-locking bug** — User reports tabs still locking on revisit after removal. Needs reproduction steps and root cause fix.
- [ ] **Test all flows end-to-end** — Lock, unlock, remove with password, remove without password, forgot password, uninstall, settings toggles.

## Phase 2: Multi-Platform Passkey Support

- [ ] **Android compatibility** — Ensure the extension works on Firefox for Android (passkey creation, lock screen overlay, inactivity timer, popup layout).
- [ ] **Google Password Manager / Google passkeys** — Support Google passkeys alongside platform authenticators for cross-device sync.
- [ ] **Platform-agnostic fallback** — When no platform authenticator is available, fall back to security key or passkey from password manager.

## Phase 3: Firefox Stability & Mobile Readiness

- [ ] **Cross-version testing** — Test on Firefox stable, Beta, Nightly, and Zen Browser.
- [ ] **Mobile UI optimization** — Adapt popup and lock screen layouts for small screens and touch.
- [ ] **Fix mobile-specific WebAuthn issues** — `navigator.credentials.create()` / `get()` differ on Android.
- [ ] **AMO review readiness** — Privacy policy, data collection disclosure, source code submission.
- [ ] **Source code zip** — Already being maintained (`TabLock-source.zip`, updated with each release).

## Phase 4: Port to Chrome

- [ ] **Manifest V3 migration** — Service worker background, `chrome.*` API namespace, updated permissions.
- [ ] **Chrome Web Store submission** — Package, review, publish.
- [ ] **Feature parity** — Context menus, notifications, WebAuthn, storage all working in Chrome.

## Phase 5: Port to Safari (Low Priority)

- [ ] **Safari Web Extension conversion** — Use `xcrun safari-web-extension-converter`.
- [ ] **Safari-specific fixes** — Different API availability, permission model.
- [ ] **App Store submission** — Package and submit.

## Technical Debt

- [ ] Add automated tests for core flows.
- [ ] Evaluate removing `"<all_urls>"` in favour of narrower host permissions.
- [ ] End-to-end encryption for stored passkey metadata.
