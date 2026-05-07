window.addEventListener('__tlock_auth', async e => {
  const {id, type, args} = e.detail;
  try {
    let cred;
    if (type === 'create') {
      cred = await navigator.credentials.create({publicKey: args});
    } else {
      cred = await navigator.credentials.get({publicKey: args});
    }
    window.dispatchEvent(new CustomEvent('__tlock_auth_res', {
      detail: {id, success: true, cred: {
        rawId: Array.from(new Uint8Array(cred.rawId)),
        id: cred.id,
        type: cred.type
      }}
    }));
  } catch (err) {
    window.dispatchEvent(new CustomEvent('__tlock_auth_res', {
      detail: {id, success: false, error: err.name || err.message}
    }));
  }
});
