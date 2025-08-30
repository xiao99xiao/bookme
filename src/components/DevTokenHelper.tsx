import { usePrivy } from '@privy-io/react-auth';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

export function DevTokenHelper() {
  const { getAccessToken, authenticated } = usePrivy();
  const [token, setToken] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const fetchToken = async () => {
    try {
      const accessToken = await getAccessToken();
      if (accessToken) {
        setToken(accessToken);
        console.log('====================================');
        console.log('PRIVY ACCESS TOKEN (copy this):');
        console.log(accessToken);
        console.log('====================================');
        console.log('Test command:');
        console.log(`curl -X POST https://esfowzdgituqktemrmle.supabase.co/functions/v1/auth-exchange \\
  -H "Authorization: Bearer ${accessToken}" \\
  -H "Content-Type: application/json" \\
  -d '{"action": "exchange-token"}'`);
      } else {
        console.log('No token available - make sure you are logged in!');
        alert('No token available - make sure you are logged in!');
      }
    } catch (error) {
      console.error('Error getting token:', error);
      alert('Error getting token - check console');
    }
  };

  const copyToken = async () => {
    if (token) {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!authenticated) {
    return (
      <div className="fixed bottom-4 right-4 p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
        <p className="text-sm">Please log in first to get token</p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-white border border-gray-300 rounded-lg shadow-lg max-w-md">
      <h3 className="font-bold text-sm mb-2">Dev Token Helper</h3>
      
      <Button onClick={fetchToken} className="w-full mb-2">
        Get Privy Access Token
      </Button>
      
      {token && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-mono bg-gray-100 p-2 rounded overflow-x-auto flex-1">
              {token.substring(0, 50)}...
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={copyToken}
              className="shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-gray-600">
            Token copied to console and ready to paste
          </p>
        </div>
      )}
    </div>
  );
}