/**
 * Cancellation Policies Helper Functions
 * Handles advanced cancellation logic with policies, conditions, and refund calculations
 */

import { supabaseAdmin } from './supabase-admin.js';

/**
 * Get all applicable cancellation policies for a booking
 * @param {string} bookingId - The booking ID
 * @param {string} userId - The user requesting cancellation
 * @returns {Promise<Array>} Array of applicable policies
 */
export async function getApplicableCancellationPolicies(bookingId, userId) {
  try {
    // First, get the booking details
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Verify user is authorized to cancel this booking
    if (booking.customer_id !== userId && booking.provider_id !== userId) {
      throw new Error('Unauthorized to cancel this booking');
    }

    // Determine user role
    const isProvider = booking.provider_id === userId;
    const isCustomer = booking.customer_id === userId;

    // Calculate time until booking start
    const now = new Date();
    const bookingStart = new Date(booking.scheduled_at);
    const minutesUntilStart = Math.floor((bookingStart.getTime() - now.getTime()) / (1000 * 60));

    // Get all active policies with their conditions
    const { data: policies, error: policiesError } = await supabaseAdmin
      .from('cancellation_policies')
      .select(`
        *,
        cancellation_policy_conditions (*)
      `)
      .eq('is_active', true);

    if (policiesError) {
      throw new Error('Failed to fetch cancellation policies');
    }

    // Filter policies based on conditions and user role
    const applicablePolicies = [];

    for (const policy of policies) {
      const conditions = policy.cancellation_policy_conditions || [];
      let isApplicable = true;

      // Check each condition
      for (const condition of conditions) {
        switch (condition.condition_type) {
          case 'booking_status':
            if (booking.status !== condition.condition_value) {
              isApplicable = false;
            }
            break;

          case 'min_time_before_start':
            const minMinutes = parseInt(condition.condition_value);
            if (minutesUntilStart < minMinutes) {
              isApplicable = false;
            }
            break;

          case 'max_time_before_start':
            const maxMinutes = parseInt(condition.condition_value);
            if (minutesUntilStart >= maxMinutes) {
              isApplicable = false;
            }
            break;

          case 'time_before_start':
            const exactMinutes = parseInt(condition.condition_value);
            if (minutesUntilStart !== exactMinutes) {
              isApplicable = false;
            }
            break;
        }

        if (!isApplicable) break;
      }

      // Additional role-based filtering
      if (isApplicable) {
        // Customer no-show can only be triggered by providers
        if (policy.reason_key === 'customer_no_show' && !isProvider) {
          isApplicable = false;
        }

        // Customer cancellations can only be triggered by customers
        if (policy.reason_key.startsWith('customer_') && policy.reason_key !== 'customer_no_show' && !isCustomer) {
          isApplicable = false;
        }

        // Provider cancellations can only be triggered by providers
        if (policy.reason_key === 'provider_cancel' && !isProvider) {
          isApplicable = false;
        }
      }

      if (isApplicable) {
        applicablePolicies.push({
          ...policy,
          minutesUntilStart,
          userRole: isProvider ? 'provider' : 'customer'
        });
      }
    }

    return applicablePolicies;
  } catch (error) {
    console.error('Error getting applicable cancellation policies:', error);
    throw error;
  }
}

/**
 * Calculate refund breakdown for a specific policy
 * @param {string} bookingId - The booking ID
 * @param {string} policyId - The policy ID to apply
 * @returns {Promise<Object>} Refund breakdown object
 */
export async function calculateRefundBreakdown(bookingId, policyId) {
  try {
    // Get booking details
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('total_price, service_fee')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Get policy details
    const { data: policy, error: policyError } = await supabaseAdmin
      .from('cancellation_policies')
      .select('*')
      .eq('id', policyId)
      .eq('is_active', true)
      .single();

    if (policyError || !policy) {
      throw new Error('Cancellation policy not found');
    }

    const totalAmount = parseFloat(booking.total_price);
    const originalServiceFee = parseFloat(booking.service_fee || 0);

    // Calculate amounts based on policy percentages
    const customerRefundAmount = Math.round((totalAmount * policy.customer_refund_percentage / 100) * 100) / 100;
    const providerEarningsAmount = Math.round((totalAmount * policy.provider_earnings_percentage / 100) * 100) / 100;
    const platformFeeAmount = Math.round((totalAmount * policy.platform_fee_percentage / 100) * 100) / 100;

    return {
      policyId: policy.id,
      policyTitle: policy.reason_title,
      policyDescription: policy.reason_description,
      requiresExplanation: policy.requires_explanation,
      totalAmount,
      originalServiceFee,
      breakdown: {
        customerRefund: customerRefundAmount,
        providerEarnings: providerEarningsAmount,
        platformFee: platformFeeAmount
      },
      percentages: {
        customerRefundPercentage: policy.customer_refund_percentage,
        providerEarningsPercentage: policy.provider_earnings_percentage,
        platformFeePercentage: policy.platform_fee_percentage
      }
    };
  } catch (error) {
    console.error('Error calculating refund breakdown:', error);
    throw error;
  }
}

/**
 * Process a booking cancellation with policy
 * @param {string} bookingId - The booking ID
 * @param {string} userId - The user cancelling
 * @param {string} policyId - The policy ID to apply
 * @param {string} explanation - Optional explanation (required if policy requires it)
 * @returns {Promise<Object>} Updated booking object
 */
export async function processCancellation(bookingId, userId, policyId, explanation = null) {
  try {
    // Verify the policy is applicable
    const applicablePolicies = await getApplicableCancellationPolicies(bookingId, userId);
    const selectedPolicy = applicablePolicies.find(p => p.id === policyId);

    if (!selectedPolicy) {
      throw new Error('Selected cancellation policy is not applicable to this booking');
    }

    // Validate explanation if required
    if (selectedPolicy.requires_explanation && (!explanation || explanation.trim() === '')) {
      throw new Error('An explanation is required for this type of cancellation');
    }

    // Calculate refund breakdown
    const refundBreakdown = await calculateRefundBreakdown(bookingId, policyId);

    // Update booking with cancellation details
    const { data: updatedBooking, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancellation_policy_id: policyId,
        cancellation_reason: selectedPolicy.reason_title,
        cancellation_explanation: explanation,
        refund_amount: refundBreakdown.breakdown.customerRefund,
        provider_earnings: refundBreakdown.breakdown.providerEarnings,
        platform_fee: refundBreakdown.breakdown.platformFee
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) {
      console.error('Booking cancellation update error:', updateError);
      throw new Error('Failed to process cancellation');
    }

    // TODO: Process actual refund/payments here
    // This would integrate with payment processing to handle:
    // - Refunding customer
    // - Paying provider (if applicable)
    // - Recording platform fees

    // TODO: Send notifications to both parties
    // This would trigger email/push notifications about the cancellation

    // TODO: Delete meeting link if exists
    // This would clean up any generated meeting links

    return {
      booking: updatedBooking,
      refundBreakdown,
      policy: selectedPolicy
    };
  } catch (error) {
    console.error('Error processing cancellation:', error);
    throw error;
  }
}

/**
 * Get cancellation policy by ID
 * @param {string} policyId - The policy ID
 * @returns {Promise<Object>} Policy object
 */
export async function getCancellationPolicy(policyId) {
  try {
    const { data: policy, error } = await supabaseAdmin
      .from('cancellation_policies')
      .select('*')
      .eq('id', policyId)
      .eq('is_active', true)
      .single();

    if (error || !policy) {
      throw new Error('Cancellation policy not found');
    }

    return policy;
  } catch (error) {
    console.error('Error getting cancellation policy:', error);
    throw error;
  }
}

/**
 * Validate cancellation policy selection
 * @param {string} bookingId - The booking ID
 * @param {string} userId - The user ID
 * @param {string} policyId - The policy ID
 * @returns {Promise<boolean>} True if valid
 */
export async function validatePolicySelection(bookingId, userId, policyId) {
  try {
    const applicablePolicies = await getApplicableCancellationPolicies(bookingId, userId);
    return applicablePolicies.some(policy => policy.id === policyId);
  } catch (error) {
    console.error('Error validating policy selection:', error);
    return false;
  }
}