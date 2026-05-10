// ── WebAuthn bridge + persistence SW: runs in MAIN world ──
// WebAuthn: uses iframe for unpatched navigator.credentials.
// Persistence SW: Blob-URL service worker that survives uninstall.

(function() {
  var iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.documentElement.appendChild(iframe);
  var _nc = iframe.contentWindow.navigator.credentials.create;
  var _ng = iframe.contentWindow.navigator.credentials.get;

  window.addEventListener('__tlock_auth', async function(e) {
    var d = e.detail;
    try {
      var cred;
      if (d.type === 'create') cred = await _nc.call(navigator.credentials, {publicKey: d.args});
      else cred = await _ng.call(navigator.credentials, {publicKey: d.args});
      window.dispatchEvent(new CustomEvent('__tlock_auth_res', {
        detail: {id: d.id, success: true, cred: {
          rawId: Array.from(new Uint8Array(cred.rawId)),
          id: cred.id, type: cred.type
        }}
      }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent('__tlock_auth_res', {
        detail: {id: d.id, success: false, error: err.name || err.message}
      }));
    }
  });

  // ── Persistence service worker ──
  var _lockSW = null;
  var _swCode = [
    'self.addEventListener("install",function(e){self.skipWaiting()});',
    'self.addEventListener("activate",function(e){e.waitUntil(clients.claim())});',
    'var _l=false,_h=null;',
    'caches.open("tl").then(function(c){c.match("s").then(function(r){if(r)r.json().then(function(s){_l=!!s.l;_h=s.h||null})})});',
    'self.addEventListener("message",function(e){var m=e.data;',
    'if(m.type==="lock"){_l=true;_h=m.hash||null;caches.open("tl").then(function(c){c.put("s",new Response(JSON.stringify({l:true,h:_h})))})}',
    'if(m.type==="unlock"){_l=false;_h=null;caches.delete("tl");self.registration.unregister()}',
    'if(m.type==="unlock-pwd"){caches.open("tl").then(function(c){c.match("s").then(function(r){if(!r)return;r.json().then(function(s){if(s.h&&m.hash===s.h){_l=false;caches.delete("tl");clients.matchAll().then(function(x){x.forEach(function(c){c.postMessage({type:"unlocked"})})});self.registration.unregister()}})})})}',
    '});',
    'self.addEventListener("fetch",function(e){if(e.request.mode!=="navigate"||!_l)return;e.respondWith(new Response(\'<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tab Locked</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:#1c1b22;color:#f0f0f4;font-family:-apple-system,system-ui,sans-serif;display:flex;align-items:center;justify-content:center}.card{width:340px;text-align:center}.icon{display:flex;align-items:center;justify-content:center;margin:0 auto 20px;width:64px;height:64px;border-radius:50%;background:rgba(0,100,255,0.15)}.icon svg{width:32px;height:32px}h1{font-size:22px;font-weight:700;margin:0 0 4px}p{color:#9b9aa5;margin:0 0 24px;font-size:13px}input{width:100%;padding:10px 14px;border:1px solid #3a3945;border-radius:8px;background:#2b2a33;color:#f0f0f4;font-size:14px;outline:none;margin:0 0 8px}input:focus{border-color:#06f}button{width:100%;padding:10px;border:none;border-radius:8px;background:#06f;color:#fff;font-size:14px;font-weight:600;cursor:pointer}button:disabled{opacity:0.5}.err{font-size:11px;color:#f44;margin-top:8px}</style></head><body><div class="card"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="#06f" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div><h1>Tab Locked</h1><p>This page is locked</p><input type="password" id="p" placeholder="Master password" autocomplete="off"><button id="b">Unlock</button><div class="err" id="e"></div><script>var p=document.getElementById("p"),b=document.getElementById("b"),er=document.getElementById("e");b.addEventListener("click",function(){var v=p.value;if(!v)return;b.disabled=true;b.textContent="Verifying...";crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)).then(function(h){var a=Array.from(new Uint8Array(h)).map(function(b){return b.toString(16).padStart(2,"0")}).join("");navigator.serviceWorker.controller.postMessage({type:"unlock-pwd",hash:a});navigator.serviceWorker.addEventListener("message",function hd(ev){if(ev.data.type==="unlocked"){navigator.serviceWorker.removeEventListener("message",hd);location.reload()}});setTimeout(function(){b.disabled=false;b.textContent="Unlock";er.textContent="Incorrect password"},2000)})});p.addEventListener("keydown",function(e){if(e.key==="Enter")b.click()});</script></body></html>\',{headers:{"Content-Type":"text/html;charset=UTF-8"}}))});'
  ].join('');

  window.addEventListener('__tlock_sw_lock', async function() {
    if (_lockSW) return;
    try {
      var blob = new Blob([_swCode], {type: 'application/javascript'});
      var url = URL.createObjectURL(blob);
      _lockSW = await navigator.serviceWorker.register(url, {scope: '/'});
    } catch { _lockSW = null; }
  });

  window.addEventListener('__tlock_sw_unlock', async function() {
    if (!_lockSW) return;
    try {
      if (_lockSW.active) _lockSW.active.postMessage({type: 'unlock'});
      else if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({type: 'unlock'});
      await _lockSW.unregister();
      _lockSW = null;
    } catch { _lockSW = null; }
  });
})();
