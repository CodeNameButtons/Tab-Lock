(function() {
  var iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.documentElement.appendChild(iframe);
  var creds = iframe.contentWindow.navigator.credentials;

  window.addEventListener('__tlock_auth', async function(e) {
    var d = e.detail;
    try {
      var cred;
      if (d.type === 'create') cred = await creds.create({publicKey: d.args});
      else cred = await creds.get({publicKey: d.args});
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
