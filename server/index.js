import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import * as Sentry from '@sentry/node'

import analyzeRouter from './routes/analyze.js'
import chatRouter from './routes/chat.js'
import houseRouter from './routes/house.js'
import speakRouter from './routes/speak.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api', analyzeRouter)
app.use('/api', chatRouter)
app.use('/api', houseRouter)
app.use('/api', speakRouter)

app.get('/health', (req, res) => res.json({ ok: true }))

// Must come after the routes. Safe to call even if Sentry isn't initialised.
Sentry.setupExpressErrorHandler(app)

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on ${PORT}`))
