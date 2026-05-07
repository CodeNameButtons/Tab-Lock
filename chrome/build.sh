#!/bin/bash
cd "$(dirname "$0")"
python3 << 'PYEOF'
import zipfile, os
root = os.getcwd()
files = ["manifest.json","background.js","content.js","popup.html","popup.js","styles.css","lock-screen.css","webauthn-bridge.js","icons/icon-48.png","icons/icon-128.png","icons/locked.svg","icons/unlocked.svg"]
out = os.path.join(root, "TabLock-Chrome.zip")
if os.path.exists(out): os.remove(out)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(os.path.join(root, f), f)
print(f"TabLock-Chrome.zip built ({os.path.getsize(out)} bytes)")
PYEOF
