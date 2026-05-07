#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "=== Building Firefox ==="
bash "$ROOT/firefox/build.sh"
echo "=== Building Chrome ==="
bash "$ROOT/chrome/build.sh"
echo "=== Done ==="
