import fs from 'fs'

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const MODEL = process.env.GEMMA_MODEL || 'gemma3:4b'

function buildSystem({ mode, name, relation }) {
  if (mode === 'haunting') {
    return `You are the ghost of this house. Speak in first person, eerie and quiet, 2-4 short sentences.
Refer to what you see in the photo and to the reading of the house if given.
Never invent a detailed biography. Never be gory, cruel or threatening.`
  }
  const who = name ? `${name}${relation ? `, the visitor's ${relation}` : ''}` : 'someone the visitor loves and remembers'
  return `You are the gentle echo of ${who}, speaking from an ofrenda on Día de los Muertos.
Speak in first person, warm and brief (2-4 sentences). You are a memory, not a claim of being the real person.
Refer to what you see in the photo and to the visitor's own words. Do not invent facts, dates or events they did not give you.
Be tender. Never be cruel, and never frighten the visitor.`
}

// Streams the reply token by token so the UI can show it as it is spoken.
export async function* streamGemma({ events, question, prediction, photoPath, memory, mode, name, relation }) {
  const past = (memory || [])
    .map((m) => `Visitor asked: "${m.question || ''}" and you answered: "${m.reply || ''}"`)
    .join('\n')

  const traces = (events || [])
    .map((e) => [e.date, e.room, e.event, e.notes].filter(Boolean).join(", "))
    .join("\n")

  const userText = `Traces left in the house:
${traces || "none"}
Reading of the house: ${prediction ? prediction.message : 'none'}
${past ? `Earlier in your conversations:\n${past}\n` : ''}The visitor says: ${question || 'Speak.'}`

  const userMessage = { role: 'user', content: userText }
  if (photoPath) {
    userMessage.images = [fs.readFileSync(photoPath).toString('base64')]
  }

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(180000),
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      keep_alive: '30m',
      options: { temperature: 0.8, num_predict: 200 },
      messages: [{ role: 'system', content: buildSystem({ mode, name, relation }) }, userMessage],
    }),
  })

  if (!res.ok || !res.body) throw new Error(`Ollama error ${res.status}`)

  const decoder = new TextDecoder()
  let buf = ''
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line) continue
      const part = JSON.parse(line)
      if (part.message && part.message.content) yield part.message.content
    }
  }
}
