#!/bin/bash
# Tab Lock - Native Helper Installer (Linux/macOS)

set -e

echo "Tab Lock - Native Helper Installer"
echo "=================================="
echo ""

# Detect browser
BROWSER=""
if command -v zen &>/dev/null; then
    BROWSER="zen"
elif command -v firefox &>/dev/null; then
    BROWSER="firefox"
elif [ -d "/Applications/Firefox.app" ]; then
    BROWSER="firefox"
elif [ -d "/Applications/Zen Browser.app" ]; then
    BROWSER="zen"
fi

if [ -z "$BROWSER" ]; then
    echo "[!!] Could not find Firefox or Zen Browser."
    exit 1
fi

# Determine manifest directory
if [[ "$OSTYPE" == "darwin"* ]]; then
    MANIFEST_DIR="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
    mkdir -p "$MANIFEST_DIR"
else
    MANIFEST_DIR="$HOME/.mozilla/native-messaging-hosts"
    mkdir -p "$MANIFEST_DIR"
    if [ "$BROWSER" = "zen" ]; then
        MANIFEST_DIR="$HOME/.zen/native-messaging-hosts"
        mkdir -p "$MANIFEST_DIR"
    fi
fi

HELPER_DIR="$HOME/.local/share/tablock-helper"
mkdir -p "$HELPER_DIR"

cp "$(dirname "$0")/tablock-helper.sh" "$HELPER_DIR/"
chmod +x "$HELPER_DIR/tablock-helper.sh"

# Copy XPI backup
XPI_SRC="$(dirname "$0")/../TabLock.xpi"
if [ -f "$XPI_SRC" ]; then
    cp "$XPI_SRC" "$HELPER_DIR/"
fi

# Write manifest with absolute path
MANIFEST="$MANIFEST_DIR/tablock_helper.json"
cat > "$MANIFEST" << EOF
{
  "name": "tablock_helper",
  "description": "Tab Lock native helper - prevents extension removal",
  "path": "$HELPER_DIR/tablock-helper.sh",
  "type": "stdio",
  "allowed_extensions": ["tablock@zen.example"]
}
EOF

echo "[OK] Helper installed at $HELPER_DIR"
echo "[OK] Manifest installed at $MANIFEST"
echo ""
echo "Restart your browser for changes to take effect."
