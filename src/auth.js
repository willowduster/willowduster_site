/**
 * auth.js — OAuth login for Twitch, Google (YouTube), Instagram (Facebook), X (Twitter).
 *
 * Twitch & Google  → Implicit grant (token in URL hash)
 * Instagram        → Facebook Login JS SDK (implicit)
 * X (Twitter)      → OAuth 2.0 PKCE (code in query string)
 *
 * All flows redirect back to the site; on load we check for tokens/codes.
 */
import { CONFIG } from './config.js'

const STORAGE_KEY = 'wd_auth_user'

let currentUser = loadUser()

// ── Helpers ──────────────────────────────────────────────────────────────────

function redirectUri() {
  return CONFIG.oauthRedirectUri || window.location.origin + window.location.pathname
}

function saveUser(user) {
  currentUser = user
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user)) } catch (_) {}
}

function loadUser() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (_) { return null }
}

function clearUser() {
  currentUser = null
  try { sessionStorage.removeItem(STORAGE_KEY) } catch (_) {}
}

// ── Utilities ────────────────────────────────────────────────────────────────

function generateRandomString(len = 64) {
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('').slice(0, len)
}

// ── OAuth Redirect Launchers ─────────────────────────────────────────────────

function loginTwitch() {
  const { clientId, scopes } = CONFIG.oauth.twitch
  if (!clientId) return showConfigError('Twitch')
  const state = generateRandomString(32)
  sessionStorage.setItem('wd_oauth_state', state)
  sessionStorage.setItem('wd_oauth_platform', 'twitch')
  const url = 'https://id.twitch.tv/oauth2/authorize' +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri())}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${state}`
  window.location.href = url
}

function loginGoogle() {
  const { clientId, scopes } = CONFIG.oauth.google
  if (!clientId) return showConfigError('Google / YouTube')
  const state = generateRandomString(32)
  sessionStorage.setItem('wd_oauth_state', state)
  sessionStorage.setItem('wd_oauth_platform', 'google')
  const url = 'https://accounts.google.com/o/oauth2/v2/auth' +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri())}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${state}`
  window.location.href = url
}

const LAUNCHERS = { twitch: loginTwitch, youtube: loginGoogle }

// ── Callback Handlers ────────────────────────────────────────────────────────

async function handleOAuthCallback() {
  // Implicit grant → token is in hash
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  // PKCE → code is in query string
  const queryParams = new URLSearchParams(window.location.search)

  const accessToken = hashParams.get('access_token')
  const code        = queryParams.get('code')
  const state       = hashParams.get('state') || queryParams.get('state')
  const savedState  = sessionStorage.getItem('wd_oauth_state')
  const platform    = sessionStorage.getItem('wd_oauth_platform')

  if (!state || !savedState || state !== savedState) return  // no callback or state mismatch
  sessionStorage.removeItem('wd_oauth_state')
  sessionStorage.removeItem('wd_oauth_platform')

  // Clean the URL
  history.replaceState(null, '', window.location.pathname)

  try {
    if (platform === 'twitch' && accessToken) {
      await fetchTwitchUser(accessToken)
    } else if (platform === 'google' && accessToken) {
      await fetchGoogleUser(accessToken)
    }
  } catch (err) {
    console.error('[auth] callback error:', err)
    showError('Login failed. Please try again.')
  }
}

async function fetchTwitchUser(token) {
  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Client-Id': CONFIG.oauth.twitch.clientId,
    },
  })
  const { data } = await res.json()
  if (data?.[0]) {
    saveUser({ platform: 'twitch', displayName: data[0].display_name, avatar: data[0].profile_image_url, token })
    updateAuthUI()
  }
}

async function fetchGoogleUser(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  const info = await res.json()
  if (info?.name) {
    saveUser({ platform: 'youtube', displayName: info.name, avatar: info.picture, token })
    updateAuthUI()
  }
}

// ── Modal / Error UI ─────────────────────────────────────────────────────────

function showConfigError(name) {
  showModal(
    `<div class="modal-icon">⚠</div>
     <h3 class="modal-title">${name} NOT CONFIGURED</h3>
     <p class="modal-text">Add your OAuth client ID in<br><code>src/config.js</code> → <code>oauth</code> section.</p>`
  )
}

function showError(text) {
  showModal(
    `<div class="modal-icon">✕</div>
     <h3 class="modal-title">AUTH ERROR</h3>
     <p class="modal-text">${text}</p>`
  )
}

function showModal(html) {
  const modal = document.getElementById('auth-modal')
  const msg   = document.getElementById('modal-message')
  if (!modal || !msg) return
  msg.innerHTML = html
  modal.classList.add('active')
}

function closeModal() {
  document.getElementById('auth-modal')?.classList.remove('active')
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getUser() {
  return currentUser
}

export function updateAuthUI() {
  const loginPanel  = document.getElementById('login-panel')
  const userDisplay = document.getElementById('user-display')
  const chatInput   = document.getElementById('chat-input-row')
  const chatPrompt  = document.querySelector('.chat-login-prompt')

  if (currentUser) {
    if (loginPanel)  loginPanel.style.display  = 'none'
    if (userDisplay) {
      userDisplay.style.display = 'flex'
      const nameEl = document.getElementById('user-name')
      const avatarEl = document.getElementById('user-avatar')
      if (nameEl) nameEl.textContent = currentUser.displayName
      if (avatarEl && currentUser.avatar) {
        avatarEl.src = currentUser.avatar
        avatarEl.style.display = 'inline-block'
      }
    }
    if (chatInput)  chatInput.style.display  = 'flex'
    if (chatPrompt) chatPrompt.style.display = 'none'
  } else {
    if (loginPanel)  loginPanel.style.display  = 'flex'
    if (userDisplay) userDisplay.style.display = 'none'
    if (chatInput)  chatInput.style.display  = 'none'
    if (chatPrompt) chatPrompt.style.display = 'block'
  }
}

function logout() {
  clearUser()
  updateAuthUI()
}

export function initAuth() {
  // Wire up login buttons
  document.querySelectorAll('.social-login-btn').forEach(btn => {
    const fn = LAUNCHERS[btn.dataset.platform]
    if (fn) btn.addEventListener('click', fn)
  })

  // Modal close
  const modalClose = document.getElementById('modal-close')
  const modal      = document.getElementById('auth-modal')
  if (modalClose) modalClose.addEventListener('click', closeModal)
  if (modal)      modal.addEventListener('click', e => { if (e.target === modal) closeModal() })

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', logout)

  // Check for OAuth callback in URL
  handleOAuthCallback()

  // Restore session
  if (currentUser) updateAuthUI()
}
