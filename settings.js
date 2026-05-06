document.addEventListener('DOMContentLoaded', async () => {
  const range = document.getElementById('lockMinutes');
  const value = document.getElementById('lockValue');
  const saveBtn = document.getElementById('saveBtn');
  const msg = document.getElementById('savedMsg');

  const s = await browser.storage.local.get('tabLock_settings');
  const minutes = (s.tabLockSettings && s.tabLockSettings.autoLockMinutes) || 5;
  range.value = minutes;
  value.textContent = minutes + ' min';

  range.addEventListener('input', () => {
    value.textContent = range.value + ' min';
    msg.textContent = '';
  });

  saveBtn.addEventListener('click', async () => {
    const mins = parseInt(range.value);
    await browser.storage.local.set({ tabLockSettings: { autoLockMinutes: mins } });
    msg.textContent = 'Saved. Auto-lock: ' + mins + ' min';
    setTimeout(() => msg.textContent = '', 2000);
  });
});