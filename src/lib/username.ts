// Username validation and generation utilities

// Blacklisted usernames that could conflict with routes or be misleading
export const USERNAME_BLACKLIST = [
  // System/Admin
  'admin', 'administrator', 'api', 'app', 'auth', 'root', 'system', 'config',
  
  // App Routes/Features
  'balance', 'balances', 'book', 'booking', 'bookings', 'chat', 'customer', 
  'dashboard', 'discover', 'help', 'home', 'index', 'login', 'logout', 
  'message', 'messages', 'order', 'orders', 'profile', 'provider', 'resume', 
  'service', 'services', 'setting', 'settings', 'support', 'user', 'wallet', 
  'wallets', 'onboarding',
  
  // Common Web Terms
  'www', 'mail', 'email', 'ftp', 'blog', 'news', 'shop', 'store', 'about',
  'contact', 'terms', 'privacy', 'legal',
  
  // Technical Terms
  'test', 'demo', 'example', 'null', 'undefined', 'true', 'false', 'delete',
  'edit', 'create', 'update', 'new', 'old'
];

// Username validation rules
export const USERNAME_RULES = {
  minLength: 3,
  maxLength: 30,
  pattern: /^[a-zA-Z0-9_-]+$/,
  description: 'Username must be 3-30 characters long and contain only letters, numbers, underscores, and dashes'
};

/**
 * Validate username format and availability
 */
export function validateUsername(username: string): {
  isValid: boolean;
  error?: string;
} {
  // Check length
  if (username.length < USERNAME_RULES.minLength) {
    return {
      isValid: false,
      error: `Username must be at least ${USERNAME_RULES.minLength} characters long`
    };
  }

  if (username.length > USERNAME_RULES.maxLength) {
    return {
      isValid: false,
      error: `Username must be no more than ${USERNAME_RULES.maxLength} characters long`
    };
  }

  // Check format
  if (!USERNAME_RULES.pattern.test(username)) {
    return {
      isValid: false,
      error: USERNAME_RULES.description
    };
  }

  // Check blacklist
  if (USERNAME_BLACKLIST.includes(username.toLowerCase())) {
    return {
      isValid: false,
      error: 'This username is reserved and cannot be used'
    };
  }

  return { isValid: true };
}

/**
 * Generate a username from display name
 */
export function generateUsernameFromName(displayName: string, fallbackId?: string): string {
  if (!displayName || typeof displayName !== 'string') {
    return fallbackId ? `user${fallbackId.slice(0, 8).replace(/-/g, '')}` : 'user123';
  }

  // Clean the display name: remove special chars, convert to lowercase
  let baseUsername = displayName
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]/g, '');

  // Ensure minimum length
  if (baseUsername.length < USERNAME_RULES.minLength) {
    if (fallbackId) {
      baseUsername = `user${fallbackId.slice(0, 8).replace(/-/g, '')}`;
    } else {
      baseUsername = baseUsername.padEnd(USERNAME_RULES.minLength, '123');
    }
  }

  // Truncate if too long (leave room for potential number suffix)
  if (baseUsername.length > 20) {
    baseUsername = baseUsername.slice(0, 20);
  }

  return baseUsername;
}

/**
 * Generate candidate usernames with numbering
 */
export function generateUsernameCandidates(displayName: string, fallbackId?: string): string[] {
  const baseUsername = generateUsernameFromName(displayName, fallbackId);
  const candidates = [baseUsername];
  
  // Generate numbered variants
  for (let i = 1; i <= 20; i++) {
    candidates.push(`${baseUsername}${i}`);
  }
  
  return candidates;
}

/**
 * Check if username is available (client-side format check only)
 */
export function isUsernameFormatValid(username: string): boolean {
  return validateUsername(username).isValid;
}

/**
 * Generate user page URL - only returns URL if user has username
 */
export function getUserPageUrl(user: { username?: string; id?: string } | null | undefined): string | null {
  const baseUrl = window.location.origin;
  
  if (!user) {
    return null;
  }
  
  // Only return URL if user has username
  if (user.username) {
    return `${baseUrl}/${user.username}`;
  }
  
  // No fallback to userId - return null if no username
  return null;
}

/**
 * Navigate to user profile by userId - looks up username first
 * Returns false if user has no username (no navigation occurs)
 */
export async function navigateToUserProfile(userId: string, navigate: (path: string) => void): Promise<boolean> {
  try {
    // Import ApiClient to get user data
    const { ApiClient } = await import('./api-migration');
    
    // Get user data to check for username
    const userData = await ApiClient.getPublicUserProfile(userId);
    
    if (userData.username) {
      navigate(`/${userData.username}`);
      return true;
    } else {
      // User has no username, cannot navigate to profile
      return false;
    }
  } catch (error) {
    console.error('Failed to navigate to user profile:', error);
    return false;
  }
}