/**
 * main.js — Entry point. Wires everything together.
 */
import './style.css'
import { CONFIG }          from './config.js'
import { initStream }      from './stream.js'
import { initChat }        from './chat.js'
import { initAuth }        from './auth.js'
import {
  initMatrixRain,
  initVhsGlitch,
  initParticles,
  initCrtFlicker,
} from './effects.js'

document.addEventListener('DOMContentLoaded', () => {
  // Inject site title from config
  const titleEl = document.getElementById('site-title')
  if (titleEl) titleEl.textContent = CONFIG.siteTitle

  // Background & atmosphere effects
  initMatrixRain()
  initParticles()
  initCrtFlicker()

  // Stream player
  initStream()

  // Chat system
  initChat()

  // Auth buttons / modal
  initAuth()

  // VHS glitch on stream wrapper
  initVhsGlitch()
})
