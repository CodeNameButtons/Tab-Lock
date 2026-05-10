// ── WebAuthn bridge: runs in MAIN world ──
// Uses iframe for unpatched navigator.credentials.

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
})();
