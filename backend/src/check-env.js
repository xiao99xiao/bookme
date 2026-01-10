import dotenv from 'dotenv'
import { existsSync } from 'fs'

// Try to load from backend's .env file
if (existsSync('.env')) {
  dotenv.config({ path: '.env' })
}

// Check required environment variables (backend uses no VITE_ prefix)
// Note: DATABASE_URL replaces SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY for Railway PostgreSQL
const required = [
  'DATABASE_URL',
  'PRIVY_APP_ID',
  'PRIVY_APP_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET'
]

const missing = required.filter(key => !process.env[key])

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:')
  missing.forEach(key => {
    console.error(`   - ${key}`)
  })
  
  if (missing.includes('PRIVY_APP_SECRET')) {
    console.error('\n📝 To get your PRIVY_APP_SECRET:')
    console.error('   1. Go to https://dashboard.privy.io')
    console.error('   2. Click on your app')
    console.error('   3. Go to Settings → API Keys')
    console.error('   4. Copy the "App Secret"')
    console.error('   5. Add to backend/.env: PRIVY_APP_SECRET=your-secret-here')
  }
  
  process.exit(1)
}

console.log('✅ All environment variables are set')
console.log('📦 Starting server...')