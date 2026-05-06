# Tab Lock - Zen Browser Extension Specification

## Project Overview

**Project Name:** Tab Lock
**Type:** Browser Extension (WebExtension for Zen Browser/Firefox)
**Core Functionality:** Allows users to right-click a tab and lock it behind a password or Windows Hello/biometric authentication
**Target Users:** Privacy-conscious users who want to protect specific tabs from casual access

## UI/UX Specification

### Layout Structure

#### Lock Screen Overlay
- Full-page overlay that replaces the page content when a locked tab is accessed
- Centered modal container (max-width: 400px)
- No scroll, blocks all page interaction until unlocked

#### Popup Management UI
- Compact popup (320px x 400px) showing all locked tabs
- List view of locked tabs with unlock/delete options

### Visual Design

**Color Palette:**
- Background: `#1a1a2e` (deep navy)
- Surface: `#16213e` (dark blue)
- Primary: `#0f3460` (medium blue)
- Accent: `#e94560` (coral pink)
- Text Primary: `#eaeaea`
- Text Secondary: `#a0a0a0`
- Success: `#4ecca3`
- Border: `#2a2a4a`

**Typography:**
- Font Family: "Segoe UI", system-ui, sans-serif
- Heading: 24px, font-weight 600
- Body: 14px, font-weight 400
- Small: 12px

**Spacing:**
- Base unit: 8px
- Container padding: 24px
- Element gap: 16px
- Button padding: 12px 24px

**Visual Effects:**
- Box shadow: `0 8px 32px rgba(0, 0, 0, 0.4)`
- Border radius: 12px
- Subtle gradient on background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)`
- Lock icon pulse animation on lock screen
- Smooth transitions: 0.2s ease

### Components

#### Lock Screen
- Lock icon (animated pulse)
- "Tab Locked" heading
- Instruction text
- Password input field
- "Unlock with Windows Hello" button (if available)
- "Unlock" button
- Error message area (red text)

#### Context Menu
- "Lock Tab" menu item (appears on tab right-click)
- "Unlock Tab" menu item (appears on locked tabs)
- "Manage Locked Tabs" menu item

#### Popup UI
- Header with "Tab Lock" title and lock icon
- List of locked tabs (favicon + title + domain)
- Each item: unlock button, remove button
- "Lock current tab" button at bottom
- Empty state: "No locked tabs" message

### Responsive Behavior
- Lock screen: full viewport coverage
- Popup: fixed size, doesn't scale
- Touch-friendly button sizes (min 44px tap target)

## Functionality Specification

### Core Features

1. **Lock Tab via Context Menu**
   - Right-click tab shows "Lock Tab" option
   - Clicking locks the tab immediately
   - Tab marked as locked in extension storage

2. **Tab Lock State Management**
   - Store locked tabs in browser.storage.local
   - Each entry: { tabId, url, title, favicon, lockedAt }
   - Persist across browser restarts

3. **Lock Screen Display**
   - When loading a locked URL, show full-page lock overlay
   - Block all page content until unlocked
   - Display page favicon and title (sanitized)

4. **Password Unlock**
   - User enters password to unlock
   - Password set first time tab is locked
   - Stored securely (hashed) in extension storage

5. **Windows Hello Unlock**
   - Use WebAuthn API for biometric/password authentication
   - Register credential when first locking with Windows Hello option
   - Authenticate using Windows Hello on subsequent visits

6. **Auto-Lock on Close**
   - Option to re-lock tab when browser closes (configurable)
   - Clear unlock state on browser restart

7. **Manage Locked Tabs**
   - View all locked tabs in popup
   - Unlock individual tabs
   - Remove from locked list
   - Lock current tab from popup

### User Interactions and Flows

**First Lock Flow:**
1. User right-clicks tab → "Lock Tab"
2. Modal appears: "Set a password to lock this tab"
3. User enters password + confirms
4. Optional: Enable Windows Hello for this tab
5. Tab now locked

**Unlock Flow:**
1. User visits locked tab
2. Lock screen appears with password input
3. User enters password OR clicks "Unlock with Windows Hello"
4. Success → page loads normally
5. Failure → error message, retry

**Manage Flow:**
1. Click extension icon → popup opens
2. See list of locked tabs
3. Click unlock to temporarily unlock
4. Click X to remove from locked list

### Data Handling

- **Storage:** browser.storage.local
- **Locked tabs:** Array of { id, url, title, favicon, lockedAt, authType }
- **Password:** SHA-256 hashed (never stored plaintext)
- **WebAuthn:** Platform authenticator (Windows Hello)

### Edge Cases

- Tab URL changes (redirect): Match by base domain
- Multiple tabs same domain: Each tab independently locked
- Locked tab closed: Remains in locked list
- Browser update: Maintain locked state
- No Windows Hello: Hide Windows Hello option gracefully

## Technical Implementation

### Files Structure
```
tab-lock/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── styles.css
├── lock-screen.css
└── icons/
    ├── icon-48.png
    ├── icon-96.png
    └── icon-128.png
```

### Permissions Required
- `tabs` - Access tab information
- `storage` - Store locked tab data
- `contextMenus` - Add right-click menu
- `webNavigation` - Detect page loads
- `activeTab` - Get current tab info

### Browser API Usage
- `browser.contextMenus` - Create context menu
- `browser.storage.local` - Persistent storage
- `browser.webNavigation.onCompleted` - Detect page load
- `browser.tabs.onUpdated` - Track tab changes
- `WebAuthn API` - Windows Hello integration

## Acceptance Criteria

1. Right-clicking any tab shows "Lock Tab" in context menu
2. Locking a tab immediately shows lock screen on reload/visit
3. Password can be set and correctly verifies on unlock
4. Windows Hello option appears and functions on supported systems
5. Popup shows all locked tabs with management options
6. Locked tabs persist across browser restarts
7. Lock screen fully blocks page interaction
8. Visual design matches spec (colors, typography, animations)
9. Works in Zen Browser (Firefox-based)