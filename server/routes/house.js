import express from 'express'
import { memoryCount, clearMemory } from '../services/backboard.js'

const router = express.Router()

// Is the local model reachable? The UI shows this as a status pill.
router.get('/status', async (req, res) => {
  const url = process.env.OLLAMA_URL || 'http://localhost:11434'
  const model = process.env.GEMMA_MODEL || 'gemma3:4b'
  let ollama = false
  let modelReady = false
  try {
    const r = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(1500) })
    if (r.ok) {
      ollama = true
      const data = await r.json()
      modelReady = (data.models || []).some((m) => m.name === model || m.name === `${model}:latest`)
    }
  } catch {
    // Ollama not running
  }
  res.json({ ollama, model, modelReady, memories: await memoryCount() })
})

// Let the house forget everything it was told
router.delete('/memory', async (req, res) => {
  await clearMemory()
  res.json({ ok: true })
})

export default router
