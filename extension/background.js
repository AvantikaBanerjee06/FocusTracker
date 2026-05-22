const IDLE_THRESHOLD_SECONDS = 30;

let activeTabId = null;
let activeTabUrl = null;
let sessionStart = null;
let isIdle = false;
let idleStart = null;
let initialized = false;
let switchCount = 0;

function getHostname(url) {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

function isApproved(hostname, approvedSites) {
  return approvedSites.some(site => hostname === site || hostname.endsWith('.' + site));
}

async function saveSnapshot() {
  const now = Date.now();
  const hour = new Date(now).getHours();
  const data = await chrome.storage.local.get(['tabTime', 'switchCount', 'approvedSites', 'snapshots']);

  const tabTime = { ...(data.tabTime || {}) };
  if (activeTabId !== null && sessionStart !== null && !isIdle) {
    const elapsed = Math.round((now - sessionStart) / 1000);
    if (elapsed > 0) {
      const key = activeTabUrl ? getHostname(activeTabUrl) : 'unknown';
      tabTime[key] = (tabTime[key] || 0) + elapsed;
    }
  }

  const entries = Object.entries(tabTime);
  const totalSecs = entries.reduce((s, [, v]) => s + v, 0);
  const totalMins = Math.max(totalSecs / 60, 1);
  const sc = data.switchCount || 0;
  const rate = sc / totalMins;
  const approvedSites = data.approvedSites || [];

  let score;
  if (approvedSites.length === 0) {
    score = Math.max(0, Math.round(100 - rate * 50));
  } else {
    const approvedSecs = entries
      .filter(([h]) => isApproved(h, approvedSites))
      .reduce((s, [, v]) => s + v, 0);
    const base = totalSecs > 0 ? (approvedSecs / totalSecs) * 100 : 100;
    score = Math.max(0, Math.round(base - Math.min(30, rate * 15)));
  }

  const cutoff = now - 48 * 3600 * 1000;
  const snapshots = (data.snapshots || []).filter(s => s.ts > cutoff);
  snapshots.push({ ts: now, score, hour });
  await chrome.storage.local.set({ snapshots });
}

// Create the alarm once; it persists across service-worker restarts.
chrome.alarms.get('snapshot', alarm => {
  if (!alarm) chrome.alarms.create('snapshot', { periodInMinutes: 30 });
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'snapshot') saveSnapshot();
});

// MV3 service workers are killed after ~5s of inactivity and all vars reset.
// On each wake, re-derive the active tab so tracking resumes correctly.
async function ensureInit() {
  if (initialized) return;
  initialized = true;

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) {
    activeTabId = tab.id ?? null;
    activeTabUrl = tab.url || null;
    sessionStart = Date.now();
  }

  const stored = await chrome.storage.local.get(["switchCount"]);
  switchCount = stored.switchCount || 0;
}

async function flushActiveTab(endTime) {
  if (activeTabId === null || sessionStart === null || isIdle) return;

  const elapsed = Math.round((endTime - sessionStart) / 1000);
  if (elapsed <= 0) return;

  const key = activeTabUrl ? getHostname(activeTabUrl) : "unknown";
  const data = await chrome.storage.local.get(["tabTime"]);
  const tabTime = data.tabTime || {};
  tabTime[key] = (tabTime[key] || 0) + elapsed;
  await chrome.storage.local.set({ tabTime });
}

async function flushIdleTime(endTime) {
  if (idleStart === null) return;

  const elapsed = Math.round((endTime - idleStart) / 1000);
  if (elapsed <= 0) return;

  const data = await chrome.storage.local.get(["idleTime"]);
  await chrome.storage.local.set({ idleTime: (data.idleTime || 0) + elapsed });
  idleStart = null;
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await ensureInit();
  const now = Date.now();
  await flushActiveTab(now);

  activeTabId = activeInfo.tabId;
  sessionStart = now;
  activeTabUrl = null;

  let newUrl = null;
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (activeTabId === activeInfo.tabId) {
      activeTabUrl = tab.url || null;
      newUrl = activeTabUrl;
    }
  } catch {
    // tab closed before we could read it
  }

  const hostname = newUrl ? getHostname(newUrl) : null;
  if (hostname) {
    const stored = await chrome.storage.local.get(['approvedSites']);
    const approvedSites = stored.approvedSites || [];
    if (!isApproved(hostname, approvedSites)) {
      switchCount += 1;
      await chrome.storage.local.set({ switchCount });
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await ensureInit();
  if (tabId !== activeTabId || changeInfo.status !== "complete") return;

  const now = Date.now();
  await flushActiveTab(now);

  activeTabUrl = tab.url || null;
  sessionStart = now;
});

chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);

chrome.idle.onStateChanged.addListener(async (newState) => {
  await ensureInit();
  const now = Date.now();

  if (newState === "idle" || newState === "locked") {
    await flushActiveTab(now);
    sessionStart = null;
    isIdle = true;
    idleStart = now;
  } else if (newState === "active") {
    await flushIdleTime(now);
    isIdle = false;
    sessionStart = now;
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_STATS") {
    const now = Date.now();

    (async () => {
      await ensureInit();
      const data = await chrome.storage.local.get(["tabTime", "idleTime", "switchCount"]);
      const tabTime = { ...(data.tabTime || {}) };

      // Include time accrued since last flush for the current tab
      if (activeTabId !== null && sessionStart !== null && !isIdle) {
        const elapsed = Math.round((now - sessionStart) / 1000);
        if (elapsed > 0) {
          const key = activeTabUrl ? getHostname(activeTabUrl) : "unknown";
          tabTime[key] = (tabTime[key] || 0) + elapsed;
        }
      }

      const pendingIdle = isIdle && idleStart ? Math.round((now - idleStart) / 1000) : 0;
      const idleTime = (data.idleTime || 0) + pendingIdle;
      sendResponse({ tabTime, idleTime, switchCount: data.switchCount || 0 });
    })();

    return true; // keep message channel open for async response
  }

  if (message.type === "CLEAR_STATS") {
    (async () => {
      await chrome.storage.local.set({ tabTime: {}, idleTime: 0, switchCount: 0 });
      switchCount = 0;
      sessionStart = Date.now();
      idleStart = isIdle ? Date.now() : null;
      sendResponse({ ok: true });
    })();
    return true;
  }
});
