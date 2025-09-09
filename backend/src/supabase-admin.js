import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables (local development only)
dotenv.config({ path: '.env' })

// Initialize Supabase admin client with service role key
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)