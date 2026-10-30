import express from 'express'
import * as Sentry from '@sentry/node'
import { runTabPFN } from '../services/tabpfn.js'

const router = express.Router()

const SAMPLE_EVENTS = [
  { date: '1987-10-31', room: 'living room', event: 'lights flickered', notes: 'candle almost went out' },
  { date: '1992-11-02', room: 'kitchen', event: 'door opened', notes: 'no one was home' },
  { date: '2001-10-31', room: 'hallway', event: 'footsteps', notes: 'stopped at the photo wall' },
]

router.post('/analyze', async (req, res) => {
  try {
    const events = req.body.events && req.body.events.length ? req.body.events : SAMPLE_EVENTS
    const prediction = await Sentry.startSpan(
      { name: 'tabpfn.read_traces', op: 'ai.run' },
      () => runTabPFN(events)
    )
    res.json({ prediction, eventsUsed: events.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Analysis failed' })
  }
})

export default router
