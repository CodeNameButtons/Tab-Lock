# Tab Lock — Zen Mod Experiment

This is an experimental Zen Browser mod that enhances the Tab Lock extension's visual integration into Zen Browser.

## What it does

- Adds a subtle lock icon overlay on locked tabs in the tab bar
- Styles locked tabs with a distinct colour tint so you can identify them at a glance
- Tightens the lock screen overlay style to match Zen's native design language

## Installation

1. Make sure the Tab Lock extension is installed from `about:addons`
2. Copy the `userChrome.css` contents into your Zen profile's `chrome/userChrome.css`
   - Profile location: `about:support` → Profile Folder → `chrome/` (create if missing)
3. Copy the `userContent.css` contents into `chrome/userContent.css`
4. Restart the browser

## How the tab bar styling works

The `userChrome.css` targets tabs with `data-tablock-locked="true"`. This attribute
is not yet automatically set by the extension — it requires a companion
`userChrome.js` script or a future update to the extension itself. Currently the
CSS is a reference implementation for when that integration is built.

The lock screen overlay styling in `userContent.css` works immediately.

## Files

| File | Purpose |
|------|---------|
| `userChrome.css` | Browser chrome tweaks (tab bar, icons) |
| `userContent.css` | Page content tweaks (lock screen overlay) |
| `config.css` | Reference configuration values |

## Notes

This is experimental. It modifies the browser's internal UI and may need updates
when Zen Browser versions change.
