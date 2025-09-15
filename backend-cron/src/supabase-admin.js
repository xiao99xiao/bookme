import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables from multiple locations
dotenv.config(); // Load from backend-cron/.env
dotenv.config({ path: '../backend/.env' }); // Load from backend/.env
dotenv.config({ path: '../.env.local' }); // Load from root .env.local

// Initialize Supabase admin client with service role key
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)