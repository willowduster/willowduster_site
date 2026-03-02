/**
 * effects.js — Matrix rain canvas, CRT flicker, VHS glitch lines, particles.
 *
 * When an audioLevelsFn is provided, effects react to the Owncast stream
 * frequencies (bass / mid / high / overall).
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

    ctx.fillStyle = '#00ff2f'
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
let _vhsAudioFn = null

// Audio-reactive thresholds for VHS glitch
const HIGH_FREQ_THRESHOLD = 120
const TRANSIENT_DELTA = 40

export function initVhsGlitch(audioLevelsFn) {
  const playerWrap = document.querySelector('.player-wrapper')
  if (!playerWrap) return
  if (audioLevelsFn) _vhsAudioFn = audioLevelsFn

  let prevHigh = 0

  function glitch() {
    const levels = _vhsAudioFn ? _vhsAudioFn() : null
    // Scale glitch intensity with high-frequency energy
    const intensity = levels ? Math.min(levels.high / 180, 1) : 1
    const height = (2 + Math.random() * 4) * (0.5 + intensity)

    const line = document.createElement('div')
    line.className = 'vhs-line'
    line.style.cssText = `
      position:absolute;
      left:0;right:0;
      height:${height}px;
      top:${Math.random() * 100}%;
      background:rgba(255,255,255,${0.04 + intensity * 0.06});
      pointer-events:none;
      z-index:10;
      animation:vhsFade 0.3s linear forwards;
    `
    playerWrap.style.position = 'relative'
    playerWrap.appendChild(line)
    setTimeout(() => line.remove(), 300)
  }

  // Audio-reactive: trigger glitches more often when treble is loud
  function scheduleGlitch() {
    const levels = _vhsAudioFn ? _vhsAudioFn() : null
    // Transient detection: trigger faster when high-freq energy spikes
    let delay = 3000 + Math.random() * 5000
    if (levels) {
      const highNorm = levels.high / 255
      // More energy → shorter delay (minimum ~1s)
      delay = Math.max(1000, delay * (1 - highNorm * 0.6))
      // Extra burst on transient
      if (levels.high > HIGH_FREQ_THRESHOLD && levels.high - prevHigh > TRANSIENT_DELTA) {
        setTimeout(glitch, 40)
      }
      prevHigh = levels.high
    }
    setTimeout(() => {
      glitch()
      if (Math.random() > 0.5) setTimeout(glitch, 80)
      scheduleGlitch()
    }, delay)
  }
  scheduleGlitch()
}

// ── Floating Particles ────────────────────────────────────────────────────────
// Named constant for particle count — increase for more visual intensity
const PARTICLE_COUNT = 35

export function initParticles() {
  const container = document.getElementById('particles')
  if (!container) return

  const colors = ['#00ff2f', '#7fff5e', '#009a1c', '#464646', '#00ff2f']

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

// ── Flying Wizards (Flying Toasters homage) ──────────────────────────────────
// spriteSources: array of entries — either:
//   string URL (single-frame, e.g. wizard-dance.svg)
//   { url, frames } (WebP sprite sheet, already resolved)
let _wizAudioFn = null

// Audio-reactive tuning for flying wizards
const BASS_SPEED_SCALE = 1.5
const WOBBLE_SCALE = 2

export function initFlyingWizards(spriteSources, audioLevelsFn) {
  const sprites = Array.isArray(spriteSources) ? spriteSources : [spriteSources]
  if (audioLevelsFn) _wizAudioFn = audioLevelsFn
  const WIZARD_COUNT = 32
  const SPAWN_INTERVAL = 1800
  const FG_INTERVAL_MS = 10 * 1000

  const bgLayer = document.createElement('div')
  bgLayer.className = 'flying-wizards-bg'
  bgLayer.setAttribute('aria-hidden', 'true')
  document.body.appendChild(bgLayer)

  const fgLayer = document.createElement('div')
  fgLayer.className = 'flying-wizards-fg'
  fgLayer.setAttribute('aria-hidden', 'true')
  document.body.appendChild(fgLayer)

  const wizards = []
  let lastFgTime = 0

  function spawnWizard() {
    if (wizards.length >= WIZARD_COUNT) return

    const now = Date.now()
    const isForeground = (now - lastFgTime) >= FG_INTERVAL_MS
    if (isForeground) lastFgTime = now
    const layer = isForeground ? fgLayer : bgLayer

    const sprite = sprites[Math.floor(Math.random() * sprites.length)]

    // Random size
    const size = isForeground
      ? 200 + Math.random() * 500
      : 60 + Math.random() * 300

    let el
    if (typeof sprite === 'string') {
      // Single-frame image (e.g. wizard-dance.svg)
      el = document.createElement('img')
      el.src = sprite
      el.className = 'flying-wizard'
      el.style.width = size + 'px'
      el.style.height = size + 'px'
    } else {
      // WebP sprite sheet: { url, frames }
      el = document.createElement('div')
      el.className = 'flying-wizard flying-sprite'
      el.style.width = size + 'px'
      el.style.height = size + 'px'
      el.style.backgroundImage = `url(${sprite.url})`
      el.style.backgroundSize = `${size}px ${size * sprite.frames}px`
      el.style.setProperty('--sprite-frames', sprite.frames)
      el.style.setProperty('--sprite-offset', `-${size * sprite.frames}px`)
    }

    if (isForeground) el.classList.add('flying-wizard--fg')

    // Random starting position
    const fromRight = Math.random() > 0.4
    let x, y
    if (fromRight) {
      x = window.innerWidth + size
      y = Math.random() * (window.innerHeight * 0.7)
    } else {
      x = Math.random() * window.innerWidth
      y = -size
    }

    const vx = -(0.2 + Math.random() * 0.6) * (isForeground ? 1.2 : 1)
    const vy = (0.15 + Math.random() * 0.4) * (isForeground ? 1.2 : 1)

    let rot = Math.random() * 360
    const spinSpeed = (Math.random() - 0.5) * 1.5

    const wobbleAmp = 10 + Math.random() * 30
    const wobbleFreq = 0.005 + Math.random() * 0.01
    let wobblePhase = Math.random() * Math.PI * 2

    el.style.opacity = isForeground ? (0.6 + Math.random() * 0.3) : (0.35 + Math.random() * 0.25)

    layer.appendChild(el)

    const wizard = { el, x, y, vx, vy, rot, spinSpeed, wobbleAmp, wobbleFreq, wobblePhase, size }
    wizards.push(wizard)
  }

  function update() {
    const levels = _wizAudioFn ? _wizAudioFn() : null
    // Audio multipliers: bass drives speed, overall drives wobble
    const speedMul = levels ? (1 + (levels.bass / 255) * BASS_SPEED_SCALE) : 1
    const wobbleMul = levels ? (1 + (levels.overall / 255) * WOBBLE_SCALE) : 1
    const glowIntensity = levels ? Math.min(levels.bass / 200, 1) : 0

    for (let i = wizards.length - 1; i >= 0; i--) {
      const w = wizards[i]
      w.x += w.vx * speedMul
      w.y += w.vy * speedMul
      w.rot += w.spinSpeed * speedMul
      w.wobblePhase += w.wobbleFreq * wobbleMul

      const wobbleX = Math.sin(w.wobblePhase) * w.wobbleAmp * wobbleMul

      w.el.style.transform = `translate(${w.x + wobbleX}px, ${w.y}px) rotate(${w.rot}deg)`

      // Modulate glow based on bass
      if (levels && w.el.classList.contains('flying-wizard--fg')) {
        const g = Math.round(12 + glowIntensity * 30)
        w.el.style.filter = `drop-shadow(0 0 ${g}px rgba(0,255,47,${0.4 + glowIntensity * 0.4}))`
      }

      if (w.x < -w.size * 2 || w.y > window.innerHeight + w.size * 2) {
        w.el.remove()
        wizards.splice(i, 1)
      }
    }
    requestAnimationFrame(update)
  }

  // Audio-reactive spawning: spawn extra wizards on bass hits
  let spawnTimer = null
  function scheduleSpawn() {
    const levels = _wizAudioFn ? _wizAudioFn() : null
    let interval = SPAWN_INTERVAL
    if (levels) {
      // More bass → faster spawning (minimum ~800ms)
      interval = Math.max(800, SPAWN_INTERVAL * (1 - (levels.bass / 255) * 0.6))
    }
    spawnTimer = setTimeout(() => {
      spawnWizard()
      scheduleSpawn()
    }, interval)
  }

  for (let i = 0; i < 6; i++) {
    setTimeout(spawnWizard, i * 400)
  }
  scheduleSpawn()
  requestAnimationFrame(update)
}
