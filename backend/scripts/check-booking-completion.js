#!/usr/bin/env node

/**
 * Manual Booking Completion Checker
 *
 * Usage: node scripts/check-booking-completion.js <booking-id>
 *
 * This script checks for ServiceCompleted events for a specific booking
 * and updates the database if found.
 */

import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import contractABI from "../src/contract-abi.json" with { type: "json" };

// Load environment variables
dotenv.config({ path: '../.env' });
dotenv.config(); // Also load from backend/.env

// Validate required environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CONTRACT_ADDRESS',
  'BLOCKCHAIN_RPC_URL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize Supabase client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Initialize blockchain provider and contract
const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  contractABI,
  provider
);

async function checkBookingCompletion(bookingId) {
  console.log(`\n🔍 Checking completion status for booking: ${bookingId}\n`);

  try {
    // 1. Fetch booking from database
    console.log(`📊 Fetching booking details...`);
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(`
        *,
        services!inner(id, title, provider_id),
        users!bookings_customer_id_fkey(display_name, email),
        provider:users!bookings_provider_id_fkey(display_name, wallet_address)
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      console.error(`❌ Booking not found: ${bookingId}`);
      console.error(bookingError);
      return;
    }

    console.log(`📋 Booking found:`);
    console.log(`   - Status: ${booking.status}`);
    console.log(`   - Blockchain ID: ${booking.blockchain_booking_id}`);
    console.log(`   - Provider: ${booking.provider.display_name}`);
    console.log(`   - Customer: ${booking.users.display_name}`);
    console.log(`   - Service: ${booking.services.title}`);
    console.log(`   - Total Price: $${booking.total_price}`);

    if (booking.status === 'completed') {
      console.log(`\n✅ Booking is already marked as completed`);
      if (booking.completion_tx_hash) {
        console.log(`   Transaction: ${booking.completion_tx_hash}`);
      }
      return;
    }

    if (!booking.blockchain_booking_id) {
      console.error(`❌ Booking has no blockchain_booking_id`);
      return;
    }

    // 2. Check for ServiceCompleted events on blockchain
    console.log(`\n🔗 Checking blockchain for ServiceCompleted events...`);
    const filter = contract.filters.ServiceCompleted(booking.blockchain_booking_id);
    const currentBlock = await provider.getBlockNumber();

    // Check different block ranges
    const blockRanges = [
      { from: currentBlock - 10, to: currentBlock, label: "Last 10 blocks (~20 seconds)" },
      { from: currentBlock - 50, to: currentBlock, label: "Last 50 blocks (~100 seconds)" },
      { from: currentBlock - 500, to: currentBlock, label: "Last 500 blocks (~17 minutes)" },
      { from: 0, to: currentBlock, label: "All blocks (entire history)" }
    ];

    let eventFound = null;

    for (const range of blockRanges) {
      console.log(`   Checking ${range.label}...`);
      const events = await contract.queryFilter(filter, range.from, range.to);

      if (events.length > 0) {
        eventFound = events[0];
        console.log(`   ✅ Found ${events.length} event(s) in ${range.label}`);
        break;
      }
    }

    if (!eventFound) {
      console.log(`\n❌ No ServiceCompleted events found for this booking`);
      console.log(`   The booking may not have been completed on-chain yet`);
      return;
    }

    // 3. Process the event
    console.log(`\n🎯 ServiceCompleted event found!`);
    console.log(`   - Transaction: ${eventFound.transactionHash}`);
    console.log(`   - Block: ${eventFound.blockNumber}`);
    console.log(`   - Provider Amount: ${ethers.formatUnits(eventFound.args.providerAmount, 6)} USDC`);
    console.log(`   - Platform Fee: ${ethers.formatUnits(eventFound.args.platformFee, 6)} USDC`);

    // 4. Update booking status
    console.log(`\n📝 Updating booking status to completed...`);
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completion_tx_hash: eventFound.transactionHash,
      })
      .eq("id", bookingId);

    if (updateError) {
      console.error(`❌ Failed to update booking status:`, updateError);
      return;
    }

    console.log(`✅ Booking status updated to completed`);

    // 5. Create transaction record for provider earnings
    const netAmount = parseFloat(ethers.formatUnits(eventFound.args.providerAmount, 6));
    const customerName = booking.users.display_name || booking.users.email?.split('@')[0] || 'Unknown Customer';
    const serviceTitle = booking.services.title;

    console.log(`\n💰 Creating transaction record...`);
    const { error: transactionError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: booking.provider_id,
        type: "booking_payment",
        amount: netAmount,
        description: serviceTitle,
        booking_id: bookingId,
        created_at: new Date().toISOString(),
        metadata: {
          customer_name: customerName,
          service_title: serviceTitle,
          blockchain_tx_hash: eventFound.transactionHash,
          platform_fee: parseFloat(ethers.formatUnits(eventFound.args.platformFee, 6))
        }
      });

    if (transactionError) {
      console.error(`⚠️ Failed to create transaction record:`, transactionError);
    } else {
      console.log(`✅ Transaction record created`);
    }

    // 6. Update provider's total earnings
    console.log(`\n📊 Updating provider total earnings...`);
    const { data: currentProvider, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("total_earnings")
      .eq("id", booking.provider_id)
      .single();

    if (!fetchError && currentProvider) {
      const newTotalEarnings = (currentProvider.total_earnings || 0) + netAmount;

      const { error: earningsError } = await supabaseAdmin
        .from("users")
        .update({ total_earnings: newTotalEarnings })
        .eq("id", booking.provider_id);

      if (earningsError) {
        console.error(`⚠️ Failed to update provider earnings:`, earningsError);
      } else {
        console.log(`✅ Provider earnings updated: $${newTotalEarnings.toFixed(2)}`);
      }
    }

    console.log(`\n🎉 Booking completion processed successfully!`);

  } catch (error) {
    console.error(`\n❌ Error checking booking completion:`, error);
    console.error(error.stack);
  }
}

// Main execution
const bookingId = process.argv[2];

if (!bookingId) {
  console.error(`
❌ Missing booking ID

Usage: node scripts/check-booking-completion.js <booking-id>

Example: node scripts/check-booking-completion.js cf63763c-ffd1-4f60-8487-f2fe59acd3dc
`);
  process.exit(1);
}

// Run the check
checkBookingCompletion(bookingId).then(() => {
  console.log(`\n✅ Script completed`);
  process.exit(0);
}).catch(error => {
  console.error(`\n❌ Script failed:`, error);
  process.exit(1);
});