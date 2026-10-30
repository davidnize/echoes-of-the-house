import { useState, useEffect, useRef } from 'react'
import Petals from './Petals.jsx'
import { startAmbience, stopAmbience, whoosh } from './ambience.js'

const OPEN_SOUND = '/sounds/laugh.mp3'
const REPLY_SOUND = '/sounds/reply.mp3'

const FLAG_COLORS = ['#f29a1f', '#d6336c', '#7c3aed', '#14b8a6', '#facc15', '#f97316', '#ec4899']

const PROMPTS = {
  remembrance: [
    'What do you remember about this place?',
    'What would you tell us tonight?',
    'What did you love most?',
  ],
  haunting: ['Who is still here?', 'What happened in this room?', 'Why are you listening?'],
}

const SAMPLE_TRACES = [
  { date: "1987-10-31", room: "living room", event: "lights flickered" },
  { date: "1992-11-02", room: "kitchen", event: "door opened" },
  { date: "2001-10-31", room: "hallway", event: "footsteps" },
  { date: "2009-11-01", room: "bedroom", event: "whispers" },
  { date: "2018-10-31", room: "attic", event: "shadow moved" },
]

// A soft chime made in the browser, used when the mp3 files are not there
function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    ;[523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const t = ctx.currentTime + i * 0.18
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.12, t + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.2)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 2.3)
    })
    setTimeout(() => ctx.close(), 3500)
  } catch {
    // audio not available
  }
}

// Pick the best English voice the computer has (premium and enhanced voices sound much better)
function pickVoice() {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : []
  const en = voices.filter((v) => v.lang && v.lang.startsWith("en"))
  let saved = ""
  try {
    saved = localStorage.getItem("echoes-voice") || ""
  } catch {
    saved = ""
  }
  const chosen = en.find((v) => v.name === saved)
  if (chosen) return chosen
  const prefs = [/premium/i, /enhanced/i, /daniel/i, /serena/i, /ava/i, /samantha/i]
  for (const p of prefs) {
    const v = en.find((x) => p.test(x.name))
    if (v) return v
  }
  return en[0] || null
}

let voiceCtx = null
function duck(down) {
  try { window.echoesDuck && window.echoesDuck(down) } catch (e) {}
}

function ghostEcho(audio) {
  try {
    if (!voiceCtx) voiceCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (voiceCtx.state === 'suspended') voiceCtx.resume()
    const src = voiceCtx.createMediaElementSource(audio)
    const tone = voiceCtx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 3200
    const dry = voiceCtx.createGain()
    dry.gain.value = 0.85
    const delay = voiceCtx.createDelay(1)
    delay.delayTime.value = 0.32
    const fb = voiceCtx.createGain()
    fb.gain.value = 0.38
    const wetTone = voiceCtx.createBiquadFilter()
    wetTone.type = 'lowpass'
    wetTone.frequency.value = 1800
    const wet = voiceCtx.createGain()
    wet.gain.value = 0.45
    src.connect(tone)
    tone.connect(dry)
    dry.connect(voiceCtx.destination)
    tone.connect(delay)
    delay.connect(wetTone)
    wetTone.connect(fb)
    fb.connect(delay)
    wetTone.connect(wet)
    wet.connect(voiceCtx.destination)
  } catch (e) {}
}

let ghostAudio = null
let speakToken = 0

function stopSpeaking() {
  speakToken++
  if (ghostAudio) { ghostAudio.pause(); ghostAudio = null }
  duck(false)
  if (window.speechSynthesis) window.speechSynthesis.cancel()
}

// Piper voice first; if the voice service is down, fall back to the browser voice
async function speak(text, mode) {
  if (!text) return
  stopSpeaking()
  const token = speakToken
  try {
    const res = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new Error('speak failed')
    const blob = await res.blob()
    if (token !== speakToken) return
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.onended = () => {
      URL.revokeObjectURL(url)
      setTimeout(() => { if (token === speakToken) duck(false) }, 1200)
    }
    ghostAudio = audio
    ghostEcho(audio)
    await audio.play()
    duck(true)
  } catch (e) {
    if (token === speakToken) browserSpeak(text, mode)
  }
}

function browserSpeak(text, mode) {
  if (!window.speechSynthesis || !text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const v = pickVoice()
  if (v) u.voice = v
  u.rate = 0.88
  u.pitch = mode === "haunting" ? 0.8 : 0.95
  window.speechSynthesis.speak(u)
}

function Candle() {
  return (
    <div className="candle" aria-hidden="true">
      <div className="flame" />
      <div className="wax" />
    </div>
  )
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  let line = ''
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y)
      line = word
      y += lineHeight
    } else {
      line = test
    }
  }
  if (line) {
    ctx.fillText(line, x, y)
    y += lineHeight
  }
  return y
}

export default function App() {
  const [entered, setEntered] = useState(false)
  const [mode, setMode] = useState('remembrance')
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [events, setEvents] = useState([])
  const [newEvent, setNewEvent] = useState({ date: '', room: '', event: '' })
  const [prediction, setPrediction] = useState(null)
  const [question, setQuestion] = useState('')
  const [reply, setReply] = useState('')
  const [reading, setReading] = useState(false)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [muted, setMuted] = useState(false)
  const [status, setStatus] = useState(null)
  const [voices, setVoices] = useState([])
  const [voiceName, setVoiceName] = useState(() => {
    try {
      return localStorage.getItem("echoes-voice") || ""
    } catch {
      return ""
    }
  })

  useEffect(() => {
    if (!window.speechSynthesis) return
    const load = () =>
      setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang && v.lang.startsWith("en")))
    load()
    window.speechSynthesis.addEventListener("voiceschanged", load)
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load)
  }, [])

  const openAudio = useRef(null)
  const replyAudio = useRef(null)
  const mutedRef = useRef(muted)

  useEffect(() => {
    mutedRef.current = muted
    if (muted) {
      if (openAudio.current) openAudio.current.pause()
      stopSpeaking()
      stopAmbience()
    } else if (entered) {
      startAmbience(mode)
    }
  }, [muted])

  useEffect(() => {
    if (entered && !mutedRef.current) startAmbience(mode)
  }, [mode])

  useEffect(() => {
    openAudio.current = new Audio(OPEN_SOUND)
    openAudio.current.volume = 1
    replyAudio.current = new Audio(REPLY_SOUND)
    replyAudio.current.volume = 0.5
  }, [])

  // Poll the server so the status pill tells the truth about the local model
  useEffect(() => {
    let alive = true
    const check = () =>
      fetch('/api/status')
        .then((r) => r.json())
        .then((s) => alive && setStatus(s))
        .catch(() => alive && setStatus({ server: false }))
    check()
    const id = setInterval(check, 15000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const play = (ref) => {
    if (mutedRef.current) return
    const audio = ref.current
    if (!audio) return chime()
    audio.currentTime = 0
    audio.play().catch(() => chime())
  }

  const enter = () => {
    setEntered(true)
    play(openAudio)
    if (!mutedRef.current) startAmbience(mode)
  }

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const addEvent = () => {
    if (!newEvent.event.trim()) return
    setEvents([...events, { ...newEvent }])
    setNewEvent({ date: '', room: '', event: '' })
  }

  const removeEvent = (i) => setEvents(events.filter((_, idx) => idx !== i))

  const analyze = async () => {
    setReading(true)
    setError('')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      })
      if (!res.ok) throw new Error('Analysis failed')
      const data = await res.json()
      setPrediction(data.prediction)
    } catch {
      setError('The traces are unreadable right now.')
    } finally {
      setReading(false)
    }
  }

  const askGhost = async (text) => {
    const q = typeof text === 'string' ? text : question
    if (!photo && !q.trim()) return
    setAsking(true)
    setError('')
    setReply('')
    stopSpeaking()
    try {
      const form = new FormData()
      if (photo) form.append('photo', photo)
      form.append('question', q)
      form.append('prediction', JSON.stringify(prediction))
      form.append("events", JSON.stringify(events))
      form.append('mode', mode)
      form.append('name', name)
      form.append('relation', relation)

      const res = await fetch('/api/chat', { method: 'POST', body: form })
      if (!res.ok || !res.body) throw new Error('Chat failed')
      if (!mutedRef.current) whoosh()

      // The reply arrives word by word
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setReply(full)
      }
      play(replyAudio)
      if (!mutedRef.current) speak(full, mode)
    } catch {
      setError('The house is quiet right now. Is Ollama running?')
    } finally {
      setAsking(false)
    }
  }

  const changeVoice = (name) => {
    setVoiceName(name)
    try {
      localStorage.setItem("echoes-voice", name)
    } catch {
      // storage unavailable
    }
    speak("The veil is thin tonight. Can you hear me?", mode)
  }

  const hearIt = () => {
    if (!reply || !window.speechSynthesis) return
    speak(reply, mode)
  }

  const saveEncounter = async () => {
    const W = 900
    const H = 1300
    const accent = mode === 'haunting' ? '#9cc3d6' : '#f29a1f'
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = mode === 'haunting' ? '#080b10' : '#150b08'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = accent
    ctx.lineWidth = 3
    ctx.strokeRect(30, 30, W - 60, H - 60)
    ctx.setLineDash([2, 12])
    ctx.lineWidth = 6
    ctx.strokeRect(50, 50, W - 100, H - 100)
    ctx.setLineDash([])

    ctx.textAlign = 'center'
    ctx.fillStyle = accent
    ctx.font = '48px Georgia, serif'
    ctx.fillText('Echoes of the House', W / 2, 140)

    let y = 190
    if (photoPreview) {
      await new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          const box = 520
          const scale = Math.min(box / img.width, box / img.height)
          const iw = img.width * scale
          const ih = img.height * scale
          ctx.drawImage(img, (W - iw) / 2, y, iw, ih)
          ctx.strokeStyle = accent
          ctx.lineWidth = 3
          ctx.strokeRect((W - iw) / 2 - 8, y - 8, iw + 16, ih + 16)
          y += ih + 70
          resolve()
        }
        img.onerror = resolve
        img.src = photoPreview
      })
    }

    if (name) {
      ctx.fillStyle = '#f1e6d6'
      ctx.font = '36px Georgia, serif'
      ctx.fillText(relation ? `${name}, ${relation}` : name, W / 2, y)
      y += 60
    }
    if (prediction) {
      ctx.fillStyle = accent
      ctx.font = 'italic 26px Georgia, serif'
      ctx.fillText(prediction.message, W / 2, y)
      y += 70
    }
    ctx.fillStyle = '#f1e6d6'
    ctx.font = 'italic 32px Georgia, serif'
    y = wrapText(ctx, reply, W / 2, y, W - 220, 46)

    ctx.fillStyle = '#8a7a68'
    ctx.font = '22px system-ui, sans-serif'
    ctx.fillText('Spoken offline by an open-weight model on the visitor\'s own machine', W / 2, H - 80)

    const link = document.createElement('a')
    link.download = 'echoes-of-the-house.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const forget = async () => {
    await fetch('/api/memory', { method: 'DELETE' }).catch(() => {})
    setNotice('The house has forgotten. Its memory is empty.')
    setTimeout(() => setNotice(''), 4000)
    fetch('/api/status').then((r) => r.json()).then(setStatus).catch(() => {})
  }

  const haunting = mode === 'haunting'
  const veil = prediction ? Math.min(1, Math.max(0, Number(prediction.confidence))) : 0

  let pill = { cls: 'pill', text: 'Checking the house...' }
  if (status) {
    if (status.server === false) pill = { cls: 'pill bad', text: 'Server not running' }
    else if (!status.ollama) pill = { cls: 'pill bad', text: 'Ollama is not running' }
    else if (!status.modelReady) pill = { cls: 'pill warn', text: `Model ${status.model} not pulled` }
    else pill = { cls: 'pill ok', text: `Local · ${status.model} · nothing leaves this machine` }
  }

  return (
    <div className="root" data-mode={mode}>
      <Petals mode={mode} />

      {!entered && (
        <div className="gate">
          <div className="candle big" aria-hidden="true">
            <div className="flame" />
            <div className="wax" />
          </div>
          <h1 className="gate-title">Echoes of the House</h1>
          <p className="gate-sub">The veil is thin tonight. Light a candle, and listen.</p>
          <button className="primary" onClick={enter}>Light the candle</button>
          <p className="gate-note">Open-weight models, running on this machine. Your photos stay here.</p>
        </div>
      )}

      {entered && (
        <>
          <div className="banner" aria-hidden="true">
            {Array.from({ length: 20 }).map((_, i) => (
              <span key={i} style={{ background: FLAG_COLORS[i % FLAG_COLORS.length], animationDelay: `${(i % 7) * 0.3}s` }} />
            ))}
          </div>

          <div className="app">
            <div className="topbar">
              <span className={pill.cls}>{pill.text}</span>
              <div className="topbar-right">
                <div className="seg" role="group" aria-label="Mood">
                  <button className={!haunting ? 'on' : ''} onClick={() => setMode('remembrance')}>Remembrance</button>
                  <button className={haunting ? 'on' : ''} onClick={() => setMode('haunting')}>Haunting</button>
                </div>
                <select className="voicepick" value={voiceName} onChange={(e) => changeVoice(e.target.value)} aria-label="Ghost voice">
                  <option value="">Auto voice</option>
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <header className="hero">
              <h1>Echoes of the House</h1>
              <p>{haunting ? 'Offer a photo. Leave a trace. Something is listening.' : 'Offer a photo. Leave a memory. Listen.'}</p>
            </header>

            <section className="card">
              <h2><span className="num">I</span> The offering</h2>
              <div className="altar">
                <Candle />
                <label className="frame">
                  <input type="file" accept="image/*" onChange={handlePhoto} hidden />
                  {photoPreview ? (
                    <img src={photoPreview} alt="offering" />
                  ) : (
                    <div className="frame-empty">
                      <span className="plus">+</span>
                      <span>Place a photo on the altar</span>
                    </div>
                  )}
                </label>
                <Candle />
              </div>
              {photoPreview && <p className="hint center">Click the frame to change the photo.</p>}
              <div className="row">
                <input
                  placeholder={haunting ? 'Name of the house (optional)' : 'Who are you remembering? (optional)'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {!haunting && (
                  <input
                    placeholder="Your relationship (grandmother, friend...)"
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                  />
                )}
              </div>
            </section>

            <section className="card">
              <h2><span className="num">II</span> The traces <small>optional</small></h2>
              <div className="grid2">
                <input placeholder="Date" value={newEvent.date} onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} />
                <input placeholder="Room" value={newEvent.room} onChange={(e) => setNewEvent({ ...newEvent, room: e.target.value })} />
              </div>
              <input placeholder="What happened" value={newEvent.event} onChange={(e) => setNewEvent({ ...newEvent, event: e.target.value })} />
              <div className="btnrow">
                <button onClick={addEvent}>Add trace</button>
                <button className="ghostbtn" onClick={() => setEvents(SAMPLE_TRACES)}>Use sample traces</button>
              </div>

              {events.length > 0 && (
                <ul className="chips">
                  {events.map((ev, i) => (
                    <li key={i}>
                      <span>{[ev.date, ev.room].filter(Boolean).join(' · ')}{ev.date || ev.room ? ' — ' : ''}{ev.event}</span>
                      <button className="x" onClick={() => removeEvent(i)} aria-label="Remove trace">×</button>
                    </li>
                  ))}
                </ul>
              )}

              <button className="primary" onClick={analyze} disabled={reading}>
                {reading ? 'Reading...' : 'Read the traces'}
              </button>

              {prediction && (
                <div className="veil">
                  <div className="veil-head">
                    <span>{prediction.message}</span>
                    <span>{Math.round(veil * 100)}%</span>
                  </div>
                  <div className="meter"><div className="fill" style={{ width: `${veil * 100}%` }} /></div>
                  <p className="hint">How thin the veil is tonight · read by {prediction.source === "tabpfn" ? "TabPFN, running locally" : "a simple fallback"}</p>
                </div>
              )}
            </section>

            <section className="card">
              <h2><span className="num">III</span> Speak</h2>
              <textarea
                placeholder={haunting ? 'What do you want to ask the house?' : 'What do you want to ask?'}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
              />
              <div className="suggest">
                {PROMPTS[mode].map((p) => (
                  <button key={p} className="chip" onClick={() => { setQuestion(p); askGhost(p) }} disabled={asking}>{p}</button>
                ))}
              </div>
              <button className="primary" onClick={() => askGhost()} disabled={asking}>
                {asking ? 'Listening...' : 'Speak'}
              </button>
              {asking && !reply && <p className="hint">The first answer can take a little while as the model wakes up.</p>}
              {error && <p className="error">{error}</p>}

              {(reply || asking) && (
                <div className="encounter">
                  {prediction && <p className="reading">{prediction.message}</p>}
                  <div className="ghost-reply">
                    {reply}
                    {asking && <span className="caret" />}
                  </div>
                  {!asking && reply && (
                    <div className="btnrow">
                      <button onClick={hearIt}>Hear it</button>
                      <button onClick={saveEncounter}>Keep this encounter (PNG)</button>
                    </div>
                  )}
                </div>
              )}
            </section>

            <footer className="foot">
              <p>
                Built with PriorLabs-TabPFN.
                Open-weight Gemma runs on this machine through Ollama. Uploaded photos are deleted from the server after each reply.
                {status && typeof status.memories === 'number' ? ` The house remembers ${status.memories} earlier exchange${status.memories === 1 ? '' : 's'}.` : ''}
              </p>
              <button className="ghostbtn" onClick={forget}>Let the house forget</button>
              {notice && <p className="hint">{notice}</p>}
            </footer>
          </div>
        </>
      )}
    </div>
  )
}
