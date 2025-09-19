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

async function findCompletionEvent() {
  const bookingId = '0x50a8a7a03f0726a791bfcee07c98260e03d94d0bbcdd1d82025b760c1789e0f1';

  console.log('🔍 Searching for ServiceCompleted event for booking:', bookingId);
  console.log('📡 This will tell us WHEN the booking was completed on-chain\n');

  try {
    const currentBlock = await provider.getBlockNumber();
    console.log('📋 Current block:', currentBlock);

    // We need to search in small chunks due to Alchemy limits
    const filter = contract.filters.ServiceCompleted(bookingId);

    // Search recent blocks in chunks of 10
    let foundEvent = null;
    const chunkSize = 10;

    console.log('🔍 Searching recent blocks...\n');

    for (let i = 0; i < 1000; i += chunkSize) {
      const fromBlock = currentBlock - i - chunkSize + 1;
      const toBlock = currentBlock - i;

      if (fromBlock < 0) break;

      try {
        console.log(`   Checking blocks ${fromBlock} to ${toBlock}...`);
        const events = await contract.queryFilter(filter, fromBlock, toBlock);

        if (events.length > 0) {
          foundEvent = events[0];
          console.log('\n🎯 FOUND ServiceCompleted event!');
          console.log('=====================================');
          console.log('📋 Transaction Hash:', foundEvent.transactionHash);
          console.log('📋 Block Number:', foundEvent.blockNumber);
          console.log('📋 Block Timestamp:', new Date(await getBlockTimestamp(foundEvent.blockNumber)).toISOString());
          console.log('📋 Provider Amount:', ethers.formatUnits(foundEvent.args.providerAmount, 6), 'USDC');
          console.log('📋 Platform Fee:', ethers.formatUnits(foundEvent.args.platformFee, 6), 'USDC');
          console.log('📋 Inviter Fee:', ethers.formatUnits(foundEvent.args.inviterFee, 6), 'USDC');
          console.log('=====================================');
          break;
        }
      } catch (error) {
        if (error.message.includes('block range')) {
          console.log(`   ⚠️ Hit rate limit, skipping this range`);
          continue;
        }
        throw error;
      }
    }

    if (!foundEvent) {
      console.log('\n❌ No ServiceCompleted event found in recent blocks');
      console.log('   The booking may have been completed much earlier');
      console.log('   or there might be an issue with the event search');
      return null;
    }

    // Now analyze WHY our event monitor missed this
    console.log('\n🔍 ANALYZING WHY EVENT WAS MISSED:');
    console.log('=====================================');

    const completionTime = new Date(await getBlockTimestamp(foundEvent.blockNumber));
    console.log('📅 Completion Time:', completionTime.toISOString());

    // Check if this was recent (last 24 hours)
    const now = new Date();
    const hoursSinceCompletion = (now - completionTime) / (1000 * 60 * 60);

    console.log('⏰ Hours since completion:', hoursSinceCompletion.toFixed(2));

    if (hoursSinceCompletion < 24) {
      console.log('\n❌ RECENT COMPLETION - Event monitor should have caught this!');
      console.log('   Possible causes:');
      console.log('   1. Event monitor was down/crashed');
      console.log('   2. WebSocket connection failed');
      console.log('   3. Event processing queue backed up');
      console.log('   4. Redis connection failed');
      console.log('   5. Database write failed');
    } else {
      console.log('\n⚠️ OLD COMPLETION - This was completed days/hours ago');
      console.log('   The event monitor may not have been running at that time');
    }

    // Try to determine WHO completed it
    const tx = await provider.getTransaction(foundEvent.transactionHash);
    console.log('\n👤 WHO COMPLETED THE BOOKING:');
    console.log('📋 Transaction From:', tx.from);
    console.log('📋 Expected Backend Signer:', process.env.BACKEND_SIGNER_ADDRESS);

    if (tx.from.toLowerCase() === process.env.BACKEND_SIGNER_ADDRESS.toLowerCase()) {
      console.log('✅ Completed by BACKEND (auto-completion)');
      console.log('   This means the cron job DID work, but event processing failed');
    } else {
      console.log('⚠️ Completed by DIFFERENT ADDRESS');
      console.log('   This was manually completed or completed by customer');
    }

    return foundEvent;

  } catch (error) {
    console.error('❌ Error searching for completion event:', error.message);
    throw error;
  }
}

async function getBlockTimestamp(blockNumber) {
  const block = await provider.getBlock(blockNumber);
  return block.timestamp * 1000; // Convert to milliseconds
}

findCompletionEvent().then(() => {
  console.log('\n✅ Search complete');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});