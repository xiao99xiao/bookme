import { useState, useEffect } from 'react';
import { usePrivy, useWallets, useFundWallet } from '@privy-io/react-auth';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge as DSBadge } from '@/design-system';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Copy, Wallet, RefreshCw, ExternalLink, Plus, CreditCard } from 'lucide-react';
import { createPublicClient, http, formatUnits, type Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { H1 } from '@/design-system';

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

export default function Balance() {
  const { user, ready: privyReady } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { client: smartWalletClient } = useSmartWallets();
  const { authenticated, loading: authLoading } = useAuth();
  const { fundWallet } = useFundWallet({
    onUserExited: ({ balance, address }) => {
      // Refresh balances after funding flow exits
      if (walletInfo?.address === address) {
        fetchBalances();
      }
    }
  });
  
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<TokenBalance | null>(null);
  const [nativeBalance, setNativeBalance] = useState<string>('0');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fundingInProgress, setFundingInProgress] = useState(false);
  
  const isProduction = import.meta.env.MODE === 'production';
  const chain = isProduction ? base : baseSepolia;
  const usdcAddress = isProduction ? USDC_ADDRESS_BASE : USDC_ADDRESS_BASE_SEPOLIA;
  const explorerUrl = isProduction ? 'https://basescan.org' : 'https://sepolia.basescan.org';

  // Create public client for reading blockchain data
  const publicClient = createPublicClient({
    chain,
    transport: http()
  });

  // Get wallet information
  useEffect(() => {
    if (!privyReady || !walletsReady || !authenticated || authLoading) return;

    const determineWallet = async () => {
      try {
        // Check for smart wallet first
        const smartWallet = user?.linkedAccounts?.find((account: any) => account.type === 'smart_wallet');
        if (smartWallet) {
          setWalletInfo({
            address: smartWallet.address,
            type: 'smart_wallet',
            chainId: chain.id
          });
          return;
        }

        // Check for connected external wallet
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

        // Check for embedded wallet
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

        // No wallet found
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

  // Fetch balances
  const fetchBalances = async () => {
    if (!walletInfo?.address) return;

    try {
      setRefreshing(true);

      // Fetch native balance (ETH)
      const nativeBalanceWei = await publicClient.getBalance({
        address: walletInfo.address as Address
      });
      setNativeBalance(formatUnits(nativeBalanceWei, 18));

      // Fetch USDC balance
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

    try {
      setFundingInProgress(true);
      await fundWallet(walletInfo.address, {
        chain,
        asset: 'USDC',
        amount: '10', // Default to $10 USDC
        defaultFundingMethod: 'card',
        card: {
          preferredProvider: 'moonpay' // or 'coinbase'
        },
        uiConfig: {
          receiveFundsTitle: 'Fund Your Wallet with USDC',
          receiveFundsSubtitle: `Add USDC to your wallet on ${chain.name} to start using the platform.`
        }
      });
    } catch (error) {
      console.error('Funding error:', error);
      toast.error('Failed to initiate funding');
    } finally {
      setFundingInProgress(false);
    }
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

  if (loading || authLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!walletInfo) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Wallet Balance</CardTitle>
            <CardDescription>No wallet detected</CardDescription>
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
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <H1>Wallet Balance</H1>
        <p className="text-gray-600 mt-1">
          View your {chain.name} wallet balance and manage your funds
        </p>
      </div>

      {/* Wallet Info Card */}
      <Card className="mb-6">
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyAddress}
                  >
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
      <div className="grid gap-6 md:grid-cols-2">
        {/* USDC Balance */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">USDC Balance</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={fetchBalances}
                  disabled={refreshing}
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-3xl font-bold">
                  {usdcBalance ? (
                    <>
                      {parseFloat(usdcBalance.formatted).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6
                      })}
                      <span className="text-lg text-gray-500 ml-2">USDC</span>
                    </>
                  ) : (
                    <span className="text-gray-400">0.00 USDC</span>
                  )}
                </div>
                {usdcBalance && parseFloat(usdcBalance.formatted) > 0 && (
                  <p className="text-sm text-gray-500">
                    ≈ ${parseFloat(usdcBalance.formatted).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} USD
                  </p>
                )}
              </div>
              
              <Button
                onClick={handleFundUSDC}
                disabled={fundingInProgress || !walletInfo}
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
                    Fund USDC
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Native Balance */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">ETH Balance</CardTitle>
              <DSBadge variant="outline">Gas Token</DSBadge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold">
                {parseFloat(nativeBalance).toLocaleString('en-US', {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 6
                })}
                <span className="text-lg text-gray-500 ml-2">ETH</span>
              </div>
              <p className="text-sm text-gray-500">
                Used for transaction fees on {chain.name}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions for empty balance */}
      {parseFloat(usdcBalance?.formatted || '0') === 0 && (
        <Card className="mt-6 border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
              Get Started with USDC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              You'll need USDC to book services on the platform. Fund your wallet to get started!
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <Button 
                onClick={handleFundUSDC}
                disabled={fundingInProgress}
                className="w-full"
                size="lg"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Buy USDC with Card
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => {
                  if (walletInfo?.address) {
                    navigator.clipboard.writeText(walletInfo.address);
                    toast.success('Address copied! Send USDC from another wallet.');
                  }
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Address to Receive
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">About Your Wallet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            {walletInfo.type === 'smart_wallet' && (
              <>
                <p>
                  You're using a smart wallet powered by account abstraction. This provides enhanced security
                  and enables features like gas sponsorship and transaction batching.
                </p>
                <p>
                  Your smart wallet is controlled by your embedded signer and secured by Privy's infrastructure.
                </p>
              </>
            )}
            {walletInfo.type === 'embedded' && (
              <p>
                Your embedded wallet is securely managed by Privy. Only you have access to this wallet
                through your authenticated account.
              </p>
            )}
            {walletInfo.type === 'external' && (
              <p>
                You're using an external wallet (like MetaMask or WalletConnect). Make sure to keep your
                wallet secure and never share your private keys.
              </p>
            )}
            <p>
              USDC is a stablecoin pegged to the US Dollar. You can use it for payments and transactions
              on the {chain.name} network.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}