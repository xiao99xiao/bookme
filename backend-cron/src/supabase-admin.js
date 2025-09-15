import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables from multiple locations
// Load in reverse priority order (later configs override earlier ones)
dotenv.config({ path: '../.env.local' }); // Load from root .env.local (lowest priority)
dotenv.config({ path: '../backend/.env' }); // Load from backend/.env (medium priority)
dotenv.config(); // Load from backend-cron/.env (highest priority - overrides others)

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