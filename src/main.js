/**
 * main.js — Entry point. Wires everything together.
 */
import './style.css'
import { CONFIG }          from './config.js'
import { initStream, setStreamOnline } from './stream.js'
import { initFlyingWizards } from './effects.js'
import { initVisualizer, getAudioLevels }  from './visualizer.js'

// Asset imports — Vite resolves these to correct URLs automatically
import wizardDanceSvg from './assets/wizard-dance.svg'
import faviconImg from './assets/favicon.png'

// WebP animated image URLs — eagerly resolved at build time (just URL strings)
const webpUrls = import.meta.glob('./assets/*.webp', { eager: true, query: '?url', import: 'default' })

// Build sprite pool: each entry is a URL string (animated WebP or SVG)
const SPRITE_POOL = [
  wizardDanceSvg,
  ...Object.values(webpUrls),
]

/** Pick a random sprite entry from the pool */
function randomSprite() {
  return SPRITE_POOL[Math.floor(Math.random() * SPRITE_POOL.length)]
}

document.addEventListener('DOMContentLoaded', () => {
  // Set image sources from Vite-resolved asset imports
  const loadingWizard = document.getElementById('loading-wizard')
  if (loadingWizard) loadingWizard.src = wizardDanceSvg
  const faviconEl = document.getElementById('favicon')
  if (faviconEl) faviconEl.href = faviconImg

  // ── Offline placeholder: show random sprite instead of text ────────
  const offlineEl = document.getElementById('stream-offline')
  if (offlineEl) {
    const sprite = randomSprite()
    offlineEl.innerHTML = ''
    // All sprites are URL strings now (animated WebP or SVG)
    const offImg = document.createElement('img')
    offImg.src = sprite
    offImg.className = 'offline-sprite'
    offImg.alt = ''
    offlineEl.appendChild(offImg)
    const offText = document.createElement('p')
    offText.className = 'offline-text'
    offText.textContent = 'SIGNAL LOST'
    offlineEl.appendChild(offText)
  }

  // Dismiss loading screen after a minimum display time
  const MIN_LOAD_MS = 2000
  const start = performance.now()
  const barFill = document.getElementById('loading-bar-fill')
  const pctEl = document.getElementById('loading-pct')
  let pct = 0

  // Animate progress bar — ramps up to 90% quickly, then waits for real load
  const tick = setInterval(() => {
    // Ease toward 90 while waiting
    const target = document.readyState === 'complete' ? 100 : 90
    pct += (target - pct) * 0.08
    pct = Math.min(pct, target)
    if (barFill) barFill.style.width = pct + '%'
    if (pctEl) pctEl.textContent = Math.round(pct) + '%'
    if (pct >= 99.5) {
      clearInterval(tick)
      if (barFill) barFill.style.width = '100%'
      if (pctEl) pctEl.textContent = '100%'
    }
  }, 50)

  window.addEventListener('load', () => {
    const elapsed = performance.now() - start
    const remaining = Math.max(0, MIN_LOAD_MS - elapsed)
    // Let the bar finish
    setTimeout(() => {
      clearInterval(tick)
      if (barFill) barFill.style.width = '100%'
      if (pctEl) pctEl.textContent = '100%'
      // Brief pause at 100% before fading
      setTimeout(() => {
        const screen = document.getElementById('loading-screen')
        if (screen) {
          screen.classList.add('fade-out')
          screen.addEventListener('transitionend', () => screen.remove())
        }
      }, 300)
    }, remaining)
  })



  // ── Fullscreen button ──────────────────────────────────────────────
  const fsBtn = document.getElementById('btn-fullscreen')
  const exitFsBtn = document.getElementById('btn-exit-fullscreen')
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {})
      } else {
        document.exitFullscreen()
      }
    })
    document.addEventListener('fullscreenchange', () => {
      fsBtn.textContent = document.fullscreenElement ? '⊡ EXIT FS' : '⊞ FULLSCREEN'
      // Hide visualizer in fullscreen (unless screensaver is active)
      const vizCanvas = document.getElementById('visualizer-canvas')
      if (vizCanvas) {
        vizCanvas.style.display = (document.fullscreenElement && !screensaverActive) ? 'none' : ''
      }
    })
  }
  if (exitFsBtn) {
    exitFsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen()
    })
  }

  // ── Screensaver mode ───────────────────────────────────────────────
  const ssBtn = document.getElementById('btn-screensaver')
  const app = document.getElementById('app')
  const ssOverlay = document.getElementById('screensaver-overlay')
  let screensaverActive = false

  if (ssBtn && ssOverlay) {
    ssBtn.addEventListener('click', () => {
      screensaverActive = !screensaverActive
      if (screensaverActive) {
        app.classList.add('screensaver-active')
        ssOverlay.classList.add('active')
        ssBtn.textContent = '✕ EXIT SS'
        // Auto-enable visualizer for screensaver
        enableViz()
        // Enter fullscreen when screensaver activates
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {})
        }
      } else {
        exitScreensaver()
      }
    })

    ssOverlay.addEventListener('click', exitScreensaver)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && screensaverActive) exitScreensaver()
    })
  }

  function exitScreensaver() {
    screensaverActive = false
    app.classList.remove('screensaver-active')
    ssOverlay.classList.remove('active')
    ssBtn.textContent = '◈ SCREENSAVER'
    // Exit fullscreen when screensaver deactivates
    if (document.fullscreenElement) {
      document.exitFullscreen()
    }
  }

  // Default to online mode — show the player immediately
  const offlineBanner = document.getElementById('stream-offline')
  if (offlineBanner) offlineBanner.style.display = 'none'
  const videoEl = document.getElementById('owncast-video')
  if (videoEl) videoEl.style.display = ''

  // Attempt to connect HLS immediately — if the stream is already live the
  // MANIFEST_PARSED handler will flip the UI to live without waiting for the
  // API poll (which may fail due to CORS / network issues).
  initStream()

  // Audio frequency visualizer (default off — toggled via footer button)
  // IMPORTANT: Don't connect audio until user explicitly enables the visualizer.
  // createMediaElementSource() takes exclusive control of the video’s audio
  // pipeline and can break HLS playback if CORS isn’t perfectly configured.
  const video = document.getElementById('owncast-video')
  const vizCanvas = document.getElementById('visualizer-canvas')
  if (vizCanvas) vizCanvas.style.display = 'none'
  let vizInitialised = false

  // ── Visualizer toggle button ───────────────────────────────────
  const vizBtn = document.getElementById('btn-visualizer')
  let vizActive = false

  function enableViz() {
    if (vizActive) return
    vizActive = true
    if (vizCanvas) vizCanvas.style.display = ''
    if (vizBtn) vizBtn.textContent = '♫ HIDE VIZ'
    // Lazy-init: only connect Web Audio on first enable
    if (!vizInitialised && video) {
      initVisualizer(video)
      vizInitialised = true
    }
  }

  function disableViz() {
    if (!vizActive) return
    vizActive = false
    if (vizCanvas) vizCanvas.style.display = 'none'
    if (vizBtn) vizBtn.textContent = '♫ VISUALIZER'
  }

  if (vizBtn && vizCanvas) {
    vizBtn.addEventListener('click', () => {
      if (vizActive) disableViz()
      else enableViz()
    })
  }

  // Flying wizard screensaver — full sprite pool (audio-reactive)
  initFlyingWizards(SPRITE_POOL, getAudioLevels)

  // ── Stream Status Polling (live badge + viewer count) ───────────
  pollStreamStatus()
  setInterval(pollStreamStatus, 5000)
})

// ── Stream Status ─────────────────────────────────────────────────────────────
async function pollStreamStatus() {
  const countEl = document.getElementById('viewer-count')

  try {
    const res = await fetch(CONFIG.owncastUrl.replace(/\/+$/, '') + '/api/status')
    if (!res.ok) throw new Error('non-200')
    const data = await res.json()

    // Viewer count
    if (countEl) {
      const count = data.viewerCount ?? 0
      countEl.textContent = `👁 ${count}`
      countEl.title = `${count} viewer${count !== 1 ? 's' : ''}`
    }
  } catch (_) {
    // API unreachable (CORS, network, etc.) — badge is managed by stream.js
  }

  // Always attempt to start HLS; setStreamOnline() is idempotent
  setStreamOnline()
}
