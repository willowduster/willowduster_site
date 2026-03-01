/**
 * effects.js — Matrix rain canvas, CRT flicker, VHS glitch lines, particles.
 */

// ── Matrix Rain ──────────────────────────────────────────────────────────────
export function initMatrixRain() {
  const canvas = document.getElementById('matrix-canvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')

  const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&'
  let cols, drops

  function resize() {
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    cols  = Math.floor(canvas.width / 16)
    drops = Array(cols).fill(1)
  }

  resize()
  window.addEventListener('resize', resize)

  function draw() {
    ctx.fillStyle = 'rgba(10,10,15,0.05)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#00ff41'
    ctx.font = '14px monospace'

    for (let i = 0; i < drops.length; i++) {
      const char = chars[Math.floor(Math.random() * chars.length)]
      ctx.fillText(char, i * 16, drops[i] * 16)
      if (drops[i] * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0
      drops[i]++
    }
  }

  setInterval(draw, 50)
}

// ── VHS Tracking Glitch ───────────────────────────────────────────────────────
export function initVhsGlitch() {
  const playerWrap = document.querySelector('.player-wrapper')
  if (!playerWrap) return

  function glitch() {
    const line = document.createElement('div')
    line.className = 'vhs-line'
    line.style.cssText = `
      position:absolute;
      left:0;right:0;
      height:${2 + Math.random() * 4}px;
      top:${Math.random() * 100}%;
      background:rgba(255,255,255,0.06);
      pointer-events:none;
      z-index:10;
      animation:vhsFade 0.3s linear forwards;
    `
    playerWrap.style.position = 'relative'
    playerWrap.appendChild(line)
    setTimeout(() => line.remove(), 300)
  }

  // Trigger random glitches every 3-8 seconds
  function scheduleGlitch() {
    setTimeout(() => {
      glitch()
      if (Math.random() > 0.5) setTimeout(glitch, 80)
      scheduleGlitch()
    }, 3000 + Math.random() * 5000)
  }
  scheduleGlitch()
}

// ── Floating Particles ────────────────────────────────────────────────────────
// Named constant for particle count — increase for more visual intensity
const PARTICLE_COUNT = 35

export function initParticles() {
  const container = document.getElementById('particles')
  if (!container) return

  const colors = ['#ff00ff', '#00ffff', '#9d00ff', '#00ff41', '#ff6b35']

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement('div')
    p.className = 'particle'
    const size  = 2 + Math.random() * 3
    const color = colors[Math.floor(Math.random() * colors.length)]
    const left  = Math.random() * 100
    const delay = Math.random() * 8
    const dur   = 6 + Math.random() * 10

    p.style.cssText = `
      left:${left}%;
      width:${size}px;
      height:${size}px;
      background:${color};
      box-shadow:0 0 6px ${color};
      animation-duration:${dur}s;
      animation-delay:-${delay}s;
    `
    container.appendChild(p)
  }
}

// ── Typing Effect ─────────────────────────────────────────────────────────────
export function initTypingEffect(element, text, speed = 60) {
  if (!element) return
  element.textContent = ''
  element.style.visibility = 'visible'
  let i = 0
  const timer = setInterval(() => {
    element.textContent += text[i]
    i++
    if (i >= text.length) clearInterval(timer)
  }, speed)
}

// Named timing constants for CRT flicker scheduling
const MIN_FLICKER_DELAY = 5000   // ms — minimum gap between flickers
const MAX_FLICKER_DELAY = 15000  // ms — additional random jitter on top
export function initCrtFlicker() {
  const crt = document.querySelector('.crt-overlay')
  if (!crt) return
  // Occasionally make the whole screen flicker slightly
  function flicker() {
    const delay = MIN_FLICKER_DELAY + Math.random() * MAX_FLICKER_DELAY
    setTimeout(() => {
      document.body.style.opacity = '0.85'
      setTimeout(() => {
        document.body.style.opacity = '1'
        flicker()
      }, 60 + Math.random() * 80)
    }, delay)
  }
  flicker()
}
