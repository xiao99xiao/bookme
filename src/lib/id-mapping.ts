import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

// Namespace UUID for our application (generated once, never changes)
const PRIVY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Converts a Privy DID to a deterministic UUID
 * This ensures the same DID always maps to the same UUID
 */
export function privyDidToUuid(privyDid: string): string {
  if (!privyDid) {
    throw new Error('Privy DID is required');
  }
  
  // Use UUID v5 to create a deterministic UUID from the DID
  // This means the same DID will ALWAYS produce the same UUID
  const uuid = uuidv5(privyDid, PRIVY_NAMESPACE);
  
  console.log(`DID Mapping: ${privyDid} -> ${uuid}`);
  return uuid;
}

/**
 * Validates if a string is a Privy DID
 */
export function isPrivyDid(id: string): boolean {
  return id.startsWith('did:privy:');
}

/**
 * Validates if a string is a UUID
 */
export function isUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Ensures an ID is in UUID format, converting from DID if needed
 */
export function ensureUuid(id: string): string {
  if (!id) {
    throw new Error('ID is required');
  }
  
  if (isUuid(id)) {
    return id;
  }
  
  if (isPrivyDid(id)) {
    return privyDidToUuid(id);
  }
  
  throw new Error(`Invalid ID format: ${id}`);
}

/**
 * Creates a mapping table entry for tracking DID to UUID mappings
 * This is useful for debugging and potential future migrations
 */
export interface IdMapping {
  privy_did: string;
  uuid: string;
  created_at: string;
}

export function createIdMapping(privyDid: string): IdMapping {
  return {
    privy_did: privyDid,
    uuid: privyDidToUuid(privyDid),
    created_at: new Date().toISOString()
  };
}