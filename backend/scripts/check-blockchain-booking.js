#!/usr/bin/env node

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contractABI = JSON.parse(readFileSync(join(__dirname, '../src/contract-abi.json'), 'utf8'));

// Load environment variables
dotenv.config({ path: '../.env' });
dotenv.config(); // Also load from backend/.env

const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, provider);

async function checkBookingOnChain(blockchainBookingId) {
  console.log('🔍 Checking blockchain state for booking:', blockchainBookingId);
  console.log('📡 RPC URL:', process.env.BLOCKCHAIN_RPC_URL);
  console.log('📝 Contract:', process.env.CONTRACT_ADDRESS);
  console.log('');

  try {
    const booking = await contract.bookings(blockchainBookingId);

    // Status enum: 0=PENDING, 1=PAID, 2=COMPLETED, 3=CANCELLED
    const statusNames = ['PENDING', 'PAID', 'COMPLETED', 'CANCELLED'];
    const statusCode = Number(booking.status);

    console.log('✅ BOOKING EXISTS ON BLOCKCHAIN!');
    console.log('=====================================');
    console.log('📋 Booking ID:', booking.id || blockchainBookingId);
    console.log('👤 Customer:', booking.customer);
    console.log('🛠️  Provider:', booking.provider);
    console.log('👥 Inviter:', booking.inviter);
    console.log('💰 Amount:', ethers.formatUnits(booking.amount, 6), 'USDC');
    console.log('🏢 Platform Fee Rate:', Number(booking.platformFeeRate) / 100, '%');
    console.log('👥 Inviter Fee Rate:', Number(booking.inviterFeeRate) / 100, '%');
    console.log('📅 Created At:', new Date(Number(booking.createdAt) * 1000).toISOString());
    console.log('');
    console.log('🚦 STATUS CODE:', statusCode);
    console.log('🚦 STATUS NAME:', statusNames[statusCode]);
    console.log('=====================================');

    // Diagnose the issue
    if (statusCode === 0) {
      console.log('');
      console.log('❌ PROBLEM FOUND: Booking is in PENDING status!');
      console.log('   This means the payment was NOT processed correctly.');
      console.log('   The createAndPayBooking() transaction may have failed.');
      console.log('');
      console.log('🔧 SOLUTION:');
      console.log('   1. Check if payment transaction actually succeeded on explorer');
      console.log('   2. If payment failed, customer needs to pay again');
      console.log('   3. If payment succeeded but status is wrong, there\'s a contract bug');
    } else if (statusCode === 1) {
      console.log('');
      console.log('✅ Booking is in PAID status - ready for completion!');
      console.log('   The completeService() call should work.');
      console.log('   If it\'s failing, check the transaction sender address.');
    } else if (statusCode === 2) {
      console.log('');
      console.log('⚠️  Booking is already COMPLETED!');
      console.log('   Cannot complete an already completed booking.');
    } else if (statusCode === 3) {
      console.log('');
      console.log('❌ Booking is CANCELLED!');
      console.log('   Cannot complete a cancelled booking.');
    }

    return booking;
  } catch (error) {
    console.log('❌ ERROR: Booking does NOT exist on blockchain!');
    console.log('   Blockchain Booking ID:', blockchainBookingId);
    console.log('');
    console.log('🔍 This means either:');
    console.log('   1. The booking was never created on-chain');
    console.log('   2. The booking ID is wrong');
    console.log('   3. Wrong contract or network');
    console.log('');
    console.log('Error details:', error.message);
    return null;
  }
}

// Run the check
const bookingId = '0x50a8a7a03f0726a791bfcee07c98260e03d94d0bbcdd1d82025b760c1789e0f1';
checkBookingOnChain(bookingId).then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});