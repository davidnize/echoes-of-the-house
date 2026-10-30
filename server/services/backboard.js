// Ghost memory: uses Backboard when BACKBOARD_API_KEY and BACKBOARD_ASSISTANT_ID are set,
// otherwise falls back to server/data/memory.json (also used on any Backboard error).
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')
const file = path.join(dir, 'memory.json')
const BASE = 'https://app.backboard.io/api'

function useBackboard() {
  return Boolean(process.env.BACKBOARD_API_KEY && process.env.BACKBOARD_ASSISTANT_ID)
}

async function bb(p, options = {}) {
  const res = await fetch(`${BASE}/assistants/${process.env.BACKBOARD_ASSISTANT_ID}${p}`, {
    ...options,
    headers: {
      'X-API-Key': process.env.BACKBOARD_API_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })
  if (!res.ok) throw new Error(`Backboard ${res.status}: ${await res.text()}`)
  return res.json()
}

async function load() {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return []
  }
}

async function persist(list) {
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(file, JSON.stringify(list, null, 2))
}

// Turns a Backboard memory back into { question, reply } for gemma.js
function toEntry(m) {
  const text = m.content || m.memory || ''
  const q = text.match(/Visitor asked: (.*)/)
  const r = text.match(/Ghost replied: ([\s\S]*?)(\nTraces:|$)/)
  return { question: q ? q[1] : '', reply: r ? r[1] : text }
}

export async function getMemory() {
  if (useBackboard()) {
    try {
      const data = await bb('/memories')
      const list = data.memories || data.items || data || []
      return list.slice(-5).map(toEntry)
    } catch (e) {
      console.error('Backboard get failed, using local:', e.message)
    }
  }
  return (await load()).slice(-5)
}

export async function saveMemory(entry) {
  // always keep a local copy too
  const list = await load()
  list.push({ ...entry, at: new Date().toISOString() })
  await persist(list.slice(-20))

  if (useBackboard()) {
    try {
      const content = `Visitor asked: ${entry.question || '(nothing)'}\nGhost replied: ${entry.reply}${entry.prediction ? `\nTraces: ${entry.prediction.message}` : ''}`
      await bb('/memories', {
        method: 'POST',
        body: JSON.stringify({ content, metadata: { source: 'echoes' } })
      })
    } catch (e) {
      console.error('Backboard save failed (kept locally):', e.message)
    }
  }
  return true
}

export async function clearMemory() {
  await persist([])
  if (useBackboard()) {
    try {
      const data = await bb('/memories')
      const list = data.memories || data.items || data || []
      for (const m of list) {
        const id = m.id || m.memory_id
        if (id) await bb(`/memories/${id}`, { method: 'DELETE' })
      }
    } catch (e) {
      console.error('Backboard clear failed:', e.message)
    }
  }
}

export async function memoryCount() {
  if (useBackboard()) {
    try {
      const data = await bb('/memories')
      const list = data.memories || data.items || data || []
      return data.total_count ?? list.length
    } catch (e) {
      console.error('Backboard count failed, using local:', e.message)
    }
  }
  return (await load()).length
}