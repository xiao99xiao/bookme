#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: './backend/.env' })

// Initialize Supabase client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function updateBookingStatus() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2)
    if (args.length !== 2) {
      console.log('Usage: node manual-update-booking.js <booking_id> <new_status>')
      console.log('Example: node manual-update-booking.js "406eb770-a93c-43ed-9852-9f86cab0c400" "cancelled"')
      console.log('Valid statuses: pending_payment, paid, confirmed, in_progress, completed, cancelled, refunded')
      return
    }
    
    const [bookingId, newStatus] = args
    
    // Validate status
    const validStatuses = ['pending_payment', 'paid', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded']
    if (!validStatuses.includes(newStatus)) {
      console.error('❌ Invalid status. Valid statuses:', validStatuses.join(', '))
      return
    }
    
    console.log(`🔍 Updating booking ${bookingId} to status: ${newStatus}`)
    
    // First check if booking exists
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('id, status, total_price, blockchain_booking_id')
      .eq('id', bookingId)
      .single()
    
    if (fetchError || !booking) {
      console.error('❌ Booking not found:', fetchError?.message || 'No booking with that ID')
      return
    }
    
    console.log('📋 Current booking info:')
    console.log('  Current status:', booking.status)
    console.log('  Total price:', booking.total_price)
    console.log('  Blockchain ID:', booking.blockchain_booking_id || 'None')
    
    if (booking.status === newStatus) {
      console.log('✅ Booking already has the target status. No update needed.')
      return
    }
    
    // Update the booking
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
    
    if (updateError) {
      console.error('❌ Update failed:', updateError.message)
    } else {
      console.log(`✅ Successfully updated booking ${bookingId} to ${newStatus}`)
    }
    
  } catch (error) {
    console.error('❌ Script error:', error.message)
  }
}

updateBookingStatus().catch(console.error)