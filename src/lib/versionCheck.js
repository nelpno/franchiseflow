/**
 * Auto-detect new deployments and prompt user to refresh.
 * Checks /index.html every 5 min, compares script hash.
 */
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

let currentHash = null;

function extractScriptHash(html) {
  const match = html.match(/src="\/assets\/index-([a-zA-Z0-9_-]+)\.js"/);
  return match ? match[1] : null;
}

function getInitialHash() {
  const script = document.querySelector('script[src*="/assets/index-"]');
  if (script) {
    const match = script.src.match(/index-([a-zA-Z0-9_-]+)\.js/);
    return match ? match[1] : null;
  }
  return null;
}

export function startVersionCheck(onNewVersion) {
  currentHash = getInitialHash();
  if (!currentHash) return () => {};

  const check = async () => {
    try {
      const res = await fetch('/index.html?_v=' + Date.now(), {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache' },
      });
      if (!res.ok) return;
      const html = await res.text();
      const newHash = extractScriptHash(html);
      if (newHash && newHash !== currentHash) {
        onNewVersion();
        currentHash = newHash; // Don't spam
      }
    } catch { /* network error — ignore */ }
  };

  const intervalId = setInterval(check, CHECK_INTERVAL);
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      setTimeout(check, 2000);
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  // Cleanup function
  return () => {
    clearInterval(intervalId);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
