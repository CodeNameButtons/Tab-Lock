# Tab Lock — Roadmap

## Phase 1: Bug Fixes (Current)

- [ ] **Investigate tab re-locking bug** — User reports that tabs still lock on revisit even after removing the lock. Need to reproduce and identify the root cause.

## Phase 2: Multi-Platform Passkey Support

- [ ] **Android compatibility** — Ensure the extension works correctly on Firefox for Android (passkey creation, lock screen overlay, inactivity timer).
- [ ] **Google Password Manager / Google passkeys** — Add support for Google passkeys as an authentication method alongside Windows Hello. This enables cross-device passkey sync via Google account.
- [ ] **Platform-agnostic passkey fallback** — When Windows Hello is unavailable (Linux, Android without biometrics), fall back to a platform-agnostic WebAuthn flow (PIN, security key, or password manager).

## Phase 3: Firefox Stability & Mobile Readiness

- [ ] **Thorough cross-version testing** — Test on Firefox stable, Beta, Nightly, and Zen Browser.
- [ ] **Mobile UI optimization** — Adapt popup and lock screen layouts for smaller screens and touch input.
- [ ] **Fix mobile-specific issues** — WebAuthn behavior differs on Android; ensure `navigator.credentials.create()` and `get()` work reliably.
- [ ] **AMO review readiness** — Ensure all Firefox add-on store requirements are met (privacy policy, data collection disclosure, source code submission).

## Phase 4: Port to Chrome

- [ ] **Manifest V3 migration** — Rewrite background script as service worker, replace `browser` with `chrome` API namespaces, update permissions model.
- [ ] **Chrome Web Store submission** — Package for CWS, handle review requirements.
- [ ] **Feature parity** — Ensure all Firefox features work in Chrome (context menus, notifications, WebAuthn, storage).

## Phase 5: Port to Safari (Low Priority)

- [ ] **Safari Web Extension conversion** — Use `xcrun safari-web-extension-converter` to create an Xcode project.
- [ ] **Safari-specific issues** — Handle different API availability, permission model, and App Store requirements.
- [ ] **App Store submission** — Package and submit to the Mac App Store.

## Technical Debt & Improvements

- [ ] Add automated tests for core flows (lock, unlock, remove, password reset).
- [ ] Consider end-to-end encryption for stored passkey metadata.
- [ ] Evaluate removing `"<all_urls>"` permission in favour of host permissions for better privacy review.
