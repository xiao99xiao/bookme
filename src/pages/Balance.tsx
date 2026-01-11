import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge as DSBadge } from '@/design-system';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Copy, Wallet, RefreshCw, ExternalLink, Plus, CreditCard, TrendingUp, Calendar, User, Coins, History, ArrowUpRight, ArrowDownRight, Gift } from 'lucide-react';
import { createPublicClient, http, formatUnits, type Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient, type IncomeTransaction } from '@/lib/api-migration';
import { H1 } from '@/design-system';
import { usePoints } from '@/hooks/usePoints';
import { useFunding } from '@/hooks/useFunding';

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

  const getWalletTypeBadge = (type: WalletInfo['type']) => {
    switch (type) {
      case 'smart_wallet':
        return <DSBadge className="bg-purple-100 text-purple-800">Smart Wallet</DSBadge>;
      case 'external':
        return <DSBadge className="bg-blue-100 text-blue-800">External Wallet</DSBadge>;
      case 'embedded':
        return <DSBadge className="bg-green-100 text-green-800">Embedded Wallet</DSBadge>;
      default:
        return null;
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
      <div className="max-w-6xl mx-auto p-6">
        <Skeleton className="h-8 w-32 mb-6" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (!walletInfo) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <H1 className="mb-6">Wallet & Balance</H1>
        <Card>
          <CardHeader>
            <CardTitle>No Wallet Detected</CardTitle>
            <CardDescription>Please ensure you're logged in and have a wallet connected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                No wallet found. Please ensure you're logged in and have a wallet connected.
              </p>
              <Button onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <H1>Wallet & Balance</H1>
        <p className="text-gray-600 mt-1">
          View your {chain.name} wallet balance and manage your funds
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left Column - Wallet Overview */}
        <div className="space-y-6">
          {/* Wallet Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Wallet Details</CardTitle>
                  <CardDescription>Your connected wallet information</CardDescription>
                </div>
                {getWalletTypeBadge(walletInfo.type)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Address</label>
                  <div className="flex items-center justify-between mt-1">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {formatAddress(walletInfo.address)}
                    </code>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={copyAddress}>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`${explorerUrl}/address/${walletInfo.address}`, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Explorer
                      </Button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Network</label>
                  <p className="mt-1">{chain.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Balance Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* USDC Balance */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">USDC Balance</CardTitle>
                  <Button size="sm" variant="ghost" onClick={fetchBalances} disabled={refreshing}>
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-2xl font-bold">
                    {usdcBalance ? (
                      <>
                        {parseFloat(usdcBalance.formatted).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 6
                        })}
                        <span className="text-sm text-gray-500 ml-1">USDC</span>
                      </>
                    ) : (
                      <span className="text-gray-400">0.00 USDC</span>
                    )}
                  </div>
                  
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
              </CardContent>
            </Card>

            {/* ETH Balance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ETH Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {parseFloat(nativeBalance).toLocaleString('en-US', {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 6
                  })}
                  <span className="text-sm text-gray-500 ml-1">ETH</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Used for transaction fees
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Points Balance Card */}
          <Card className="border-emerald-200 bg-emerald-50/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Coins className="w-5 h-5 text-emerald-600" />
                  Points Balance
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={refreshPoints} disabled={pointsLoading}>
                  <RefreshCw className={`w-4 h-4 ${pointsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-emerald-600">
                  {pointsLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      {formatPoints(pointsBalance)}
                      <span className="text-sm text-gray-500 ml-1">pts</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  ≈ ${pointsUsdValue.toFixed(2)} USD
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Use points to get up to 5% off on Talks. Earn points when you fund your wallet with a credit card.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Points History Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="w-5 h-5 text-gray-600" />
                  Points History
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={loadPointsHistory} disabled={loadingPointsHistory}>
                  <RefreshCw className={`w-4 h-4 ${loadingPointsHistory ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPointsHistory ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : pointsHistory.length === 0 ? (
                <div className="text-center py-6">
                  <Gift className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No points history yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Earn points by funding with credit card
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {pointsHistory.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-full ${tx.amount > 0 ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                          {tx.amount > 0 ? (
                            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-orange-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {tx.type.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(tx.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className={`text-sm font-semibold ${tx.amount > 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {tx.amount > 0 ? '+' : ''}{formatPoints(tx.amount)} pts
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions for empty balance */}
          {parseFloat(usdcBalance?.formatted || '0') === 0 && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
                  Get Started with USDC
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  You'll need USDC to book Talks on the platform. Fund your wallet to get started!
                </p>
                <Button 
                  onClick={handleFundUSDC}
                  disabled={fundingInProgress}
                  className="w-full"
                  size="lg"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Buy USDC with Card
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Income Transactions */}
        <div>
          <Card className="h-fit">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      Your Income
                    </CardTitle>
                    <CardDescription>Earnings from completed Talks</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={loadIncomeTransactions}
                    disabled={loadingIncome}
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingIncome ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingIncome ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-32" />
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <div className="text-3xl font-bold text-green-600">
                        ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        From {incomeTransactions.length} completed Talks
                      </p>
                    </div>

                    {incomeTransactions.length === 0 ? (
                      <div className="text-center py-8">
                        <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No income yet</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Complete your first Talk to start earning
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {incomeTransactions.map((transaction) => (
                          <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex items-start space-x-3 flex-1">
                              <div className="p-2 bg-green-100 rounded-lg">
                                <TrendingUp className="w-4 h-4 text-green-600" />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{transaction.service_title}</p>
                                <p className="text-xs text-gray-600 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  Visitor: {transaction.customer_name}
                                </p>
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(transaction.created_at)}
                                </p>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <p className="text-sm font-semibold text-green-600">
                                +${transaction.amount.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500">
                                Host earnings (90% of Talk)
                              </p>
                              {transaction.transaction_hash && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-auto p-1 mt-1"
                                  onClick={() => window.open(`${explorerUrl}/tx/${transaction.transaction_hash}`, '_blank')}
                                >
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  View
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
      </div>
    </div>
  );
}