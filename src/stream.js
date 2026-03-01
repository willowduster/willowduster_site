/**
 * stream.js — HLS.js Owncast player + YouTube/Twitch stream tab switching.
 */
import Hls from 'hls.js'
import { CONFIG } from './config.js'

let hlsInstance = null
let activeStream = 'owncast'

export function initStream() {
  setupStreamTabs()
  initHlsPlayer()
}

// ── HLS Player ────────────────────────────────────────────────────────────────
function initHlsPlayer() {
  const video = document.getElementById('owncast-video')
  if (!video) return

  if (Hls.isSupported()) {
    hlsInstance = new Hls({
      enableWorker:      true,
      lowLatencyMode:    true,
      backBufferLength:  30,
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

// ── Stream Tab Switching ──────────────────────────────────────────────────────
function setupStreamTabs() {
  const tabs = document.querySelectorAll('.stream-tab-btn')
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'))
      btn.classList.add('active')
      activeStream = btn.dataset.stream
      updateStreamPanels()
    })
  })
}

function updateStreamPanels() {
  const owncastPanel = document.getElementById('panel-owncast')
  const youtubePanel = document.getElementById('panel-youtube')
  const twitchPanel  = document.getElementById('panel-twitch')

  if (owncastPanel) owncastPanel.style.display = activeStream === 'owncast'  ? 'block' : 'none'
  if (youtubePanel) youtubePanel.style.display = activeStream === 'youtube'  ? 'block' : 'none'
  if (twitchPanel)  twitchPanel.style.display  = activeStream === 'twitch'   ? 'block' : 'none'
}
