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

async function checkBackendSigner() {
  console.log('🔍 Checking backend signer configuration...\n');

  try {
    // Get contract's backend signer
    const contractBackendSigner = await contract.backendSigner();
    const configuredBackendSigner = process.env.BACKEND_SIGNER_ADDRESS;

    console.log('📝 Contract Backend Signer:', contractBackendSigner);
    console.log('🔧 Configured Backend Signer:', configuredBackendSigner);
    console.log('');

    if (contractBackendSigner.toLowerCase() === configuredBackendSigner.toLowerCase()) {
      console.log('✅ Backend signer matches! This address can call completeService()');
    } else {
      console.log('❌ MISMATCH! The configured backend signer is NOT authorized!');
      console.log('   The contract expects:', contractBackendSigner);
      console.log('   But backend is using:', configuredBackendSigner);
      console.log('');
      console.log('🔧 SOLUTION: Update the contract to use the correct backend signer:');
      console.log('   1. Call setBackendSigner() as the contract owner');
      console.log('   2. Or update BACKEND_SIGNER_ADDRESS in .env to match the contract');
    }

    // Also check who owns the contract
    const owner = await contract.owner();
    console.log('\n📋 Contract Owner:', owner);

    // Try to complete the specific booking
    console.log('\n🎯 Testing completeService() for booking...');
    const bookingId = '0x50a8a7a03f0726a791bfcee07c98260e03d94d0bbcdd1d82025b760c1789e0f1';

    // Create a signer from the backend private key
    const wallet = new ethers.Wallet(process.env.BACKEND_SIGNER_PRIVATE_KEY, provider);
    const contractWithSigner = contract.connect(wallet);

    try {
      // Try to estimate gas first (this will fail with the same error if there's an issue)
      const gasEstimate = await contractWithSigner.completeService.estimateGas(bookingId);
      console.log('✅ Gas estimation successful! Estimated gas:', gasEstimate.toString());
      console.log('   The transaction SHOULD work!');
    } catch (error) {
      console.log('❌ Gas estimation failed!');
      console.log('   Error:', error.reason || error.message);

      if (error.reason?.includes('not in paid status')) {
        console.log('\n🔍 But we know the booking IS in PAID status...');
        console.log('   This might be a different issue with the contract or parameters');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkBackendSigner().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});