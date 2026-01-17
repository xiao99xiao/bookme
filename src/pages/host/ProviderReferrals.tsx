import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Share2, Copy, Users, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { APP_NAME } from '@/lib/constants';

interface ReferralData {
  code: string;
  referralUrl: string;
  usageCount: number;
  activeReferrals: number;
}

interface ReferralStats {
  totalReferrals: number;
  totalEarnings: number;
  pendingEarnings: number;
  recentEarnings: any[];
}

interface ReferralEarning {
  id: string;
  amount: number;
  created_at: string;
  booking?: {
    id: string;
    scheduled_at: string;
    total_price: number;
    service?: {
      title: string;
    };
  };
  source_user?: {
    display_name: string;
  };
}

export default function ProviderReferrals() {
  const navigate = useNavigate();
  const { authenticated, loading: authLoading, userId } = useAuth();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [earnings, setEarnings] = useState<ReferralEarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !authenticated) {
      navigate('/auth');
    }
  }, [authenticated, authLoading, navigate]);

  useEffect(() => {
    if (userId) {
      loadReferralData();
    }
  }, [userId]);

  const loadReferralData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [codeData, statsData, earningsData] = await Promise.all([
        ApiClient.getReferralCode(),
        ApiClient.getReferralStats(),
        ApiClient.getReferralEarnings(10, 0)
      ]);

      setReferralData(codeData);
      setStats(statsData);
      setEarnings(earningsData);
    } catch (err: any) {
      console.error('Failed to load referral data:', err);
      setError(err.message || 'Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = async () => {
    if (referralData?.referralUrl) {
      try {
        await navigator.clipboard.writeText(referralData.referralUrl);
        toast.success('Referral link copied to clipboard!');
      } catch (error) {
        toast.error('Failed to copy link');
      }
    }
  };

  const shareReferralLink = async () => {
    if (navigator.share && referralData?.referralUrl) {
      try {
        await navigator.share({
          title: `Join ${APP_NAME} as a Provider`,
          text: `Start earning on ${APP_NAME} with my referral link`,
          url: referralData.referralUrl
        });
      } catch (error) {
        // User cancelled or error - no need to show error
      }
    } else {
      // Fallback to copy
      copyReferralLink();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-600">Error: {error}</p>
            <Button onClick={loadReferralData} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Referrals</h1>
        <div className="flex gap-2">
          <Button onClick={copyReferralLink} variant="outline">
            <Copy className="w-4 h-4 mr-2" />
            Copy Link
          </Button>
          <Button onClick={shareReferralLink}>
            <Share2 className="w-4 h-4 mr-2" />
            Share Link
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Referrals</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalReferrals || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Number(stats?.totalEarnings || 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Earnings</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Number(stats?.pendingEarnings || 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {referralData?.usageCount && stats?.totalReferrals
                ? Math.round((stats.totalReferrals / referralData.usageCount) * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Your Referral Link</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 p-3 rounded-lg mb-4">
            <div className="flex justify-between items-center gap-2">
              <span className="text-sm font-mono truncate flex-1">
                {referralData?.referralUrl}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={copyReferralLink}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">Referral Code</p>
            <p className="text-2xl font-bold font-mono">{referralData?.code}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Used {referralData?.usageCount || 0} times
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Earnings History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-4 font-medium">Date</th>
                  <th className="text-left p-4 font-medium">Customer</th>
                  <th className="text-left p-4 font-medium">Service</th>
                  <th className="text-right p-4 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {earnings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center p-8 text-gray-500">
                      No earnings found
                    </td>
                  </tr>
                ) : (
                  earnings.map((earning) => (
                    <tr key={earning.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div className="text-sm">
                          {new Date(earning.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(earning.created_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-medium">
                          {earning.source_user?.display_name || 'Unknown User'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-medium">
                          {earning.booking?.service?.title || 'Service booking'}
                        </div>
                        <div className="text-xs text-gray-500">
                          5% commission
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="text-sm font-semibold text-green-600">
                          +${earning.amount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          of ${earning.booking?.total_price?.toFixed(2) || '0.00'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}