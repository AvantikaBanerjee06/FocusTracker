const DISPLAY_NAMES = {
  '127.0.0.1': 'Focus Timer',
  'localhost': 'Focus Timer',
};

function displayName(host) {
  return DISPLAY_NAMES[host] || host;
}

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// Mirrors background.js isApproved — must stay in sync.
function isApprovedHost(hostname) {
  return approvedSites.some(site => hostname === site || hostname.endsWith('.' + site));
}

function calcFocusScore(tabTime, switchCount) {
  const entries = Object.entries(tabTime || {});
  const hasData = entries.length > 0 || switchCount > 0;
  if (!hasData) return null;

  const totalSecs = entries.reduce((sum, [, s]) => sum + s, 0);
  const totalMins = Math.max(totalSecs / 60, 1);
  const switchRate = (switchCount || 0) / totalMins;

  if (approvedSites.length === 0) {
    // No approved sites defined: pure switch-rate penalty (original behaviour).
    return Math.max(0, Math.round(100 - switchRate * 50));
  }

  // Approved sites defined: score = fraction of time on approved sites,
  // minus a penalty for frequent switches to distracting sites.
  const approvedSecs = entries
    .filter(([host]) => isApprovedHost(host))
    .reduce((sum, [, s]) => sum + s, 0);

  const focusBase = totalSecs > 0 ? (approvedSecs / totalSecs) * 100 : 100;
  const switchPenalty = Math.min(30, switchRate * 15);
  return Math.max(0, Math.round(focusBase - switchPenalty));
}

function renderScore(tabTime, switchCount) {
  const score = calcFocusScore(tabTime, switchCount);

  const scoreEl = document.getElementById("score-display");
  const gradeEl = document.getElementById("score-grade");
  const fillEl = document.getElementById("score-fill");

  if (score === null) {
    scoreEl.textContent = "--";
    scoreEl.style.color = "#444";
    gradeEl.textContent = "";
    fillEl.style.width = "0%";
    fillEl.style.background = "#333";
    return;
  }

  let color, grade;
  if (score >= 80) {
    color = "#22c55e"; grade = "Excellent";
  } else if (score >= 60) {
    color = "#84cc16"; grade = "Good";
  } else if (score >= 40) {
    color = "#f59e0b"; grade = "Fair";
  } else {
    color = "#ef4444"; grade = "Poor";
  }

  scoreEl.textContent = score;
  scoreEl.style.color = color;
  gradeEl.textContent = grade;
  gradeEl.style.color = color;
  fillEl.style.width = `${score}%`;
  fillEl.style.background = color;
}

function render({ tabTime, idleTime, switchCount }) {
  document.getElementById("idle-display").textContent = formatTime(idleTime || 0);
  renderScore(tabTime, switchCount);

  const list = document.getElementById("tab-list");
  const entries = Object.entries(tabTime || {}).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    list.innerHTML = '<div class="empty">No tab activity yet.</div>';
    return;
  }

  const max = entries[0][1];
  list.innerHTML = entries.map(([host, secs]) => `
    <div class="tab-row">
      <div class="tab-info">
        <div class="tab-name" title="${host}">${displayName(host)}</div>
        <div class="tab-bar-track">
          <div class="tab-bar-fill" style="width: ${Math.round((secs / max) * 100)}%"></div>
        </div>
      </div>
      <div class="tab-time">${formatTime(secs)}</div>
    </div>
  `).join("");
}

function load() {
  chrome.runtime.sendMessage({ type: "GET_STATS" }, (response) => {
    if (chrome.runtime.lastError) return;
    render(response);
  });
}

document.getElementById("clear-btn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "CLEAR_STATS" }, () => {
    render({ tabTime: {}, idleTime: 0, switchCount: 0 });
  });
});

load();
setInterval(load, 2000);

// ── Approved Sites ──────────────────────────────────────────────────────────

let approvedSites = [];

function normalizeDomain(raw) {
  return raw.trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
}

async function loadApprovedSites() {
  const data = await chrome.storage.local.get(['approvedSites']);
  if (data.approvedSites === undefined) {
    // First run: seed the pomodoro timer's local origin as approved.
    approvedSites = ['localhost', '127.0.0.1'];
    chrome.storage.local.set({ approvedSites });
  } else {
    approvedSites = data.approvedSites;
  }
  renderApprovedList();
}

function persistAndRender() {
  chrome.storage.local.set({ approvedSites });
  renderApprovedList();
  load(); // recompute score immediately with updated approved list
}

function renderApprovedList() {
  document.getElementById('approved-badge').textContent = approvedSites.length;

  const list = document.getElementById('approved-list');
  list.innerHTML = '';

  if (approvedSites.length === 0) {
    const el = document.createElement('div');
    el.className = 'approved-empty';
    el.textContent = 'No approved sites added yet.';
    list.appendChild(el);
    return;
  }

  approvedSites.forEach(site => {
    const row = document.createElement('div');
    row.className = 'approved-item';

    const label = document.createElement('span');
    label.className = 'approved-domain';
    label.textContent = site;

    const btn = document.createElement('button');
    btn.className = 'approved-remove';
    btn.textContent = '×';
    btn.title = 'Remove';
    btn.addEventListener('click', () => {
      approvedSites = approvedSites.filter(s => s !== site);
      persistAndRender();
    });

    row.appendChild(label);
    row.appendChild(btn);
    list.appendChild(row);
  });
}

function addApprovedSite() {
  const input = document.getElementById('approved-input');
  const domain = normalizeDomain(input.value);
  if (!domain || !domain.includes('.')) return;
  if (!approvedSites.includes(domain)) {
    approvedSites.push(domain);
    persistAndRender();
  }
  input.value = '';
}

document.getElementById('approved-toggle').addEventListener('click', () => {
  const body = document.getElementById('approved-body');
  const arrow = document.getElementById('approved-arrow');
  const opening = body.hidden;
  body.hidden = !opening;
  arrow.style.transform = opening ? 'rotate(90deg)' : '';
});

document.getElementById('approved-add').addEventListener('click', addApprovedSite);
document.getElementById('approved-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addApprovedSite();
});

loadApprovedSites();
