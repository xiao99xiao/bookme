import { serve } from '@hono/node-server'
import { readFileSync } from 'fs'
import { createServer } from 'https'
import app from './index.js'
import { memoryProfiler } from './utils/memory-profiler.js'

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

  // Start 5-minute memory profiling session
  setTimeout(() => {
    console.log('🔍 Starting 5-minute memory profiling session...')
    memoryProfiler.start(10000, 300000) // 10s interval, 5min duration
  }, 5000) // Wait 5 seconds for server to fully initialize
})

// Setup WebSocket if needed
import { setupWebSocket } from './websocket.js'
setupWebSocket(server)