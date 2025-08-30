import { serve } from '@hono/node-server'
import { readFileSync } from 'fs'
import { createServer } from 'https'
import app from './index.js'

const port = process.env.PORT || 4443

// Read SSL certificates
const serverOptions = {
  cert: readFileSync('../certs/cert.pem'),
  key: readFileSync('../certs/key.pem')
}

console.log(`🔐 Starting HTTPS server on port ${port}...`)

// Create HTTPS server
const server = serve({
  fetch: app.fetch,
  port: port,
  createServer: (options, requestListener) => {
    return createServer(serverOptions, requestListener)
  }
}, (info) => {
  console.log(`✅ HTTPS Server running at https://localhost:${info.port}`)
  console.log(`📝 Health check: https://localhost:${info.port}/health`)
})

// Setup WebSocket if needed
import { setupWebSocket } from './websocket.js'
setupWebSocket(server)