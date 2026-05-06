# Tab Lock - Zen Browser Extension

Lock browser tabs behind a password or Windows Hello authentication.

## Features

- **Right-click to lock** - Right-click any tab to lock it
- **Password protection** - Set a password to protect locked tabs
- **Windows Hello** - Use biometric authentication to unlock tabs
- **Management popup** - View and manage all locked tabs from the extension popup

## Installation (Loading as Custom Extension/Mod)

Zen Browser is based on Firefox, so you can load unpacked extensions directly without going through the marketplace.

### Method 1: Load Temporary Extension (Quickest)

1. Open Zen Browser
2. Navigate to `about:debugging` in the address bar
3. Click **"This Firefox"** in the left sidebar
4. Click **"Load Temporary Add-on..."**
5. Navigate to the `/home/izzy/Projects/Tab Lock/` folder
6. Select `manifest.json`
7. Click **Open**

The extension will be loaded temporarily. It will stay until you close Zen Browser.

To keep it permanently, use Method 2.

### Method 2: Install Permanently

1. Find your Zen Browser profile folder:
   - Linux: `~/.zen/` or `~/.var/app/zen.zen/browser/` 
   - Windows: `%APPDATA%\Zen\Profiles\`
   - Mac: `~/Library/Application Support/Zen/Profiles/`

2. In your profile folder, find the `extensions` folder (create it if it doesn't exist)

3. Create a unique folder name inside (e.g., `tablock@zen.example`)

4. Copy all extension files into that folder:
   - manifest.json
   - background.js
   - content.js
   - popup.html
   - popup.js
   - styles.css
   - lock-screen.css
   - icons/ (folder with icon files)

5. Create a file named `manifest.json` in the extensions folder (the parent folder) with the extension ID mapping

Actually, the easiest permanent way is:

1. Package the extension as a `.xpi` file:
   ```bash
   cd /home/izzy/Projects/Tab Lock
   zip -r tablock.xpi manifest.json background.js content.js popup.html popup.js styles.css lock-screen.css icons/
   ```

2. Open `about:addons` in Zen Browser
3. Click the gear icon (settings) → "Install Add-on From File..."
4. Select the `.xpi` file

### Method 3: Using about:support

1. Go to `about:support` in Zen Browser
2. Click "Open Folder" next to "Profile Folder"
3. Navigate to `extensions/`
4. Copy extension files there
5. Restart Zen Browser

## Usage

### Locking a Tab

1. Right-click on any tab
2. Select "Lock Tab"
3. A popup will appear - enter and confirm a password
4. The tab is now locked

### Unlocking a Tab

When you visit a locked tab, you'll see a lock screen:
- Enter your password to unlock
- If you set up Windows Hello, click "Unlock with Windows Hello"

### Managing Locked Tabs

1. Click the extension icon in the toolbar
2. View all locked tabs
3. Click the unlock icon to remove from locked list
4. Click "Lock Current Tab" to lock the active tab

## Files

```
tab-lock/
├── manifest.json      # Extension manifest
├── background.js      # Background script (tab management, storage)
├── content.js        # Content script (lock screen overlay)
├── popup.html        # Extension popup UI
├── popup.js          # Popup logic
├── styles.css        # Popup styling
├── lock-screen.css   # Lock screen styling
├── icons/            # Extension icons
│   ├── icon-48.png
│   ├── icon-96.png
│   └── icon-128.png
└── README.md         # This file
```

## Security Notes

- Passwords are stored as SHA-256 hashes (never stored in plaintext)
- Windows Hello uses WebAuthn with platform authenticator
- Locked state persists across browser sessions
- Each tab is locked by domain (all pages on same domain share lock)

## Development

To update the extension:
1. Make changes to the source files
2. Go to `about:debugging`
3. Click "Reload" next to the extension

## Troubleshooting

**Extension not loading:**
- Check for errors in `about:console`
- Verify all files are in the correct locations

**Lock screen not appearing:**
- Make sure content script is loaded
- Check browser console for errors

**Windows Hello not working:**
- Ensure Windows Hello is set up in Windows Settings
- Check if WebAuthn is supported in your browser

## License

MIT License