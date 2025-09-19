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
dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, provider);

async function debugCompleteService() {
  const bookingId = '0x50a8a7a03f0726a791bfcee07c98260e03d94d0bbcdd1d82025b760c1789e0f1';

  console.log('🔍 Debugging completeService() call...\n');
  console.log('📋 Booking ID:', bookingId);
  console.log('📋 Booking ID type:', typeof bookingId);
  console.log('📋 Booking ID bytes32 format:', bookingId);

  // First, double-check the booking status directly
  const booking = await contract.bookings(bookingId);
  console.log('\n📊 Direct contract call to bookings():');
  console.log('   Status code:', Number(booking.status));
  console.log('   Status name:', ['PENDING', 'PAID', 'COMPLETED', 'CANCELLED'][booking.status]);

  // Check if the booking might be completed already
  if (Number(booking.status) === 2) {
    console.log('\n❌ FOUND THE ISSUE: Booking is ALREADY COMPLETED!');
    console.log('   You cannot complete a booking twice.');
    return;
  }

  // Try different ways of encoding the booking ID
  console.log('\n🔧 Testing different parameter formats...');

  const wallet = new ethers.Wallet(process.env.BACKEND_SIGNER_PRIVATE_KEY, provider);
  const contractWithSigner = contract.connect(wallet);

  // Test 1: Direct string (what we're currently using)
  try {
    console.log('\n1️⃣ Testing with string:', bookingId);
    await contractWithSigner.completeService.estimateGas(bookingId);
    console.log('   ✅ Success!');
  } catch (error) {
    console.log('   ❌ Failed:', error.reason || error.message);
  }

  // Test 2: Ensure it's properly formatted as bytes32
  try {
    const bytes32Id = ethers.zeroPadValue(bookingId, 32);
    console.log('\n2️⃣ Testing with padded bytes32:', bytes32Id);
    await contractWithSigner.completeService.estimateGas(bytes32Id);
    console.log('   ✅ Success!');
  } catch (error) {
    console.log('   ❌ Failed:', error.reason || error.message);
  }

  // Test 3: Check what the actual contract function expects
  console.log('\n📝 Contract function signature:');
  const fragment = contract.interface.getFunction('completeService');
  console.log('   Name:', fragment.name);
  console.log('   Inputs:', fragment.inputs.map(i => `${i.name}: ${i.type}`));

  // Check if there's a timing issue - maybe booking was JUST paid
  const latestBlock = await provider.getBlockNumber();
  console.log('\n⏰ Current block number:', latestBlock);

  // Get all events for this booking to see its history
  console.log('\n📜 Checking booking event history...');

  const createdFilter = contract.filters.BookingCreatedAndPaid(bookingId);
  const createdEvents = await contract.queryFilter(createdFilter, 0, 'latest');

  if (createdEvents.length > 0) {
    console.log('   ✅ BookingCreatedAndPaid event found:');
    console.log('      Block:', createdEvents[0].blockNumber);
    console.log('      Tx:', createdEvents[0].transactionHash);
  }

  const completedFilter = contract.filters.ServiceCompleted(bookingId);
  const completedEvents = await contract.queryFilter(completedFilter, 0, 'latest');

  if (completedEvents.length > 0) {
    console.log('   ⚠️ ServiceCompleted event found:');
    console.log('      Block:', completedEvents[0].blockNumber);
    console.log('      Tx:', completedEvents[0].transactionHash);
    console.log('   THIS BOOKING WAS ALREADY COMPLETED!');
  }
}

debugCompleteService().then(() => {
  console.log('\n✅ Debug complete');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});