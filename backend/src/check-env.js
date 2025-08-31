import dotenv from 'dotenv'
import { existsSync } from 'fs'

// Try to load from parent directory's .env.local
if (existsSync('../.env.local')) {
  dotenv.config({ path: '../.env.local' })
}

// Check required environment variables
const required = [
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY', 
  'VITE_PRIVY_APP_ID',
  'PRIVY_APP_SECRET'
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
    console.error('   5. Add to .env.local: PRIVY_APP_SECRET=your-secret-here')
  }
  
  process.exit(1)
}

console.log('✅ All environment variables are set')
console.log('📦 Starting server...')