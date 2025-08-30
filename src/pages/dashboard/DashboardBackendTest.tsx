import { useState, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { BackendAPI } from '@/lib/backend-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/PrivyAuthContext';

export default function DashboardBackendTest() {
  const { getAccessToken } = usePrivy();
  const { userId, profile } = useAuth();
  const [testResults, setTestResults] = useState<any>({});
  const [loading, setLoading] = useState(false);
  
  // Create backend API instance
  const backendApi = useMemo(() => new BackendAPI(getAccessToken), [getAccessToken]);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://skating-destroyed-understanding-sas.trycloudflare.com';

  const runTest = async (testName: string, testFn: () => Promise<any>) => {
    setLoading(true);
    try {
      const result = await testFn();
      setTestResults(prev => ({
        ...prev,
        [testName]: { success: true, data: result }
      }));
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        [testName]: { success: false, error: error.message || error }
      }));
    } finally {
      setLoading(false);
    }
  };

  const testProfile = () => runTest('profile', () => backendApi.getUserProfile());
  
  const testServices = () => runTest('services', async () => {
    // Get user's services
    if (!userId) throw new Error('No user ID');
    return backendApi.getUserServices(userId);
  });

  const testCreateService = () => runTest('createService', async () => {
    const testService = {
      title: 'Test Service ' + Date.now(),
      description: 'This is a test service created for testing',
      category_id: null, // Can be null if no categories exist
      price: 50,
      duration_minutes: 60,
      location: 'Online',
      is_online: true,
      is_active: true,
      availability_schedule: {} // Correct column name
    };
    return backendApi.createOrUpdateService(testService);
  });

  const testBookings = () => runTest('bookings', async () => {
    if (!userId) throw new Error('No user ID');
    return backendApi.getUserBookings(userId);
  });

  const testCategories = () => runTest('categories', () => backendApi.getCategories());

  const runAllTests = async () => {
    setTestResults({});
    await testProfile();
    await testServices();
    await testCategories();
    await testBookings();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Backend API Test</h1>
        <p className="text-muted-foreground">Test backend API endpoints</p>
      </div>

      <Alert>
        <AlertDescription>
          Backend URL: <code className="text-xs">{backendUrl}</code>
        </AlertDescription>
      </Alert>

      {profile && (
        <Alert>
          <AlertDescription>
            Logged in as: <strong>{profile.display_name || profile.email}</strong> (ID: {userId})
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button onClick={testProfile} disabled={loading} size="sm">
          Test Profile
        </Button>
        <Button onClick={testServices} disabled={loading} size="sm">
          Test Get Services
        </Button>
        <Button onClick={testCreateService} disabled={loading} size="sm">
          Test Create Service
        </Button>
        <Button onClick={testBookings} disabled={loading} size="sm">
          Test Bookings
        </Button>
        <Button onClick={testCategories} disabled={loading} size="sm">
          Test Categories
        </Button>
        <Button onClick={runAllTests} disabled={loading} variant="default">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Run All Tests
        </Button>
      </div>

      <Tabs defaultValue="results" className="w-full">
        <TabsList>
          <TabsTrigger value="results">Test Results</TabsTrigger>
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
                <pre className="text-xs overflow-auto bg-muted p-2 rounded max-h-64">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="raw">
          <Card>
            <CardHeader>
              <CardTitle>Raw Test Data</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs overflow-auto bg-muted p-4 rounded">
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}