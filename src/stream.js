/**
 * stream.js — HLS.js Owncast player.
 *
 * Two states: online or offline.
 *   setStreamOnline()  — idempotent, starts HLS if not already running.
 *   setStreamOffline() — idempotent, tears down HLS if running.
 */
import Hls from 'hls.js'
import { CONFIG } from './config.js'

let hlsInstance = null
let hlsNetworkRetries = 0
const MAX_HLS_RETRIES = 3

export function initStream() {
  initHlsPlayer()
}

/**
 * Ensure the player is running. No-op if HLS is already active.
 */
export function setStreamOnline() {
  if (hlsInstance) return
  hlsNetworkRetries = 0
  const banner = document.getElementById('stream-offline')
  if (banner) banner.style.display = 'none'
  const video = document.getElementById('owncast-video')
  if (video) video.style.display = ''
  initHlsPlayer()
}

/**
 * Ensure the player is stopped and the offline banner is visible.
 */
export function setStreamOffline() {
  if (hlsInstance) {
    hlsInstance.destroy()
    hlsInstance = null
  }
  const banner = document.getElementById('stream-offline')
  if (banner) banner.style.display = 'flex'
  const video = document.getElementById('owncast-video')
  if (video) video.style.display = 'none'
}

// ── HLS Player ────────────────────────────────────────────────────────────────
function initHlsPlayer() {
  const video = document.getElementById('owncast-video')
  if (!video) return

  if (Hls.isSupported()) {
    hlsInstance = new Hls({
      enableWorker:     true,
      lowLatencyMode:   CONFIG.hlsLowLatencyMode,
      backBufferLength: CONFIG.hlsBackBufferLength,
    })
    hlsInstance.loadSource(CONFIG.owncastHlsUrl)
    hlsInstance.attachMedia(video)

    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      hlsNetworkRetries = 0
      // Ensure video is visible and offline banner is hidden
      const banner = document.getElementById('stream-offline')
      if (banner) banner.style.display = 'none'
      video.style.display = ''
      setBadgeLive(true)
      // Try unmuted autoplay first; fall back to muted if the browser blocks it.
      video.muted = false
      video.play()
        .catch(() => {
          // Unmuted autoplay blocked — fall back to muted autoplay
          video.muted = true
          video.play().catch(() => {})
        })
    })

    hlsInstance.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hlsNetworkRetries++
            if (hlsNetworkRetries <= MAX_HLS_RETRIES) {
              hlsInstance.startLoad()
            } else {
              hlsInstance.destroy()
              hlsInstance = null
              showOfflineBanner()
            }
            break
          case Hls.ErrorTypes.MEDIA_ERROR:
            hlsInstance.recoverMediaError()
            break
          default:
            hlsInstance.destroy()
            hlsInstance = null
            showOfflineBanner()
        }
      }
    })
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Native HLS (Safari)
    video.src = CONFIG.owncastHlsUrl
    video.play().catch(() => {})
  } else {
    showOfflineBanner()
  }
}

function showOfflineBanner() {
  const banner = document.getElementById('stream-offline')
  if (banner) banner.style.display = 'flex'
  const video = document.getElementById('owncast-video')
  if (video)  video.style.display  = 'none'
  setBadgeLive(false)
}

function setBadgeLive(live) {
  const badge = document.getElementById('live-badge')
  if (!badge) return
  if (live) {
    badge.textContent = '● LIVE'
    badge.setAttribute('aria-label', 'Stream status: live')
    badge.classList.remove('live-badge--offline')
    badge.classList.add('live-badge--live')
  } else {
    badge.textContent = '● OFFLINE'
    badge.setAttribute('aria-label', 'Stream status: offline')
    badge.classList.remove('live-badge--live')
    badge.classList.add('live-badge--offline')
  }
}


