/**
 * Authentication Middleware
 * 
 * This module handles Privy authentication token verification and user context setup.
 * It also manages wallet address synchronization with the database.
 * 
 * Usage:
 * ```javascript
 * import { verifyPrivyAuth, privyDidToUuid } from '../middleware/auth.js';
 * 
 * // In route handler
 * app.get('/protected-route', verifyPrivyAuth, async (c) => {
 *   const userId = c.get('userId'); // UUID format
 *   const privyUser = c.get('privyUser'); // Original Privy user object
 *   // ... route logic
 * });
 * ```
 */

import { PrivyClient } from '@privy-io/server-auth';
import { v5 as uuidv5 } from 'uuid';
import db from '../db-compat.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

// Initialize Privy client
const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);

// UUID namespace - same as frontend
const PRIVY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Convert Privy DID to UUID format
 * This ensures consistency between frontend and backend user IDs
 * 
 * @param {string} privyDid - The Privy DID (e.g., "did:privy:xxx")
 * @returns {string} UUID format ID
 * @throws {Error} If privyDid is not provided
 */
export function privyDidToUuid(privyDid) {
  if (!privyDid) {
    throw new Error('Privy DID is required');
  }
  return uuidv5(privyDid, PRIVY_NAMESPACE);
}

/**
 * Middleware to verify Privy authentication token
 * 
 * This middleware:
 * 1. Validates the Bearer token from Authorization header
 * 2. Verifies the token with Privy
 * 3. Converts Privy DID to UUID format
 * 4. Updates user's wallet address in database
 * 5. Adds user context to the request
 * 
 * Context variables set:
 * - c.get('privyUser'): Original Privy user object
 * - c.get('userId'): UUID format user ID
 * 
 * @param {Context} c - Hono context object
 * @param {Function} next - Next middleware function
 * @returns {Response} JSON error response if authentication fails
 */
export async function verifyPrivyAuth(c, next) {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing authorization header' }, 401);
    }
    
    const token = authHeader.substring(7);
    const user = await privyClient.verifyAuthToken(token);
    
    if (!user) {
      return c.json({ error: 'Invalid token' }, 401);
    }
    
    // Add user to context
    c.set('privyUser', user);
    const userId = privyDidToUuid(user.userId);
    c.set('userId', userId);
    
    // Store/update wallet address on each authenticated request
    try {
      console.log('🔍 Fetching wallet address for user:', user.userId);
      const userDetails = await privyClient.getUser(user.userId);
      const smartWallet = userDetails.linkedAccounts?.find(acc => acc.type === 'smart_wallet');
      const embeddedWallet = userDetails.linkedAccounts?.find(acc => acc.type === 'wallet');
      const walletAddress = smartWallet?.address || embeddedWallet?.address;

      console.log('💰 Smart wallet:', smartWallet?.address || 'Not found');
      console.log('💰 Embedded wallet:', embeddedWallet?.address || 'Not found');
      console.log('💰 Using wallet address:', walletAddress);

      if (walletAddress) {
        console.log('💾 Updating wallet address in database for user:', userId);
        // Update existing user's wallet address (don't create new users)
        const { data, error } = await db
          .from('users')
          .update({
            wallet_address: walletAddress
          })
          .eq('id', userId);

        if (error) {
          console.error('❌ Database update error:', error);
        } else {
          console.log('✅ Wallet address updated successfully:', walletAddress);
        }
      } else {
        console.warn('⚠️ No wallet address found for user:', user.userId);
      }
    } catch (walletError) {
      // Don't fail auth if wallet update fails, just log warning
      console.warn('⚠️ Failed to update user wallet address:', walletError.message);
      console.error('Full wallet error:', walletError);
    }
    
    await next();
  } catch (error) {
    console.error('Auth error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}

/**
 * Get Privy client instance (for use in other modules)
 * @returns {PrivyClient} The initialized Privy client
 */
export function getPrivyClient() {
  return privyClient;
}

/**
 * Get database client instance (for use in other modules)
 * Returns query builder API backed by Railway PostgreSQL
 * @returns {Object} The database client with query builder API
 */
export function getDb() {
  return db;
}

// Legacy alias - deprecated, use getDb() instead
export const getSupabaseAdmin = getDb;