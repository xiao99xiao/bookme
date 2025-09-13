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
}