/**
 * auth.js — Social login stubs (Twitch, YouTube, Instagram, X).
 * Real OAuth flows require server-side configuration.
 */

let currentUser = null

export function initAuth() {
  const loginBtns = document.querySelectorAll('.social-login-btn')
  loginBtns.forEach(btn => {
    btn.addEventListener('click', () => showLoginModal(btn.dataset.platform))
  })

  const modalClose = document.getElementById('modal-close')
  const modal      = document.getElementById('auth-modal')
  if (modalClose) modalClose.addEventListener('click', () => closeModal())
  if (modal)      modal.addEventListener('click', e => { if (e.target === modal) closeModal() })

  const logoutBtn = document.getElementById('logout-btn')
  if (logoutBtn) logoutBtn.addEventListener('click', logout)
}

function showLoginModal(platform) {
  const modal = document.getElementById('auth-modal')
  const msg   = document.getElementById('modal-message')
  if (!modal || !msg) return

  const names = { twitch: 'Twitch', youtube: 'YouTube', instagram: 'Instagram', x: 'X (Twitter)' }
  msg.innerHTML = `
    <div class="modal-icon">⚡</div>
    <h3 class="modal-title">${names[platform] || platform} LOGIN</h3>
    <p class="modal-text">Social login coming soon!<br>OAuth configuration required.</p>
    <p class="modal-sub">To enable ${names[platform] || platform} login, configure<br>the OAuth credentials in <code>src/config.js</code></p>
  `
  modal.classList.add('active')
}

function closeModal() {
  document.getElementById('auth-modal')?.classList.remove('active')
}

function logout() {
  currentUser = null
  updateAuthUI()
}

export function updateAuthUI() {
  const loginPanel  = document.getElementById('login-panel')
  const userDisplay = document.getElementById('user-display')
  if (!loginPanel || !userDisplay) return

  if (currentUser) {
    loginPanel.style.display  = 'none'
    userDisplay.style.display = 'flex'
    document.getElementById('user-name').textContent = currentUser.displayName
  } else {
    loginPanel.style.display  = 'flex'
    userDisplay.style.display = 'none'
  }
}
