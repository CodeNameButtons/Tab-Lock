#!/bin/bash
# Tab Lock - Enterprise Policy Installer (Linux/macOS)
# Run as root to lock the extension from removal.
# Usage: sudo bash install-policy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
POLICY_SRC="$SCRIPT_DIR/../deploy/policies.json"

echo "Tab Lock - Policy Installer"
echo "============================"
echo ""
echo "This will lock Tab Lock so it cannot be removed from about:addons."
echo ""

FOUND=0

# Common installation paths
PATHS=(
  "/usr/lib/firefox/distribution"
  "/usr/lib/firefox-esr/distribution"
  "/usr/lib/zen/distribution"
  "/usr/lib/zen-browser/distribution"
  "/snap/firefox/current/usr/lib/firefox/distribution"
  "/Applications/Firefox.app/Contents/Resources/distribution"
  "/Applications/Zen Browser.app/Contents/Resources/distribution"
)

for DIR in "${PATHS[@]}"; do
  PARENT="$(dirname "$DIR")"
  if [ -d "$PARENT" ]; then
    mkdir -p "$DIR" 2>/dev/null || true
    if [ -d "$DIR" ]; then
      cp "$POLICY_SRC" "$DIR/policies.json" 2>/dev/null && echo "[OK] Installed policy at: $DIR/policies.json" && FOUND=1
    fi
  fi
done

if [ "$FOUND" -eq 0 ]; then
  echo "[!!] Could not find a Firefox or Zen Browser installation."
  echo ""
  echo "Manual install:"
  echo "  1. Find your browser install folder"
  echo "  2. Create a 'distribution' folder inside it"
  echo "  3. Copy deploy/policies.json into it as policies.json"
  echo "  4. Restart the browser"
fi

echo ""
echo "Done. Restart your browser for the policy to take effect."
