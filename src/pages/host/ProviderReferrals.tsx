import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { Share2, Copy, Users, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { APP_NAME } from '@/lib/constants';
import '@/styles/design-system-2025.css';

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
      <div className="ds-page">
        <div className="ds-loading">
          <div className="ds-loading__header" />
          <div className="ds-loading__grid-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="ds-loading__card" />
            ))}
          </div>
          <div className="ds-loading__section" />
          <div className="ds-loading__table" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ds-page">
        <div className="ds-error">
          <p className="ds-error__message">Error: {error}</p>
          <button className="ds-error__btn" onClick={loadReferralData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-page">
      {/* Header */}
      <div className="ds-header ds-header--with-actions">
        <h1 className="ds-header__title">Referrals</h1>
        <div className="ds-header__actions">
          <button className="ds-btn ds-btn--outline" onClick={copyReferralLink}>
            <Copy />
            Copy Link
          </button>
          <button className="ds-btn ds-btn--primary" onClick={shareReferralLink}>
            <Share2 />
            Share Link
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="ds-summary-grid">
        <div className="ds-card ds-animate-card">
          <div className="ds-card__header">
            <p className="ds-card__label">Total Referrals</p>
            <Users className="ds-card__icon" />
          </div>
          <p className="ds-card__value">
            {stats?.totalReferrals || 0}
          </p>
        </div>

        <div className="ds-card ds-animate-card">
          <div className="ds-card__header">
            <p className="ds-card__label">Total Earnings</p>
            <DollarSign className="ds-card__icon" />
          </div>
          <p className="ds-card__value ds-card__value--success">
            ${Number(stats?.totalEarnings || 0).toFixed(2)}
          </p>
        </div>

        <div className="ds-card ds-animate-card">
          <div className="ds-card__header">
            <p className="ds-card__label">Pending Earnings</p>
            <Clock className="ds-card__icon" />
          </div>
          <p className="ds-card__value">
            ${Number(stats?.pendingEarnings || 0).toFixed(2)}
          </p>
        </div>

        <div className="ds-card ds-animate-card">
          <div className="ds-card__header">
            <p className="ds-card__label">Success Rate</p>
            <TrendingUp className="ds-card__icon" />
          </div>
          <p className="ds-card__value">
            {referralData?.usageCount && stats?.totalReferrals
              ? Math.round((stats.totalReferrals / referralData.usageCount) * 100)
              : 0}%
          </p>
        </div>
      </div>

      {/* Referral Link Section */}
      <div className="ds-card ds-card--no-hover" style={{ marginBottom: '32px' }}>
        <h2 className="ds-section__title" style={{ marginBottom: '20px' }}>Your Referral Link</h2>
        <div className="ds-input-box">
          <span className="ds-input-box__value">
            {referralData?.referralUrl}
          </span>
          <button className="ds-input-box__btn" onClick={copyReferralLink}>
            <Copy />
          </button>
        </div>
        <div className="ds-code">
          <p className="ds-code__label">Referral Code</p>
          <p className="ds-code__value">{referralData?.code}</p>
          <p className="ds-code__note">
            Used {referralData?.usageCount || 0} times
          </p>
        </div>
      </div>

      {/* Earnings History */}
      <div className="ds-section">
        <div className="ds-section__header">
          <h2 className="ds-section__title">Transaction History</h2>
        </div>
        <div className="ds-section__content ds-section__content--no-padding" style={{ overflowX: 'auto' }}>
          <table className="ds-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Service</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {earnings.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="ds-empty">
                      <p className="ds-empty__title">No earnings found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                earnings.map((earning, index) => (
                  <tr key={earning.id} className="ds-animate-row" style={{ animationDelay: `${200 + index * 30}ms` }}>
                    <td>
                      <div className="ds-table__date">
                        {new Date(earning.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="ds-table__time">
                        {new Date(earning.created_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td>
                      <div className="ds-table__primary">
                        {earning.source_user?.display_name || 'Unknown User'}
                      </div>
                    </td>
                    <td>
                      <div className="ds-table__primary">
                        {earning.booking?.service?.title || 'Service booking'}
                      </div>
                      <div className="ds-table__secondary">
                        5% commission
                      </div>
                    </td>
                    <td>
                      <div className="ds-table__amount">
                        +${Number(earning.amount).toFixed(2)}
                      </div>
                      <div className="ds-table__secondary">
                        of ${Number(earning.booking?.total_price || 0).toFixed(2)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
