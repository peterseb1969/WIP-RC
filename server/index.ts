import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import session from 'express-session'
import { wipProxy } from '@wip/proxy'
import { initAuth, requireAuth, handleCallback, handleLogout } from './auth.js'
import mongoRouter from './infra/mongo.js'
import natsRouter from './infra/nats.js'
import nlRouter from './nl/query.js'

const PORT = parseInt(process.env.PORT || '3010')
const app = express()

app.use(cors())
app.use(express.json())

// Session (required for OIDC auth)
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
}))

// Auth routes
app.get('/auth/callback', (req, res) => { handleCallback(req, res) })
app.get('/auth/logout', handleLogout)
app.use(requireAuth())

// Health
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rc-console' })
})

// WIP API proxy — frontend uses @wip/client with baseUrl: '/wip'
app.use('/wip', wipProxy({
  baseUrl: process.env.WIP_BASE_URL || 'https://localhost:8443',
  apiKey: process.env.WIP_API_KEY || '',
}))

// Infrastructure routes
app.use('/api/infra/mongo', mongoRouter)
app.use('/api/infra/nats', natsRouter)

// NL Query — Claude API with WIP tool calls
app.use('/api/nl', nlRouter)

// User info
app.get('/api/me', (req, res) => {
  if (req.session.user) {
    res.json(req.session.user)
  } else {
    res.json({ anonymous: true })
  }
})

async function main() {
  await initAuth()
  app.listen(PORT, () => {
    console.log(`rc-console backend listening on http://localhost:${PORT}`)
  })
}

main().catch(err => {
  console.error('Failed to start:', err)
  process.exit(1)
})
