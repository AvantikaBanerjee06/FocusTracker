// ── Durations ──────────────────────────────────────────────
const DURATIONS = {
  focus:         20,
  'short-break':  5 * 60,
  'long-break':  20 * 60,
}

const MODE_LABELS = {
  focus:         'Focus',
  'short-break': 'Short Break',
  'long-break':  'Long Break',
}

// ── State ──────────────────────────────────────────────────
let timerInterval    = null
let mode             = 'focus'
let seconds          = DURATIONS.focus
let completedInCycle = 0   // focus sessions completed in the current cycle (0–3)

// ── Themes ─────────────────────────────────────────────────
const themes = {
  cafe: {
    audio:    'https://cdn.freesound.org/previews/421/421647_8224400-lq.mp3',
    subtitle: 'stay present, one cup at a time',
  },
  library: {
    audio:    'https://cdn.freesound.org/previews/594/594048_12675537-lq.mp3',
    subtitle: 'silence is the sound of focus',
  },
  forest: {
    audio:    'https://cdn.freesound.org/previews/723/723913_2008500-lq.mp3',
    subtitle: 'breathe in, breathe out, focus',
  },
  ocean: {
    audio:    'https://cdn.freesound.org/previews/586/586117_29508-lq.mp3',
    subtitle: 'steady as the tide',
  },
}

const ambientAudio  = new Audio()
ambientAudio.loop   = true
ambientAudio.volume = 0.35

let currentTheme   = 'cafe'
ambientAudio.src   = themes[currentTheme].audio

// ── Notifications ──────────────────────────────────────────
let swRegistration = null

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => { swRegistration = reg })
    .catch(() => {})
}

function updateNotifBanner() {
  const banner = document.getElementById('notifBanner')
  if (!('Notification' in window) || Notification.permission === 'granted') {
    banner.style.display = 'none'
  } else {
    banner.style.display = 'block'
  }
}

function requestNotificationPermission() {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') return
  Notification.requestPermission().then(updateNotifBanner)
}

function beep() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = 880
  gain.gain.setValueAtTime(0.3, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.6)
}

function sendNotification(title, body) {
  beep()
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const opts = { body, requireInteraction: true }
  if (swRegistration) {
    swRegistration.showNotification(title, opts)
  } else {
    new Notification(title, opts)
  }
}

// ── Display ────────────────────────────────────────────────
function updateDisplay() {
  const m   = Math.floor(seconds / 60)
  const s   = seconds % 60
  const str = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
  document.getElementById('timer').textContent = str
  document.title = str + ' — ' + MODE_LABELS[mode] + ' | Focus Timer'
}

function updateModeLabel(newMode) {
  const el = document.getElementById('modeLabel')
  el.classList.add('fading')
  setTimeout(() => {
    el.textContent = MODE_LABELS[newMode]
    el.classList.remove('fading')
  }, 200)
}

function updateDots() {
  document.querySelectorAll('.dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < completedInCycle)
  })
}

function pulseDot(index) {
  const dot = document.querySelector(`.dot[data-index="${index}"]`)
  if (!dot) return
  dot.classList.add('pulse')
  setTimeout(() => dot.classList.remove('pulse'), 300)
}

// ── Mode switching ─────────────────────────────────────────
function switchMode(newMode) {
  mode    = newMode
  seconds = DURATIONS[newMode]
  updateModeLabel(newMode)
  updateDisplay()
}

// ── Timer core ─────────────────────────────────────────────
function tick() {
  seconds--
  updateDisplay()
  if (seconds === 0) onTimerEnd()
}

function onTimerEnd() {
  clearInterval(timerInterval)
  timerInterval = null

  if (mode === 'focus') {
    completedInCycle++
    pulseDot(completedInCycle - 1)
    updateDots()

    if (completedInCycle >= 4) {
      sendNotification(
        'All 4 Pomodoros done!',
        'Time for a long break. Step away and recharge.'
      )
      completedInCycle = 0
      updateDots()
      switchMode('long-break')
    } else {
      sendNotification(
        'Focus session complete!',
        'Time for a short break. You earned it.'
      )
      switchMode('short-break')
    }
    // Auto-start the break; ambient audio keeps playing
    timerInterval = setInterval(tick, 1000)

  } else {
    // Break ended — notify and ready the focus timer, but don't auto-start
    sendNotification(
      "Break's over!",
      "Ready to focus again? Hit start when you're ready."
    )
    ambientAudio.pause()
    switchMode('focus')
  }
}

function startTimer() {
  if (timerInterval !== null) return
  requestNotificationPermission()
  ambientAudio.play().catch(() => {})
  timerInterval = setInterval(tick, 1000)
}

function stopTimer() {
  clearInterval(timerInterval)
  timerInterval = null
  ambientAudio.pause()
}

function resetTimer() {
  stopTimer()
  mode             = 'focus'
  seconds          = DURATIONS.focus
  completedInCycle = 0
  updateDisplay()
  updateModeLabel('focus')
  updateDots()
  document.title = 'Focus Timer'
}

// ── Theme ──────────────────────────────────────────────────
function setTheme(name) {
  currentTheme = name
  document.body.className = 'theme-' + name

  const subtitleEl = document.getElementById('subtitle')
  subtitleEl.classList.add('fading')
  setTimeout(() => {
    subtitleEl.textContent = themes[name].subtitle
    subtitleEl.classList.remove('fading')
  }, 250)

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === name)
  })

  const isRunning = timerInterval !== null
  ambientAudio.pause()
  ambientAudio.src = themes[name].audio
  if (isRunning) {
    ambientAudio.play().catch(() => {})
  }
}

// ── Event listeners ────────────────────────────────────────
document.getElementById('notifBtn').addEventListener('click', requestNotificationPermission)
updateNotifBanner()

document.getElementById('startBtn').addEventListener('click', startTimer)
document.getElementById('stopBtn').addEventListener('click', stopTimer)
document.getElementById('resetBtn').addEventListener('click', resetTimer)

document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => setTheme(btn.dataset.theme))
})
