import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function DashboardTest() {
  const { getAccessToken } = usePrivy();
  const [testResults, setTestResults] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [jwtToken, setJwtToken] = useState<string>('');
  const [decodedJWT, setDecodedJWT] = useState<any>(null);

  const backendUrl = 'https://skating-destroyed-understanding-sas.trycloudflare.com';

  const runJWTTest = async () => {
    setLoading(true);
    setTestResults({});
    
    try {
      // Step 1: Get Privy token
      const privyToken = await getAccessToken();
      setTestResults(prev => ({ ...prev, privyToken: { success: true, value: privyToken?.substring(0, 20) + '...' } }));

      // Step 2: Call backend for JWT
      const response = await fetch(`${backendUrl}/api/auth/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${privyToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        setTestResults(prev => ({ ...prev, jwtGeneration: { success: false, error } }));
        return;
      }

      const data = await response.json();
      setTestResults(prev => ({ ...prev, jwtGeneration: { success: true, value: data } }));
      setJwtToken(data.token);

      // Step 3: Decode JWT
      const payload = JSON.parse(atob(data.token.split('.')[1]));
      setDecodedJWT(payload);
      setTestResults(prev => ({ ...prev, jwtDecode: { success: true, value: payload } }));

      // Step 4: Test Supabase client with JWT - using accessToken() method
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const supabaseWithJWT = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {},
        },
        accessToken: async () => {
          return data.token;
        }
      });

      // Step 5: Test a query
      const { data: services, error } = await supabaseWithJWT
        .from('services')
        .select('*')
        .limit(1);

      if (error) {
        setTestResults(prev => ({ ...prev, supabaseQuery: { success: false, error } }));
      } else {
        setTestResults(prev => ({ ...prev, supabaseQuery: { success: true, value: services } }));
      }

      // Step 6: Test RLS check (get current user)
      const { data: userData, error: userError } = await supabaseWithJWT
        .from('users')
        .select('*')
        .eq('id', payload.sub)
        .single();

      if (userError) {
        setTestResults(prev => ({ ...prev, rlsCheck: { success: false, error: userError } }));
      } else {
        setTestResults(prev => ({ ...prev, rlsCheck: { success: true, value: userData } }));
      }

    } catch (error: any) {
      setTestResults(prev => ({ ...prev, general: { success: false, error: error.message } }));
    } finally {
      setLoading(false);
    }
  };

  const runBackendHealthCheck = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/health`);
      const data = await response.json();
      setTestResults(prev => ({ ...prev, healthCheck: { success: true, value: data } }));
    } catch (error: any) {
      setTestResults(prev => ({ ...prev, healthCheck: { success: false, error: error.message } }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">JWT Integration Test</h1>
        <p className="text-muted-foreground">Test the Privy → Backend → Supabase JWT flow</p>
      </div>

      <Alert>
        <AlertDescription>
          Backend URL: <code className="text-xs">{backendUrl}</code>
        </AlertDescription>
      </Alert>

      <div className="flex gap-4">
        <Button onClick={runBackendHealthCheck} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Test Backend Health
        </Button>
        <Button onClick={runJWTTest} disabled={loading} variant="default">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Run JWT Test
        </Button>
      </div>

      <Tabs defaultValue="results" className="w-full">
        <TabsList>
          <TabsTrigger value="results">Test Results</TabsTrigger>
          <TabsTrigger value="jwt">JWT Details</TabsTrigger>
          <TabsTrigger value="raw">Raw Data</TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="space-y-4">
          {Object.entries(testResults).map(([key, result]: [string, any]) => (
            <Card key={key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </CardTitle>
                  {result.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs overflow-auto bg-muted p-2 rounded">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="jwt" className="space-y-4">
          {jwtToken && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>JWT Token</CardTitle>
                  <CardDescription>The generated Supabase-compatible JWT</CardDescription>
                </CardHeader>
                <CardContent>
                  <textarea 
                    className="w-full h-32 p-2 text-xs font-mono bg-muted rounded"
                    value={jwtToken}
                    readOnly
                  />
                </CardContent>
              </Card>

              {decodedJWT && (
                <Card>
                  <CardHeader>
                    <CardTitle>Decoded JWT Payload</CardTitle>
                    <CardDescription>The JWT claims that Supabase RLS will use</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="font-medium">User ID (sub):</div>
                        <div className="font-mono text-xs">{decodedJWT.sub}</div>
                        
                        <div className="font-medium">Privy ID:</div>
                        <div className="font-mono text-xs">{decodedJWT.privy_id}</div>
                        
                        <div className="font-medium">Role:</div>
                        <div className="font-mono text-xs">{decodedJWT.role}</div>
                        
                        <div className="font-medium">Issued At:</div>
                        <div className="font-mono text-xs">{new Date(decodedJWT.iat * 1000).toLocaleString()}</div>
                        
                        <div className="font-medium">Expires:</div>
                        <div className="font-mono text-xs">{new Date(decodedJWT.exp * 1000).toLocaleString()}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="raw">
          <Card>
            <CardHeader>
              <CardTitle>Raw Test Data</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs overflow-auto bg-muted p-4 rounded">
                {JSON.stringify({ testResults, jwtToken, decodedJWT }, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}