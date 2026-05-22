# FocusTracker

A browser-based productivity system combining a Pomodoro timer with a Chrome extension that tracks where your time actually goes — and turns it into an actionable focus score.

---

## The Problem

Most productivity apps tell you to focus, but none of them tell you whether you did. You finish a work session unsure if you were genuinely productive or just busy. FocusTracker closes that loop: it passively monitors your tab activity, quantifies your focus, and surfaces it in a clean dashboard so you can see — not just feel — how your day went.

---

## What It Does

### Pomodoro Timer (Web App)
- 20-minute focus sessions with automatic short (5 min) and long (20 min) breaks
- Pomodoro cycle tracker with visual progress dots
- Ambient soundscapes per theme (cafe, library, forest, ocean)
- Sound toggle with persistent mute state

### Chrome Extension
- Tracks time spent on each tab by hostname
- Detects and logs idle time (30-second threshold)
- Counts tab switches to non-approved sites
- Computes a real-time **Focus Score** (0–100) based on time on approved sites and switch frequency
- Approved Sites list — whitelist domains that won't penalize your score
- All data stays on your device (no servers, no accounts)

### Dashboard (Web App)
- **Focus Score over time** — line chart across Today / This Week / This Month
- **Time Per Site** — doughnut chart of your top 7 sites
- **Focus vs Distraction** — split between approved and unapproved time, plus idle
- **Peak Focus Hours** — bar chart of average focus score by hour of day
- Auto-refreshes every 10 seconds while open
- Extension data bridged to the web app via `postMessage`

### Home View
- Personalized greeting based on time of day
- Today's focus score and focus/distraction time at a glance
- Integrated task list with drag-to-reorder, check-off, and delete
- Tasks persist in `localStorage`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web App | Vanilla HTML/CSS/JS (single-file, no build step) |
| Charts | Chart.js (CDN) |
| Typography | Playfair Display + Lato (Google Fonts) |
| Chrome Extension | Manifest V3, Service Worker |
| Extension APIs | `chrome.tabs`, `chrome.idle`, `chrome.storage`, `chrome.alarms` |
| Data Storage | `chrome.storage.local` (extension), `localStorage` (tasks) |
| Ambient Audio | Freesound CDN (streamed, no local files) |
| PWA | Service Worker (`sw.js`) for offline support |

---

## Installation

### Web App

No build step required. Open `index.html` directly in your browser, or serve it locally:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .
```

Then navigate to `http://localhost:8080`.

### Chrome Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder inside this repo
5. The FocusTracker icon will appear in your toolbar

To connect extension data to the web app dashboard, open the web app from a local server (e.g. `http://localhost:8080`) while the extension is active. The extension injects a content script that bridges data via `postMessage`.

---

## Usage

### Timer
1. Open the web app and click **Timer** in the nav bar
2. Select a theme from the bottom switcher (Cafe, Library, Forest, Ocean)
3. Hit **Start** — ambient sound begins and the 20-minute countdown runs
4. After 4 focus sessions, a long break is triggered automatically
5. Toggle sound with the 🔊 button on the timer card

### Focus Tracking
1. Install the extension (see above)
2. Browse normally — the extension tracks tab time and idle silently
3. Click the extension icon to see your live Focus Score and per-site breakdown
4. Add domains to **Approved Sites** to protect your score for work-related browsing
5. Hit **Clear** in the popup to reset the day's stats

### Dashboard
1. Click **Dashboard** in the nav bar
2. Use the **Today / This Week / This Month** toggles to change the date range
3. Charts update automatically every 10 seconds

### Tasks
1. From the **Home** view, type a task and press **Add** or **Enter**
2. Click the circle to mark a task complete
3. Drag the `⋮⋮` handle to reorder
4. Click **Clear completed** to remove finished tasks

---

## Project Structure

```
FocusTracker/
├── index.html          # Web app (timer + dashboard + home + tasks)
├── timer.js            # Pomodoro logic, themes, ambient audio
├── sw.js               # Service worker for PWA/offline
└── extension/
    ├── manifest.json   # Chrome extension manifest (MV3)
    ├── background.js   # Service worker: tab tracking, idle, snapshots
    ├── content.js      # postMessage bridge to web app
    ├── popup.html      # Extension popup UI
    └── popup.js        # Popup logic: score, approved sites, stats display
```

---

## Screenshots

> Add screenshots here — suggested views to capture:

| View | Description |
|---|---|
| `screenshot-home.png` | Home view with focus score and task list |
| `screenshot-timer-cafe.png` | Timer in Cafe theme |
| `screenshot-timer-ocean.png` | Timer in Ocean theme |
| `screenshot-dashboard.png` | Dashboard with all four charts |
| `screenshot-extension.png` | Extension popup with focus score and approved sites |

To add a screenshot, drop the image into a `/screenshots` folder and update the table above with `![alt](screenshots/filename.png)`.

---

## Privacy

All tracking data is stored locally using `chrome.storage.local` and `localStorage`. No data is sent to any server. Clearing the extension popup resets all stats.

---

## License

MIT
