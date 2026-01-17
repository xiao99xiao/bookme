import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { Share2, Copy, Users, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { APP_NAME } from '@/lib/constants';
import './styles/referrals.css';

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
      <div className="referrals-container">
        <div className="referrals-loading">
          <div className="referrals-loading__header" />
          <div className="referrals-loading__cards">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="referrals-loading__card" />
            ))}
          </div>
          <div className="referrals-loading__section" />
          <div className="referrals-loading__table" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="referrals-container">
        <div className="referrals-error">
          <p className="referrals-error__message">Error: {error}</p>
          <button className="referrals-error__btn" onClick={loadReferralData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="referrals-container">
      {/* Header */}
      <div className="referrals-header">
        <h1 className="referrals-header__title">Referrals</h1>
        <div className="referrals-header__actions">
          <button className="referrals-header__btn referrals-header__btn--outline" onClick={copyReferralLink}>
            <Copy />
            Copy Link
          </button>
          <button className="referrals-header__btn referrals-header__btn--primary" onClick={shareReferralLink}>
            <Share2 />
            Share Link
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="referrals-summary">
        <div className="referrals-card">
          <div className="referrals-card__header">
            <p className="referrals-card__label">Total Referrals</p>
            <Users className="referrals-card__icon" />
          </div>
          <p className="referrals-card__value">
            {stats?.totalReferrals || 0}
          </p>
        </div>

        <div className="referrals-card">
          <div className="referrals-card__header">
            <p className="referrals-card__label">Total Earnings</p>
            <DollarSign className="referrals-card__icon" />
          </div>
          <p className="referrals-card__value referrals-card__value--highlight">
            ${Number(stats?.totalEarnings || 0).toFixed(2)}
          </p>
        </div>

        <div className="referrals-card">
          <div className="referrals-card__header">
            <p className="referrals-card__label">Pending Earnings</p>
            <Clock className="referrals-card__icon" />
          </div>
          <p className="referrals-card__value">
            ${Number(stats?.pendingEarnings || 0).toFixed(2)}
          </p>
        </div>

        <div className="referrals-card">
          <div className="referrals-card__header">
            <p className="referrals-card__label">Success Rate</p>
            <TrendingUp className="referrals-card__icon" />
          </div>
          <p className="referrals-card__value">
            {referralData?.usageCount && stats?.totalReferrals
              ? Math.round((stats.totalReferrals / referralData.usageCount) * 100)
              : 0}%
          </p>
        </div>
      </div>

      {/* Referral Link Section */}
      <div className="referral-link-section">
        <h2 className="referral-link-section__title">Your Referral Link</h2>
        <div className="referral-link-box">
          <span className="referral-link-box__url">
            {referralData?.referralUrl}
          </span>
          <button className="referral-link-box__copy" onClick={copyReferralLink}>
            <Copy />
          </button>
        </div>
        <div className="referral-code">
          <p className="referral-code__label">Referral Code</p>
          <p className="referral-code__value">{referralData?.code}</p>
          <p className="referral-code__usage">
            Used {referralData?.usageCount || 0} times
          </p>
        </div>
      </div>

      {/* Earnings History */}
      <div className="referrals-history">
        <div className="referrals-history__header">
          <h2 className="referrals-history__title">Transaction History</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="referrals-table">
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
                  <td colSpan={4} className="referrals-empty">
                    No earnings found
                  </td>
                </tr>
              ) : (
                earnings.map((earning) => (
                  <tr key={earning.id}>
                    <td>
                      <div className="referrals-table__date">
                        {new Date(earning.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="referrals-table__time">
                        {new Date(earning.created_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td>
                      <div className="referrals-table__customer">
                        {earning.source_user?.display_name || 'Unknown User'}
                      </div>
                    </td>
                    <td>
                      <div className="referrals-table__service">
                        {earning.booking?.service?.title || 'Service booking'}
                      </div>
                      <div className="referrals-table__commission">
                        5% commission
                      </div>
                    </td>
                    <td>
                      <div className="referrals-table__amount">
                        +${Number(earning.amount).toFixed(2)}
                      </div>
                      <div className="referrals-table__total">
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
