# Privacy Policy — Tab Lock

**Last updated:** May 2026

Tab Lock does not collect, transmit, or share any personal data.

## Data storage

All data is stored locally on your device using `chrome.storage.local` (or `browser.storage.local` on Firefox):

- **Locked tab entries** — URL, title, and timestamp of locked tabs
- **Passkey credential references** — hostname and credential ID (the passkey itself is managed by the browser's WebAuthn system, not by this extension)
- **Master password** — SHA-256 hash (never plaintext)
- **User settings** — auto-lock timeout, media override preference, notification preference

## Network requests

The extension makes **zero external network requests**. There is no telemetry, no analytics, no crash reporting, and no remote code execution.

## WebAuthn / passkeys

Passkey creation and authentication use the browser's built-in WebAuthn API (`navigator.credentials`). Credentials are managed by the operating system's platform authenticator (Windows Hello, Touch ID, Face ID) and never leave your device.

## Third parties

No third-party services, SDKs, analytics frameworks, or trackers are used.

## Data deletion

You can clear all extension data at any time:
- **Chrome:** `chrome://extensions` → Tab Lock → "Clear storage"
- **Firefox:** `about:addons` → Tab Lock → "Clear storage" or simply uninstall the extension

## Contact

Built by **Buttons Digital**  
https://buttonsdigital.co.uk  
https://www.buymeacoffee.com/buttonsdigital
