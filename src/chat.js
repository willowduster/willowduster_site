/**
 * chat.js — Owncast WebSocket chat + platform tab switching.
 */
import { CONFIG } from './config.js'

const MAX_MESSAGES = 200
let ws = null
let activeTab = 'all'

const PLATFORM_COLORS = {
  owncast:   '#00ff41',
  youtube:   '#ff0000',
  twitch:    '#9d00ff',
  system:    '#00ffff',
}

export function initChat() {
  setupChatTabs()
  connectOwncastWs()
  appendSystemMessage('SYSTEM ONLINE // Connecting to Owncast chat...')
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
function connectOwncastWs() {
  try {
    ws = new WebSocket(CONFIG.owncastWsUrl)

    ws.addEventListener('open', () => {
      appendSystemMessage(`CONNECTED // ${CONFIG.owncastWsUrl}`)
    })

    ws.addEventListener('message', event => {
      try {
        const data = JSON.parse(event.data)
        // Owncast sends type: "CHAT" messages
        if (data.type === 'CHAT') {
          appendChatMessage({
            platform:  'owncast',
            user:      data.user?.displayName || 'anon',
            text:      data.body || '',
            timestamp: data.timestamp || new Date().toISOString(),
          })
        }
      } catch (_) {
        // Non-JSON frames are ignored
      }
    })

    ws.addEventListener('close', () => {
      appendSystemMessage('CONNECTION LOST // Retrying in 10s...')
      setTimeout(connectOwncastWs, 10000)
    })

    ws.addEventListener('error', () => {
      appendSystemMessage('WS ERROR // Check owncastWsUrl in config.js')
    })
  } catch (err) {
    appendSystemMessage(`WS INIT ERROR // ${err.message}`)
  }
}

// ── Chat Tab Switching ────────────────────────────────────────────────────────
function setupChatTabs() {
  const tabs = document.querySelectorAll('.chat-tab-btn')
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'))
      btn.classList.add('active')
      activeTab = btn.dataset.tab
      updateChatPanels()
    })
  })
}

function updateChatPanels() {
  const allFeed  = document.getElementById('chat-feed-all')
  const ytFeed   = document.getElementById('chat-feed-youtube')
  const twFeed   = document.getElementById('chat-feed-twitch')

  // ALL tab: show the live message list
  if (allFeed)  allFeed.style.display  = activeTab === 'all'     ? 'flex'  : 'none'
  // YouTube tab: show YT live chat iframe
  if (ytFeed)   ytFeed.style.display   = activeTab === 'youtube' ? 'block' : 'none'
  // Twitch tab: show Twitch chat iframe
  if (twFeed)   twFeed.style.display   = activeTab === 'twitch'  ? 'block' : 'none'

  const owncastFeed = document.getElementById('chat-feed-owncast')
  if (owncastFeed) owncastFeed.style.display = activeTab === 'owncast' ? 'flex' : 'none'
}

// ── Message Helpers ───────────────────────────────────────────────────────────
export function appendChatMessage({ platform, user, text, timestamp }) {
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const color = PLATFORM_COLORS[platform] || '#ffffff'

  const msg = document.createElement('div')
  msg.className = 'chat-message'
  msg.dataset.platform = platform
  msg.innerHTML = `
    <span class="chat-badge" style="color:${color};border-color:${color};">${platform.toUpperCase()}</span>
    <span class="chat-time">${time}</span>
    <span class="chat-user" style="color:${color};">${escapeHtml(user)}</span>
    <span class="chat-sep">›</span>
    <span class="chat-text">${escapeHtml(text)}</span>
  `

  // Append to ALL feed
  const allFeed = document.getElementById('chat-messages-all')
  if (allFeed) {
    allFeed.appendChild(msg.cloneNode(true))
    trimMessages(allFeed)
    allFeed.scrollTop = allFeed.scrollHeight
  }

  // Append to platform-specific feed (owncast only — YT/Twitch use iframes)
  if (platform === 'owncast') {
    const owncastFeed = document.getElementById('chat-messages-owncast')
    if (owncastFeed) {
      owncastFeed.appendChild(msg)
      trimMessages(owncastFeed)
      owncastFeed.scrollTop = owncastFeed.scrollHeight
    }
  }
}

function appendSystemMessage(text) {
  appendChatMessage({ platform: 'system', user: 'SYS', text, timestamp: new Date().toISOString() })
}

function trimMessages(container) {
  while (container.children.length > MAX_MESSAGES) {
    container.removeChild(container.firstChild)
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
