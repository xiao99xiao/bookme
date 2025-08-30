// Helper to get Privy token reliably
export async function getPrivyToken(): Promise<string | null> {
  // Check all possible storage locations for Privy token
  const possibleKeys = [
    'privy:token',
    'privy:auth:token',
    'privy:access_token',
  ];

  // Check localStorage
  for (const key of possibleKeys) {
    const value = localStorage.getItem(key);
    if (value && value.startsWith('eyJ')) { // JWT tokens start with eyJ
      return value;
    }
  }

  // Check all localStorage keys that might contain the token
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('privy')) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          // Try to parse as JSON first
          const parsed = JSON.parse(value);
          if (parsed.accessToken) {
            return parsed.accessToken;
          }
          if (parsed.token) {
            return parsed.token;
          }
          if (parsed.access_token) {
            return parsed.access_token;
          }
        } catch {
          // Not JSON, might be the token directly
          if (value.startsWith('eyJ')) {
            return value;
          }
        }
      }
    }
  }

  return null;
}

export function storePrivyToken(token: string) {
  if (token && token.startsWith('eyJ')) {
    localStorage.setItem('privy:token', token);
  }
}