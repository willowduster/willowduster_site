/**
 * stream.js — HLS.js Owncast player.
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
 * Tear down current HLS player, show the offline banner, hide video.
 * Called by pollStreamStatus when the API reports offline.
 */
export function disconnectStream() {
  if (hlsInstance) {
    hlsInstance.destroy()
    hlsInstance = null
  }
  const banner = document.getElementById('stream-offline')
  if (banner) banner.style.display = 'flex'
  const video = document.getElementById('owncast-video')
  if (video) video.style.display = 'none'
}

/**
 * Returns true when the HLS player has been torn down (e.g. after
 * network retries exhausted). Used by the poller so it can retry
 * even when lastOnline was already true.
 */
export function isStreamDisconnected() {
  return hlsInstance === null
}

/**
 * Tear down old HLS, hide offline banner, show video, re-init player.
 * Called by pollStreamStatus when the API reports online but the
 * player is currently showing the offline state.
 */
export function reconnectStream() {
  if (hlsInstance) {
    hlsInstance.destroy()
    hlsInstance = null
  }
  hlsNetworkRetries = 0
  const banner = document.getElementById('stream-offline')
  if (banner) banner.style.display = 'none'
  const video = document.getElementById('owncast-video')
  if (video) video.style.display = ''
  initHlsPlayer()
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
      // Ensure video is visible and offline banner is hidden even if
      // reconnectStream() was not the caller (e.g. initial load probe).
      const banner = document.getElementById('stream-offline')
      if (banner) banner.style.display = 'none'
      video.style.display = ''
      showLiveBadge()
      // Muted autoplay is reliable in all browsers; after play starts,
      // attempt to unmute so the user hears audio immediately.
      video.muted = true
      video.play()
        .then(() => {
          // Listen for browser pausing the video after unmute
          const onPause = () => {
            video.removeEventListener('pause', onPause)
            video.muted = true
            video.play().catch(() => {})
          }
          video.addEventListener('pause', onPause)
          video.muted = false
          // If the browser didn't pause synchronously, remove the listener
          // after a short window so normal user pauses aren't intercepted.
          setTimeout(() => video.removeEventListener('pause', onPause), 200)
        })
        .catch(() => {
          // Autoplay blocked even when muted — user must click play
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
}

function showLiveBadge() {
  const badge = document.getElementById('live-badge')
  if (badge) {
    badge.textContent = '● LIVE'
    badge.setAttribute('aria-label', 'Stream status: live')
    badge.classList.remove('live-badge--offline')
    badge.classList.add('live-badge--live')
  }
}

