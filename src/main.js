/**
 * main.js — Entry point. Wires everything together.
 */
import './style.css'
import { CONFIG }          from './config.js'
import { initStream, reconnectStream, disconnectStream } from './stream.js'
import { initVhsGlitch, initFlyingWizards } from './effects.js'
import { initVisualizer, getAudioLevels }  from './visualizer.js'

// Asset imports — Vite resolves these to correct URLs automatically
import wizardDance from './assets/wizard-dance.gif'
import wizardDanceSvg from './assets/wizard-dance.svg'
import faviconImg from './assets/favicon.png'

// WebP sprite sheet URLs — eagerly resolved at build time (just URL strings)
const webpUrls = import.meta.glob('./assets/*.webp', { eager: true, query: '?url', import: 'default' })

// Build sprite pool: each WebP is a 16-frame vertical sprite sheet
const FRAMES = 16
const SPRITE_POOL = [
  wizardDanceSvg, // animated SVG — single-frame string
  ...Object.values(webpUrls).map(url => ({ url, frames: FRAMES })),
]

/** Pick a random sprite entry from the pool */
function randomSprite() {
  return SPRITE_POOL[Math.floor(Math.random() * SPRITE_POOL.length)]
}

document.addEventListener('DOMContentLoaded', () => {
  // Set image sources from Vite-resolved asset imports
  const loadingWizard = document.getElementById('loading-wizard')
  if (loadingWizard) loadingWizard.src = wizardDanceSvg
  const danceEl = document.getElementById('footer-wizard')
  if (danceEl) danceEl.src = wizardDance
  const faviconEl = document.getElementById('favicon')
  if (faviconEl) faviconEl.href = faviconImg

  // ── Offline placeholder: show random sprite instead of text ────────
  const offlineEl = document.getElementById('stream-offline')
  if (offlineEl) {
    const sprite = randomSprite()
    offlineEl.innerHTML = ''
    if (typeof sprite === 'string') {
      const offImg = document.createElement('img')
      offImg.src = sprite
      offImg.className = 'offline-sprite'
      offImg.alt = ''
      offlineEl.appendChild(offImg)
    } else {
      const offDiv = document.createElement('div')
      offDiv.className = 'offline-sprite offline-sprite-sheet'
      offDiv.style.backgroundImage = `url(${sprite.url})`
      offlineEl.appendChild(offDiv)
    }
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
  }

  // Stream player
  initStream()

  // Audio frequency visualizer
  const video = document.getElementById('owncast-video')
  if (video) initVisualizer(video)

  // VHS glitch on stream wrapper (audio-reactive)
  initVhsGlitch(getAudioLevels)

  // Flying wizard screensaver — full sprite pool (audio-reactive)
  initFlyingWizards(SPRITE_POOL, getAudioLevels)

  // ── Stream Status Polling (live badge + viewer count) ───────────
  pollStreamStatus()
  setInterval(pollStreamStatus, 10000)
})

// ── Stream Status ─────────────────────────────────────────────────────────────
let lastOnline = null // track state transitions so we only reconnect/disconnect once

async function pollStreamStatus() {
  const countEl = document.getElementById('viewer-count')
  const badge   = document.getElementById('live-badge')
  try {
    const res = await fetch(CONFIG.owncastUrl.replace(/\/+$/, '') + '/api/status')
    if (!res.ok) return
    const data = await res.json()

    // Viewer count
    if (countEl) {
      const count = data.viewerCount ?? 0
      countEl.textContent = `👁 ${count}`
      countEl.title = `${count} viewer${count !== 1 ? 's' : ''}`
    }

    // Live / Offline badge + player state
    if (badge) {
      if (data.online) {
        badge.textContent = '● LIVE'
        badge.setAttribute('aria-label', 'Stream status: live')
        badge.classList.remove('live-badge--offline')
        badge.classList.add('live-badge--live')
        if (lastOnline === false) reconnectStream()
      } else {
        badge.textContent = '● OFFLINE'
        badge.setAttribute('aria-label', 'Stream status: offline')
        badge.classList.remove('live-badge--live')
        badge.classList.add('live-badge--offline')
        if (lastOnline === true) disconnectStream()
      }
      lastOnline = data.online
    }
  } catch (_) {
    // Network error — leave UI as-is
  }
}
