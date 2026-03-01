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
  initTypingEffect,
  initCrtFlicker,
} from './effects.js'

document.addEventListener('DOMContentLoaded', () => {
  // Inject site title/subtitle from config
  const titleEl    = document.getElementById('site-title')
  const subtitleEl = document.getElementById('site-subtitle')
  if (titleEl)    titleEl.textContent = CONFIG.siteTitle
  if (subtitleEl) subtitleEl.textContent = ''

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

  // Typing effect on subtitle (runs after a short delay for drama)
  setTimeout(() => {
    initTypingEffect(subtitleEl, CONFIG.siteSubtitle, 55)
  }, 800)

  // VHS glitch on stream wrapper
  initVhsGlitch()
})
