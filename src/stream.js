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
      showLiveBadge()
      video.play().catch(() => {
        // Autoplay blocked — user must click play manually; that's fine
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
  // Update LIVE badge to offline
  const badge = document.getElementById('live-badge')
  if (badge) {
    badge.textContent = '● OFFLINE'
    badge.setAttribute('aria-label', 'Stream status: offline')
    badge.classList.remove('live-badge--live')
    badge.classList.add('live-badge--offline')
  }
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

