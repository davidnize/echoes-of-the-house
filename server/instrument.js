// Loaded first via `node --import ./instrument.js` so Sentry can hook into ESM.
import 'dotenv/config'
import * as Sentry from '@sentry/node'

const dsn = process.env.SENTRY_DSN
if (dsn && dsn.startsWith('https://')) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
  })
}
