window.addEventListener('message', async (e) => {
  if (e.source !== window || e.data?.type !== 'FOCUSTRACKER_REQUEST') return;
  try {
    const data = await chrome.storage.local.get([
      'tabTime', 'idleTime', 'switchCount', 'approvedSites', 'snapshots'
    ]);
    window.postMessage({ type: 'FOCUSTRACKER_DATA', data }, '*');
  } catch {
    window.postMessage({ type: 'FOCUSTRACKER_DATA', data: null }, '*');
  }
});
