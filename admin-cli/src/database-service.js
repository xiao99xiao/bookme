import { createClient } from '@supabase/supabase-js'

export class DatabaseService {
  constructor() {
    this.SUPABASE_URL = process.env.SUPABASE_URL
    this.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!this.SUPABASE_URL || !this.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    }
    
    this.supabase = createClient(this.SUPABASE_URL, this.SUPABASE_SERVICE_ROLE_KEY)
    console.log('💾 Database service initialized')
  }

  /**
   * Get booking details from database by blockchain booking ID
   */
  async getBookingByBlockchainId(blockchainBookingId) {
    try {
      const { data, error } = await this.supabase
        .from('bookings')
        .select(`
          id,
          status,
          scheduled_at,
          duration_minutes,
          total_price,
          service_fee,
          customer_notes,
          location,
          is_online,
          blockchain_booking_id,
          created_at,
          services!inner(
            title,
            description,
            price
          ),
          customers:customer_id(
            display_name,
            username
          ),
          providers:provider_id(
            display_name,
            username
          )
        `)
        .eq('blockchain_booking_id', blockchainBookingId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null // Booking not found
        }
        throw error
      }

      return data
    } catch (error) {
      console.error('❌ Error fetching booking from database:', error)
      throw error
    }
  }

  /**
   * Get all bookings that have blockchain integration (paid status)
   */
  async getAllBlockchainBookings() {
    try {
      const { data, error } = await this.supabase
        .from('bookings')
        .select(`
          id,
          status,
          scheduled_at,
          duration_minutes,
          total_price,
          service_fee,
          customer_notes,
          location,
          is_online,
          blockchain_booking_id,
          payment_tx_hash,
          completion_tx_hash,
          created_at,
          services!inner(
            title,
            description,
            price
          ),
          customers:customer_id(
            display_name,
            username
          ),
          providers:provider_id(
            display_name,
            username
          )
        `)
        .not('blockchain_booking_id', 'is', null)
        .in('status', ['paid', 'confirmed', 'ongoing'])
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      console.log(`📊 Found ${data?.length || 0} blockchain bookings in database`)
      return data || []
    } catch (error) {
      console.error('❌ Error fetching blockchain bookings:', error)
      throw error
    }
  }

  /**
   * Get enhanced booking details for active bookings
   */
  async getEnhancedBookingDetails(blockchainBookings) {
    try {
      const enhancedBookings = []
      
      for (const booking of blockchainBookings) {
        const dbBooking = await this.getBookingByBlockchainId(booking.blockchainId)
        
        if (dbBooking) {
          enhancedBookings.push({
            ...booking,
            database: {
              id: dbBooking.id,
              status: dbBooking.status,
              scheduledAt: dbBooking.scheduled_at,
              durationMinutes: dbBooking.duration_minutes,
              totalPrice: dbBooking.total_price,
              serviceFee: dbBooking.service_fee,
              customerNotes: dbBooking.customer_notes,
              location: dbBooking.location,
              isOnline: dbBooking.is_online,
              service: dbBooking.services,
              customer: dbBooking.customers,
              provider: dbBooking.providers,
              createdAt: dbBooking.created_at
            }
          })
        } else {
          // Blockchain booking exists but not in database
          enhancedBookings.push({
            ...booking,
            database: null,
            warning: 'Booking exists on blockchain but not found in database'
          })
        }
      }
      
      return enhancedBookings
    } catch (error) {
      console.error('❌ Error enhancing booking details:', error)
      throw error
    }
  }

  /**
   * Update booking status in database after cancellation
   */
  async updateBookingStatus(blockchainBookingId, status, cancellationTxHash) {
    try {
      const { error } = await this.supabase
        .from('bookings')
        .update({
          status: status,
          cancellation_tx_hash: cancellationTxHash,
          updated_at: new Date().toISOString()
        })
        .eq('blockchain_booking_id', blockchainBookingId)

      if (error) {
        throw error
      }

      console.log(`✅ Updated database status for booking ${blockchainBookingId} to ${status}`)
    } catch (error) {
      console.error('❌ Error updating booking status in database:', error)
      // Don't throw - database update is secondary to blockchain operation
    }
  }

  /**
   * Find booking by transaction hash (payment or completion tx)
   */
  async getBookingByTransactionHash(txHash) {
    try {
      const { data, error } = await this.supabase
        .from('bookings')
        .select(`
          id,
          status,
          scheduled_at,
          duration_minutes,
          total_price,
          service_fee,
          customer_notes,
          location,
          is_online,
          blockchain_booking_id,
          blockchain_tx_hash,
          completion_tx_hash,
          cancellation_tx_hash,
          created_at,
          services!inner(
            title,
            description,
            price
          ),
          customers:customer_id(
            display_name,
            username
          ),
          providers:provider_id(
            display_name,
            username
          )
        `)
        .or(`blockchain_tx_hash.eq.${txHash},completion_tx_hash.eq.${txHash},cancellation_tx_hash.eq.${txHash}`)

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        return null
      }

      // Return first match (should only be one booking per transaction)
      return data[0]
    } catch (error) {
      console.error('❌ Error fetching booking by transaction hash:', error)
      throw error
    }
  }

  /**
   * Mark booking as paid by updating payment transaction hash and status
   */
  async markBookingAsPaid(bookingId, paymentTxHash) {
    try {
      const { error } = await this.supabase
        .from('bookings')
        .update({
          status: 'paid',
          blockchain_tx_hash: paymentTxHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)

      if (error) {
        throw error
      }

      console.log(`✅ Marked booking ${bookingId} as paid with transaction ${paymentTxHash}`)
      return true
    } catch (error) {
      console.error('❌ Error marking booking as paid:', error)
      throw error
    }
  }

  /**
   * Get all completed bookings that don't have transaction records
   */
  async getCompletedBookingsWithoutTransactions() {
    try {
      const { data, error } = await this.supabase
        .from('bookings')
        .select(`
          id,
          status,
          scheduled_at,
          completed_at,
          duration_minutes,
          total_price,
          service_fee,
          customer_notes,
          provider_notes,
          location,
          is_online,
          provider_id,
          customer_id,
          service_id,
          blockchain_booking_id,
          blockchain_tx_hash,
          completion_tx_hash,
          created_at,
          services!inner(
            id,
            title,
            description,
            price
          ),
          customers:customer_id(
            id,
            display_name,
            username
          ),
          providers:provider_id(
            id,
            display_name,
            username
          )
        `)
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        
      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        return []
      }

      // Filter out bookings that already have transaction records
      const completedBookings = []
      for (const booking of data) {
        // Check if transaction record already exists for this booking
        const { data: existingTransaction, error: txError } = await this.supabase
          .from('transactions')
          .select('id')
          .eq('booking_id', booking.id)
          .eq('type', 'booking_payment')
          .limit(1)

        if (txError) {
          console.warn(`⚠️  Error checking existing transaction for booking ${booking.id}:`, txError.message)
          continue
        }

        if (!existingTransaction || existingTransaction.length === 0) {
          completedBookings.push(booking)
        }
      }

      console.log(`📊 Found ${completedBookings.length} completed bookings without transaction records (out of ${data.length} total completed)`)
      return completedBookings
      
    } catch (error) {
      console.error('❌ Error fetching completed bookings:', error)
      throw error
    }
  }

  /**
   * Create a transaction record for a completed booking
   */
  async createTransactionRecord(booking) {
    try {
      // Calculate amounts based on booking price (90% provider, 10% platform)
      const totalPrice = parseFloat(booking.total_price)
      const providerEarnings = totalPrice * 0.9 // 90% to provider
      const platformFee = totalPrice * 0.1 // 10% platform fee
      
      // Create transaction record for provider earnings
      const { data: transactionData, error: transactionError } = await this.supabase
        .from('transactions')
        .insert({
          provider_id: booking.provider_id,
          type: 'booking_payment',
          amount: providerEarnings,
          booking_id: booking.id,
          source_user_id: booking.customer_id,
          service_id: booking.service_id,
          description: `Payment for service: ${booking.services?.title || 'Unknown Service'}`,
          transaction_hash: booking.completion_tx_hash || booking.blockchain_tx_hash,
          created_at: booking.completed_at || booking.created_at,
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (transactionError) {
        console.error('❌ Error creating transaction record:', transactionError)
        return { success: false, error: transactionError.message }
      }

      console.log(`✅ Created transaction record ${transactionData.id} for booking ${booking.id}`)
      console.log(`   💰 Provider earnings: $${providerEarnings.toFixed(2)} for ${booking.providers?.display_name || 'Unknown'}`)
      console.log(`   🏢 Platform fee: $${platformFee.toFixed(2)}`)
      
      return { 
        success: true, 
        transactionId: transactionData.id,
        providerEarnings,
        platformFee
      }
      
    } catch (error) {
      console.error('❌ Error creating transaction record:', error)
      return { success: false, error: error.message }
    }
  }
}