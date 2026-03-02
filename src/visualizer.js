/**
 * visualizer.js — Vertical bar frequency visualizer (VLC-style).
 *
 * Uses Web Audio API AnalyserNode + Canvas 2D for a green-on-black
 * bar spectrum spanning 20 Hz – 20 kHz, rendered from the bottom of the
 * viewport. Optimised with requestAnimationFrame and minimal allocations.
 */

let audioCtx = null
let analyser = null
let source   = null
let canvas   = null
let ctx      = null
let dataArray = null
let animId   = null
let connected = false

// Number of FFT bins — 2048 gives 1024 frequency bins at 44.1 kHz sample rate
const FFT_SIZE = 2048

/**
 * Initialise the visualizer.
 * Call once after the <video> element exists and the canvas is in the DOM.
 * Audio context is created lazily on first user interaction (autoplay policy).
 *
 * @param {HTMLVideoElement} video – the Owncast HLS <video> element
 */
export function initVisualizer(video) {
  canvas = document.getElementById('visualizer-canvas')
  if (!canvas || !video) return

  ctx = canvas.getContext('2d')

  // Resize canvas to match CSS size on window resize
  function resize() {
    canvas.width  = canvas.clientWidth  * devicePixelRatio
    canvas.height = canvas.clientHeight * devicePixelRatio
  }
  resize()
  window.addEventListener('resize', resize)

  // We need user interaction to start AudioContext (browser autoplay policy).
  // Attach to common interaction events on the video and document.
  const startAudio = () => {
    if (connected) {
      // AudioContext may have been created during muted autoplay and stayed
      // suspended.  Resume it now that we have a genuine user gesture.
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume()
      return
    }
    try {
      connectAudio(video)
    } catch (e) { console.warn('[visualizer] AudioContext not ready:', e.message) }
  }

  video.addEventListener('play', startAudio)
  video.addEventListener('volumechange', startAudio)
  document.addEventListener('click', startAudio, { once: true })

  // Start the render loop immediately — canvas stays transparent until
  // the analyser is connected and producing audio data.
  draw()
}

/**
 * Create AudioContext, connect the video element, and set up the analyser.
 */
function connectAudio(video) {
  if (connected) return

  audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()

  analyser = audioCtx.createAnalyser()
  analyser.fftSize = FFT_SIZE
  analyser.smoothingTimeConstant = 0.8
  analyser.minDecibels = -90
  analyser.maxDecibels = -10

  source = audioCtx.createMediaElementSource(video)
  source.connect(analyser)
  analyser.connect(audioCtx.destination) // pass audio through to speakers

  dataArray = new Uint8Array(analyser.frequencyBinCount)
  connected = true
}

/**
 * Map a frequency (Hz) to the corresponding FFT bin index.
 */
function freqToBin(freq, sampleRate, binCount) {
  return Math.round(freq / (sampleRate / 2) * binCount)
}

/**
 * Main render loop — draws vertical bars from bottom of the canvas.
 */
function draw() {
  animId = requestAnimationFrame(draw)

  if (!canvas || !ctx) return

  const W = canvas.width
  const H = canvas.height

  // Clear to transparent so the canvas is invisible when there's no audio
  ctx.clearRect(0, 0, W, H)

  if (!analyser || !dataArray) return

  analyser.getByteFrequencyData(dataArray)

  const sampleRate = audioCtx.sampleRate
  const binCount   = analyser.frequencyBinCount

  // Map 20 Hz – 20 kHz range to bin indices
  const minBin = Math.max(1, freqToBin(20, sampleRate, binCount))
  const maxBin = Math.min(binCount - 1, freqToBin(20000, sampleRate, binCount))

  // ~2 device-pixels per bar (bar + gap) keeps the display readable on all screens
  const BAR_COUNT = Math.min(128, Math.floor(W / (2 * devicePixelRatio)))
  const gap       = 1 * devicePixelRatio
  const barWidth  = (W - gap * (BAR_COUNT - 1)) / BAR_COUNT

  for (let i = 0; i < BAR_COUNT; i++) {
    // Logarithmic mapping: human hearing is logarithmic across frequency
    const t0 = i / BAR_COUNT
    const t1 = (i + 1) / BAR_COUNT
    const binStart = Math.floor(minBin * Math.pow(maxBin / minBin, t0))
    const binEnd   = Math.max(binStart + 1, Math.floor(minBin * Math.pow(maxBin / minBin, t1)))

    // Average the bins in this range
    let sum = 0
    let count = 0
    for (let b = binStart; b < binEnd && b < binCount; b++) {
      sum += dataArray[b]
      count++
    }
    const value = count > 0 ? sum / count : 0 // 0-255

    const barHeight = (value / 255) * H
    const x = i * (barWidth + gap)
    const y = H - barHeight

    // Green gradient: darker at bottom, brighter at top
    const grad = ctx.createLinearGradient(x, H, x, y)
    grad.addColorStop(0, '#004d00')  // dark green at base
    grad.addColorStop(0.5, '#00cc00')
    grad.addColorStop(1, '#00ff2f')  // bright neon green at peak
    ctx.fillStyle = grad
    ctx.fillRect(x, y, barWidth, barHeight)
  }
}

/**
 * Return current audio energy levels split into frequency bands.
 * Returns null when the analyser is not yet connected.
 *
 * @returns {{ bass: number, mid: number, high: number, overall: number } | null}
 *          Each value is 0-255.
 */
export function getAudioLevels() {
  if (!analyser || !dataArray) return null

  analyser.getByteFrequencyData(dataArray)

  const sampleRate = audioCtx.sampleRate
  const binCount   = analyser.frequencyBinCount

  // Band boundaries (Hz)
  const bassBin = freqToBin(250,   sampleRate, binCount)
  const midBin  = freqToBin(4000,  sampleRate, binCount)
  const hiBin   = freqToBin(20000, sampleRate, binCount)

  let bassSum = 0, midSum = 0, hiSum = 0, allSum = 0
  let bassN = 0, midN = 0, hiN = 0

  for (let i = 1; i < hiBin && i < binCount; i++) {
    const v = dataArray[i]
    allSum += v
    if (i < bassBin)       { bassSum += v; bassN++ }
    else if (i < midBin)   { midSum  += v; midN++  }
    else                   { hiSum   += v; hiN++   }
  }

  return {
    bass:    bassN > 0 ? bassSum / bassN : 0,
    mid:     midN  > 0 ? midSum  / midN  : 0,
    high:    hiN   > 0 ? hiSum   / hiN   : 0,
    overall: hiBin > 1 ? allSum / (hiBin - 1) : 0,
  }
}

/**
 * Clean up — call if you need to tear down the visualizer.
 */
export function destroyVisualizer() {
  if (animId) cancelAnimationFrame(animId)
  try { if (source)   source.disconnect() }   catch (_) {}
  try { if (analyser) analyser.disconnect() } catch (_) {}
  try { if (audioCtx) audioCtx.close() }      catch (_) {}
  connected = false
}
