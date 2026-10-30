import express from 'express'
import fs from 'fs'
import multer from 'multer'
import * as Sentry from '@sentry/node'
import { streamGemma } from '../services/gemma.js'
import { getMemory, saveMemory } from '../services/backboard.js'

const router = express.Router()
const upload = multer({ dest: 'uploads/' })

router.post('/chat', upload.single('photo'), async (req, res) => {
  const photoPath = req.file ? req.file.path : null
  let started = false
  try {
    const { question, name, relation, mode } = req.body
    let events = []
    try {
      events = req.body.events ? JSON.parse(req.body.events) : []
    } catch {
      events = []
    }

    let prediction = null
    try {
      prediction = req.body.prediction ? JSON.parse(req.body.prediction) : null
    } catch {
      prediction = null
    }

    await Sentry.startSpan({ name: 'ghost.encounter', op: 'ai.agent' }, async () => {
      const memory = await Sentry.startSpan(
        { name: 'backboard.get_memory', op: 'ai.memory' },
        () => getMemory()
      )

      let full = ''
      await Sentry.startSpan({ name: 'gemma.speak', op: 'ai.run' }, async () => {
        for await (const token of streamGemma({ events, question, prediction, photoPath, memory, mode, name, relation })) {
          if (!started) {
            res.status(200)
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.setHeader('Cache-Control', 'no-cache')
            res.flushHeaders()
            started = true
          }
          full += token
          res.write(token)
        }
      })

      if (full.trim()) {
        await Sentry.startSpan(
          { name: 'backboard.save_memory', op: 'ai.memory' },
          () => saveMemory({ question, reply: full.trim(), prediction })
        )
      }
    })

    if (started) res.end()
    else res.status(502).json({ error: 'The ghost said nothing' })
  } catch (err) {
    console.error(err)
    if (started) res.end()
    else res.status(500).json({ error: 'The ghost is quiet right now' })
  } finally {
    // Photos are personal: delete the uploaded copy once the encounter is over
    if (photoPath) fs.unlink(photoPath, () => {})
  }
})

export default router
