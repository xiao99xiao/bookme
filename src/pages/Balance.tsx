import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Copy, Wallet, RefreshCw, ExternalLink, Plus, CreditCard, TrendingUp, Calendar, User, Coins, History, ArrowUpRight, ArrowDownRight, Gift } from 'lucide-react';
import { createPublicClient, http, formatUnits, type Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient, type IncomeTransaction } from '@/lib/api-migration';
import { usePoints } from '@/hooks/usePoints';
import { useFunding } from '@/hooks/useFunding';
import '@/styles/design-system-2025.css';

// USDC contract addresses
const USDC_ADDRESS_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as Address;
const USDC_ADDRESS_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address;

// USDC ABI (minimal, just for balanceOf)
const USDC_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
    stateMutability: 'view'
  }
] as const;

interface WalletInfo {
  address: string;
  type: 'smart_wallet' | 'external' | 'embedded';
  chainId: number;
}

interface TokenBalance {
  symbol: string;
  balance: bigint;
  decimals: number;
  formatted: string;
}

interface PointsTransaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  referenceId: string | null;
  createdAt: string;
}


export default function Balance() {
  const { user, ready: privyReady } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { client: smartWalletClient } = useSmartWallets();
  const { authenticated, loading: authLoading, userId, profile } = useAuth();

  // Use global funding hook with points earning
  const { fundWallet } = useFunding();

  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<TokenBalance | null>(null);
  const [nativeBalance, setNativeBalance] = useState<string>('0');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fundingInProgress, setFundingInProgress] = useState(false);

  // Income transactions state
  const [incomeTransactions, setIncomeTransactions] = useState<IncomeTransaction[]>([]);
  const [loadingIncome, setLoadingIncome] = useState(true);
  const [totalIncome, setTotalIncome] = useState(0);

  // Points history state
  const [pointsHistory, setPointsHistory] = useState<PointsTransaction[]>([]);
  const [loadingPointsHistory, setLoadingPointsHistory] = useState(false);

  // Points system
  const {
    balance: pointsBalance,
    usdValue: pointsUsdValue,
    loading: pointsLoading,
    refreshBalance: refreshPoints,
    formatPoints,
    fetchHistory: fetchPointsHistory
  } = usePoints();

  const isProduction = import.meta.env.MODE === 'production';
  const chain = isProduction ? base : baseSepolia;
  const usdcAddress = isProduction ? USDC_ADDRESS_BASE : USDC_ADDRESS_BASE_SEPOLIA;
  const explorerUrl = isProduction ? 'https://basescan.org' : 'https://sepolia.basescan.org';

  const publicClient = createPublicClient({
    chain,
    transport: http()
  });

  // Get wallet information
  useEffect(() => {
    if (!privyReady || !walletsReady || !authenticated || authLoading) return;

    const determineWallet = async () => {
      try {
        const smartWallet = user?.linkedAccounts?.find((account: any) => account.type === 'smart_wallet');
        if (smartWallet) {
          setWalletInfo({
            address: smartWallet.address,
            type: 'smart_wallet',
            chainId: chain.id
          });
          return;
        }

        if (wallets.length > 0) {
          const externalWallet = wallets.find(w => w.walletClientType !== 'privy');
          if (externalWallet) {
            setWalletInfo({
              address: externalWallet.address,
              type: 'external',
              chainId: await externalWallet.getChainId()
            });
            return;
          }
        }

        const embeddedWallet = user?.linkedAccounts?.find((account: any) =>
          account.type === 'wallet' && account.walletClientType === 'privy'
        );
        if (embeddedWallet) {
          setWalletInfo({
            address: embeddedWallet.address,
            type: 'embedded',
            chainId: chain.id
          });
          return;
        }

        setWalletInfo(null);
      } catch (error) {
        console.error('Error determining wallet:', error);
        setWalletInfo(null);
      } finally {
        setLoading(false);
      }
    };

    determineWallet();
  }, [user, wallets, privyReady, walletsReady, authenticated, authLoading, chain]);

  // Load income transactions for all authenticated users
  useEffect(() => {
    if (userId) {
      loadIncomeTransactions();
    } else {
      setLoadingIncome(false);
    }
  }, [userId]);

  const loadIncomeTransactions = async () => {
    try {
      setLoadingIncome(true);

      // Use real API call to get income transactions
      const response = await ApiClient.getIncomeTransactions(50, 0);

      setIncomeTransactions(response.transactions);
      setTotalIncome(response.totalIncome);

    } catch (error) {
      console.error('Failed to load income transactions:', error);
      toast.error('Failed to load income transactions');
      // Set empty state on error
      setIncomeTransactions([]);
      setTotalIncome(0);
    } finally {
      setLoadingIncome(false);
    }
  };

  const loadPointsHistory = async () => {
    try {
      setLoadingPointsHistory(true);
      const transactions = await fetchPointsHistory(20, 0);
      setPointsHistory(transactions);
    } catch (error) {
      console.error('Failed to load points history:', error);
    } finally {
      setLoadingPointsHistory(false);
    }
  };

  // Load points history on mount
  useEffect(() => {
    if (userId) {
      loadPointsHistory();
    }
  }, [userId]);

  const fetchBalances = async () => {
    if (!walletInfo?.address) return;

    try {
      setRefreshing(true);

      const nativeBalanceWei = await publicClient.getBalance({
        address: walletInfo.address as Address
      });
      setNativeBalance(formatUnits(nativeBalanceWei, 18));

      const usdcBalanceRaw = await publicClient.readContract({
        address: usdcAddress,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [walletInfo.address as Address]
      });

      setUsdcBalance({
        symbol: 'USDC',
        balance: usdcBalanceRaw,
        decimals: 6,
        formatted: formatUnits(usdcBalanceRaw, 6)
      });
    } catch (error) {
      console.error('Error fetching balances:', error);
      toast.error('Failed to fetch balance');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (walletInfo?.address) {
      fetchBalances();
    }
  }, [walletInfo?.address]);

  const copyAddress = () => {
    if (walletInfo?.address) {
      navigator.clipboard.writeText(walletInfo.address);
      toast.success('Address copied to clipboard');
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleFundUSDC = async () => {
    if (!walletInfo?.address) {
      toast.error('No wallet address found');
      return;
    }

    setFundingInProgress(true);
    await fundWallet({
      amount: '10',
      onSuccess: (fundedAmount, pointsAwarded) => {
        // Refresh balances and points after successful funding
        fetchBalances();
        refreshPoints();
        loadPointsHistory();
      },
      onError: (error) => {
        console.error('Funding error:', error);
      }
    });
    setFundingInProgress(false);
  };

  const getWalletBadgeLabel = (type: WalletInfo['type']) => {
    switch (type) {
      case 'smart_wallet':
        return 'Smart Wallet';
      case 'external':
        return 'External Wallet';
      case 'embedded':
        return 'Embedded Wallet';
      default:
        return 'Wallet';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading || authLoading) {
    return (
      <div className="ds-page">
        <div className="ds-loading">
          <div className="ds-loading__header" />
          <div className="ds-loading__grid-2">
            <div className="ds-column">
              <div className="ds-loading__card ds-loading__card--tall" />
              <div className="ds-loading__card" />
            </div>
            <div className="ds-loading__section" />
          </div>
        </div>
      </div>
    );
  }

  if (!walletInfo) {
    return (
      <div className="ds-page">
        <div className="ds-header">
          <h1 className="ds-header__title">Wallet & Balance</h1>
        </div>
        <div className="ds-card ds-card--no-hover">
          <div className="ds-empty">
            <Wallet className="ds-empty__icon" />
            <p className="ds-empty__title">No Wallet Detected</p>
            <p className="ds-empty__description">
              Please ensure you're logged in and have a wallet connected.
            </p>
          </div>
          <div className="ds-card__action" style={{ textAlign: 'center' }}>
            <button className="ds-btn ds-btn--primary" onClick={() => window.location.reload()}>
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-page">
      <div className="ds-header">
        <h1 className="ds-header__title">Wallet & Balance</h1>
        <p className="ds-header__subtitle">
          View your {chain.name} wallet balance and manage your funds
        </p>
      </div>

      <div className="ds-grid-2">
        {/* Left Column - Wallet Overview */}
        <div className="ds-column">
          {/* Wallet Details */}
          <div className="ds-card ds-card--no-hover ds-animate-card">
            <div className="ds-card__header">
              <div>
                <h2 className="ds-card__title">Wallet Details</h2>
                <p className="ds-card__note" style={{ marginTop: '4px' }}>Your connected wallet information</p>
              </div>
              <span className={`ds-badge ${walletInfo.type === 'smart_wallet' ? 'ds-badge--purple' : walletInfo.type === 'external' ? 'ds-badge--blue' : 'ds-badge--gray'}`}>
                {getWalletBadgeLabel(walletInfo.type)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div className="ds-wallet-row">
                <span className="ds-wallet-label">Address</span>
                <div className="ds-wallet-value">
                  <code className="ds-address">
                    {formatAddress(walletInfo.address)}
                  </code>
                  <div className="ds-wallet-actions">
                    <button className="ds-btn ds-btn--outline" onClick={copyAddress}>
                      <Copy /> Copy
                    </button>
                    <button
                      className="ds-btn ds-btn--outline"
                      onClick={() => window.open(`${explorerUrl}/address/${walletInfo.address}`, '_blank')}
                    >
                      <ExternalLink /> Explorer
                    </button>
                  </div>
                </div>
              </div>
              <div className="ds-wallet-row">
                <span className="ds-wallet-label">Network</span>
                <span className="ds-wallet-network">{chain.name}</span>
              </div>
            </div>
          </div>

          {/* Balance Cards */}
          <div className="ds-summary-grid-2">
            {/* USDC Balance */}
            <div className="ds-card ds-animate-card">
              <div className="ds-card__header">
                <h3 className="ds-card__label">USDC Balance</h3>
                <button
                  className={`ds-refresh-btn ${refreshing ? 'ds-refresh-btn--spinning' : ''}`}
                  onClick={fetchBalances}
                  disabled={refreshing}
                >
                  <RefreshCw />
                </button>
              </div>
              <p className="ds-card__value">
                {usdcBalance ? (
                  <>
                    {parseFloat(usdcBalance.formatted).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6
                    })}
                    <span className="ds-card__unit">USDC</span>
                  </>
                ) : (
                  <>0.00<span className="ds-card__unit">USDC</span></>
                )}
              </p>
              <div className="ds-card__action">
                <Button
                  onClick={handleFundUSDC}
                  disabled={fundingInProgress || !walletInfo}
                  size="sm"
                  className="w-full"
                  variant={parseFloat(usdcBalance?.formatted || '0') === 0 ? 'default' : 'outline'}
                >
                  {fundingInProgress ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add USDC
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* ETH Balance */}
            <div className="ds-card ds-animate-card">
              <div className="ds-card__header">
                <h3 className="ds-card__label">ETH Balance</h3>
              </div>
              <p className="ds-card__value">
                {parseFloat(nativeBalance).toLocaleString('en-US', {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 6
                })}
                <span className="ds-card__unit">ETH</span>
              </p>
              <p className="ds-card__note">Used for transaction fees</p>
            </div>
          </div>

          {/* Points Balance Card */}
          <div className="ds-card ds-card--success ds-animate-card">
            <div className="ds-card__header">
              <h3 className="ds-card__title">
                <Coins className="text-emerald-600" />
                Points Balance
              </h3>
              <button
                className={`ds-refresh-btn ${pointsLoading ? 'ds-refresh-btn--spinning' : ''}`}
                onClick={refreshPoints}
                disabled={pointsLoading}
              >
                <RefreshCw />
              </button>
            </div>
            {pointsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="ds-card__value ds-card__value--success">
                {formatPoints(pointsBalance)}
                <span className="ds-card__unit">pts</span>
              </p>
            )}
            <p className="ds-card__secondary">
              ≈ ${pointsUsdValue.toFixed(2)} USD
            </p>
            <p className="ds-card__note">
              Use points to get up to 5% off on Talks. Earn points when you fund your wallet with a credit card.
            </p>
          </div>

          {/* Points History */}
          <div className="ds-section ds-animate-card">
            <div className="ds-section__header">
              <div>
                <h2 className="ds-section__title">
                  <History />
                  Points History
                </h2>
              </div>
              <button
                className={`ds-refresh-btn ${loadingPointsHistory ? 'ds-refresh-btn--spinning' : ''}`}
                onClick={loadPointsHistory}
                disabled={loadingPointsHistory}
              >
                <RefreshCw />
              </button>
            </div>
            <div className="ds-section__content">
              {loadingPointsHistory ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : pointsHistory.length === 0 ? (
                <div className="ds-empty">
                  <Gift className="ds-empty__icon" />
                  <p className="ds-empty__title">No points history yet</p>
                  <p className="ds-empty__description">
                    Earn points by funding with credit card
                  </p>
                </div>
              ) : (
                <div className="ds-list">
                  {pointsHistory.map((tx, index) => (
                    <div key={tx.id} className={`ds-list-item ds-animate-list-item`} style={{ animationDelay: `${100 + index * 30}ms` }}>
                      <div className="ds-list-item__left">
                        <div className={`ds-list-item__icon ${tx.amount > 0 ? 'ds-list-item__icon--success' : 'ds-list-item__icon--warning'}`}>
                          {tx.amount > 0 ? <ArrowDownRight /> : <ArrowUpRight />}
                        </div>
                        <div className="ds-list-item__info">
                          <p className="ds-list-item__title" style={{ textTransform: 'capitalize' }}>
                            {tx.type.replace(/_/g, ' ')}
                          </p>
                          <div className="ds-list-item__meta">
                            {new Date(tx.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="ds-list-item__right">
                        <span className={`ds-list-item__amount ${tx.amount > 0 ? 'ds-list-item__amount--positive' : 'ds-list-item__amount--negative'}`}>
                          {tx.amount > 0 ? '+' : ''}{formatPoints(tx.amount)} pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions for empty balance */}
          {parseFloat(usdcBalance?.formatted || '0') === 0 && (
            <div className="ds-card ds-card--info ds-animate-card">
              <div className="ds-card__header">
                <h3 className="ds-card__title">
                  <CreditCard />
                  Get Started with USDC
                </h3>
              </div>
              <p className="ds-card__note" style={{ marginTop: '8px', marginBottom: '16px' }}>
                You'll need USDC to book Talks on the platform. Fund your wallet to get started!
              </p>
              <button
                className="ds-btn ds-btn--primary ds-btn--full"
                onClick={handleFundUSDC}
                disabled={fundingInProgress}
              >
                <CreditCard />
                Buy USDC with Card
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Income Transactions */}
        <div className="ds-column">
          <div className="ds-section ds-animate-card" style={{ animationDelay: '100ms' }}>
            <div className="ds-section__header">
              <div>
                <h2 className="ds-section__title ds-section__title--success">
                  <TrendingUp />
                  Your Income
                </h2>
                <p className="ds-section__subtitle">Earnings from completed Talks</p>
              </div>
              <button
                className={`ds-refresh-btn ${loadingIncome ? 'ds-refresh-btn--spinning' : ''}`}
                onClick={loadIncomeTransactions}
                disabled={loadingIncome}
              >
                <RefreshCw />
              </button>
            </div>
            <div className="ds-section__content">
              {loadingIncome ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-32" />
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="ds-summary-box">
                    <p className="ds-summary-box__value">
                      ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="ds-summary-box__label">
                      From {incomeTransactions.length} completed Talks
                    </p>
                  </div>

                  {incomeTransactions.length === 0 ? (
                    <div className="ds-empty">
                      <TrendingUp className="ds-empty__icon" />
                      <p className="ds-empty__title">No income yet</p>
                      <p className="ds-empty__description">
                        Complete your first Talk to start earning
                      </p>
                    </div>
                  ) : (
                    <div className="ds-list">
                      {incomeTransactions.map((transaction, index) => (
                        <div key={transaction.id} className={`ds-list-item ds-animate-list-item`} style={{ animationDelay: `${200 + index * 30}ms` }}>
                          <div className="ds-list-item__left">
                            <div className="ds-list-item__icon ds-list-item__icon--success">
                              <TrendingUp />
                            </div>
                            <div className="ds-list-item__info">
                              <p className="ds-list-item__title">{transaction.service_title}</p>
                              <div className="ds-list-item__meta">
                                <User />
                                Visitor: {transaction.customer_name}
                              </div>
                              <div className="ds-list-item__meta">
                                <Calendar />
                                {formatDate(transaction.created_at)}
                              </div>
                            </div>
                          </div>
                          <div className="ds-list-item__right">
                            <span className="ds-list-item__amount ds-list-item__amount--positive">
                              +${transaction.amount.toFixed(2)}
                            </span>
                            <span className="ds-list-item__label">
                              Host earnings (90%)
                            </span>
                            {transaction.transaction_hash && (
                              <a
                                href={`${explorerUrl}/tx/${transaction.transaction_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ds-list-item__link"
                              >
                                <ExternalLink />
                                View tx
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
