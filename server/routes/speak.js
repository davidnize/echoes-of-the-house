import { Router } from 'express'

const router = Router()
const VOICE_URL = process.env.VOICE_URL || 'http://127.0.0.1:8100/speak'

router.post('/speak', async (req, res) => {
  const text = String((req.body && req.body.text) || '').trim().slice(0, 2000)
  if (!text) return res.status(400).json({ error: 'no text' })
  try {
    const r = await fetch(VOICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!r.ok) return res.status(502).json({ error: 'voice service error' })
    res.set('Content-Type', 'audio/wav')
    res.send(Buffer.from(await r.arrayBuffer()))
  } catch (e) {
    res.status(502).json({ error: 'voice service unreachable' })
  }
})

export default router
