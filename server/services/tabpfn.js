// Reads the traces with TabPFN, running locally in tabpfn-service/.
// If that service is not running, falls back to a simple keyword heuristic.
const TABPFN_URL = process.env.TABPFN_URL || 'http://127.0.0.1:8000'
const KEYWORDS = ['flicker', 'footstep', 'door', 'whisper', 'cold', 'voice', 'shadow', 'music']

function heuristic(events) {
  let hits = 0
  for (const e of events) {
    const text = `${e.event} ${e.notes || ''}`.toLowerCase()
    if (KEYWORDS.some((k) => text.includes(k))) hits += 1
  }
  const rooms = new Set(events.map((e) => e.room).filter(Boolean)).size
  return Math.min(0.95, 0.25 + hits * 0.12 + rooms * 0.05 + Math.random() * 0.1)
}

function eerie(score) {
  if (score < 0.2) return "The house is holding its breath."
  if (score < 0.5) return "Something stirs behind the walls."
  if (score < 0.8) return "The house is awake."
  return "The veil is thin tonight."
}

export async function runTabPFN(events) {
  let score
  let source
  try {
    const res = await fetch(`${TABPFN_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`TabPFN service answered ${res.status}`)
    const data = await res.json()
    score = data.probability
    source = 'tabpfn'
  } catch (err) {
    console.warn('TabPFN service unavailable, using the simple heuristic:', err.message)
    score = heuristic(events)
    source = 'heuristic'
  }

  return {
    nextEchoLikely: score > 0.5,
    confidence: score.toFixed(2),
    source,
    message: eerie(score),
  }
}
