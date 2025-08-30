import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DashboardDebug() {
  const { user, authenticated, ready, getAccessToken } = usePrivy();
  const [localStorageData, setLocalStorageData] = useState<Record<string, any>>({});
  const [privyToken, setPrivyToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scanLocalStorage = () => {
    const data: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('privy') || key.includes('auth'))) {
        const value = localStorage.getItem(key);
        if (value) {
          // Try to parse as JSON
          try {
            data[key] = JSON.parse(value);
          } catch {
            // If not JSON, store as string
            data[key] = value;
          }
        }
      }
    }
    setLocalStorageData(data);
  };

  const fetchPrivyToken = async () => {
    try {
      setError(null);
      const token = await getAccessToken();
      setPrivyToken(token);
      
      // Also try to store it properly
      if (token) {
        // Don't store the raw token, let Privy handle it
        console.log('Got token:', token.substring(0, 20) + '...');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get token');
      console.error('Token fetch error:', err);
    }
  };

  const clearPrivyStorage = () => {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes('privy')) {
        localStorage.removeItem(key);
      }
    });
    scanLocalStorage();
  };

  useEffect(() => {
    scanLocalStorage();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Debug Dashboard</h1>
        <p className="text-muted-foreground">Debug authentication and storage issues</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Privy State</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">
            <strong>Ready:</strong> {ready ? 'Yes' : 'No'}
          </div>
          <div className="text-sm">
            <strong>Authenticated:</strong> {authenticated ? 'Yes' : 'No'}
          </div>
          <div className="text-sm">
            <strong>User ID:</strong> {user?.id || 'None'}
          </div>
          <div className="text-sm">
            <strong>User Email:</strong> {
              user?.linkedAccounts?.find((a: any) => a.type === 'email')?.address || 'None'
            }
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Token Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={fetchPrivyToken} size="sm">
              Get Access Token
            </Button>
            <Button onClick={scanLocalStorage} size="sm" variant="outline">
              Scan LocalStorage
            </Button>
            <Button onClick={clearPrivyStorage} size="sm" variant="destructive">
              Clear Privy Storage
            </Button>
          </div>
          
          {error && (
            <Alert>
              <AlertDescription className="text-red-600">
                Error: {error}
              </AlertDescription>
            </Alert>
          )}
          
          {privyToken && (
            <div>
              <strong>Access Token:</strong>
              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                {privyToken.substring(0, 50)}...
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LocalStorage (Privy/Auth Keys)</CardTitle>
          <CardDescription>
            All localStorage entries containing 'privy' or 'auth'
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.entries(localStorageData).length === 0 ? (
            <p className="text-sm text-muted-foreground">No Privy/auth data in localStorage</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(localStorageData).map(([key, value]) => (
                <div key={key} className="border-b pb-4">
                  <div className="font-medium text-sm mb-1">{key}</div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                    {typeof value === 'string' 
                      ? value.substring(0, 200) + (value.length > 200 ? '...' : '')
                      : JSON.stringify(value, null, 2)
                    }
                  </pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}