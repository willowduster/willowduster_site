/**
 * stream.js — HLS.js Owncast player.
 */
import Hls from 'hls.js'
import { CONFIG } from './config.js'

let hlsInstance = null

export function initStream() {
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
      video.play().catch(() => {
        // Autoplay blocked — user must click play manually; that's fine
      })
    })

    hlsInstance.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hlsInstance.startLoad()
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
}

