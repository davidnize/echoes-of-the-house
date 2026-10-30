// Spooky ambience made live with the Web Audio API: no audio files, no downloads, works offline.
let ctx = null
let master = null
let timer = null
let running = []

function getCtx() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return null
    ctx = new AudioCtx()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function noiseBuffer(c, seconds = 4) {
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

// A soft bell, used in remembrance mode
function bell(c, out) {
  const t = c.currentTime
  const notes = [523.25, 659.25, 783.99, 880]
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = notes[Math.floor(Math.random() * notes.length)]
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.18, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.5)
  osc.connect(gain).connect(out)
  osc.start(t)
  osc.stop(t + 3.6)
}

// A slow creak, used in haunting mode
function creak(c, out) {
  const t = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  const bp = c.createBiquadFilter()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(90, t)
  osc.frequency.exponentialRampToValueAtTime(55 + Math.random() * 40, t + 1.4)
  bp.type = 'bandpass'
  bp.frequency.value = 700
  bp.Q.value = 6
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.14, t + 0.2)
  gain.gain.linearRampToValueAtTime(0, t + 1.5)
  osc.connect(bp).connect(gain).connect(out)
  osc.start(t)
  osc.stop(t + 1.6)
}

export function stopAmbience() {
  clearTimeout(timer)
  timer = null
  if (!ctx || !master) return
  const m = master
  const nodes = running
  master = null
  running = []
  const t = ctx.currentTime
  m.gain.cancelScheduledValues(t)
  m.gain.setValueAtTime(m.gain.value, t)
  m.gain.linearRampToValueAtTime(0, t + 0.8)
  setTimeout(() => {
    nodes.forEach((n) => {
      try { n.stop() } catch { /* already stopped */ }
    })
    try { m.disconnect() } catch { /* already disconnected */ }
  }, 1000)
}

export function startAmbience(mode = 'remembrance') {
  const c = getCtx()
  if (!c) return
  stopAmbience()
  const haunting = mode === 'haunting'

  master = c.createGain()
  master.gain.setValueAtTime(0, c.currentTime)
  master.gain.linearRampToValueAtTime(0.22, c.currentTime + 4)
  master.connect(c.destination)

  // Low drone: slightly detuned notes beat against each other
  const freqs = haunting ? [49, 49.6, 69.3] : [110, 110.4, 165]
  freqs.forEach((f, i) => {
    const osc = c.createOscillator()
    const lp = c.createBiquadFilter()
    const gain = c.createGain()
    osc.type = haunting ? 'sawtooth' : 'sine'
    osc.frequency.value = f
    lp.type = 'lowpass'
    lp.frequency.value = haunting ? 220 : 600
    gain.gain.value = i === 2 ? 0.05 : haunting ? 0.12 : 0.08
    osc.connect(lp).connect(gain).connect(master)
    osc.start()
    running.push(osc)
  })

  // Slow swell
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfo.frequency.value = 0.12
  lfoGain.gain.value = 0.04
  lfo.connect(lfoGain)
  lfoGain.connect(master.gain)
  lfo.start()
  running.push(lfo)

  // Wind
  const wind = c.createBufferSource()
  wind.buffer = noiseBuffer(c)
  wind.loop = true
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = haunting ? 500 : 700
  bp.Q.value = 0.8
  const windGain = c.createGain()
  windGain.gain.value = haunting ? 0.12 : 0.05
  const windLfo = c.createOscillator()
  const windLfoGain = c.createGain()
  windLfo.frequency.value = 0.08
  windLfoGain.gain.value = 250
  windLfo.connect(windLfoGain)
  windLfoGain.connect(bp.frequency)
  wind.connect(bp).connect(windGain).connect(master)
  wind.start()
  windLfo.start()
  running.push(wind, windLfo)

  // Now and then: a bell (remembrance) or a creak (haunting)
  const schedule = () => {
    timer = setTimeout(() => {
      if (!master) return
      if (haunting) creak(c, master)
      else bell(c, master)
      schedule()
    }, 5000 + Math.random() * 9000)
  }
  schedule()
}

// A rush of air when the ghost begins to speak
export function whoosh() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 2)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.2
  bp.frequency.setValueAtTime(300, t)
  bp.frequency.exponentialRampToValueAtTime(2200, t + 1.4)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.35, t + 0.5)
  gain.gain.linearRampToValueAtTime(0, t + 1.6)
  src.connect(bp).connect(gain).connect(c.destination)
  src.start(t)
  src.stop(t + 1.7)
}
