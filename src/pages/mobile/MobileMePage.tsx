import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ChevronRight, LogOut, CreditCard, ArrowUpDown, Globe, Plug, AtSign, DollarSign, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { ApiClient } from '@/lib/api-migration';
import { toast } from 'sonner';
import { H2, H3, Text, Description, Loading } from '@/design-system';
import BecomeProviderDialog from '@/components/BecomeProviderDialog';
import { useBlockchainService } from '@/lib/blockchain-service';

const STORAGE_KEY = 'bookme_user_mode';

type UserMode = 'customer' | 'provider' | null;

// iOS-style grouped list section component
const GroupedSection = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl border border-[#eeeeee] overflow-hidden ${className}`}>
    {children}
  </div>
);

// iOS-style list item component
const ListItem = ({
  icon: Icon,
  label,
  value,
  onClick,
  showChevron = true,
  isDestructive = false,
  className = ''
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  onClick?: () => void;
  showChevron?: boolean;
  isDestructive?: boolean;
  className?: string;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors ${
      onClick ? 'hover:bg-gray-50 active:bg-gray-100' : ''
    } ${className}`}
    disabled={!onClick}
  >
    <div className="flex items-center gap-3">
      {Icon && (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          isDestructive ? 'bg-red-50' : 'bg-gray-100'
        }`}>
          <Icon className={`w-5 h-5 ${isDestructive ? 'text-red-500' : 'text-gray-600'}`} />
        </div>
      )}
      <Text
        variant="small"
        className={`font-medium ${isDestructive ? 'text-red-500' : 'text-black'}`}
      >
        {label}
      </Text>
    </div>
    <div className="flex items-center gap-2">
      {value && (
        <Description className="text-[#999999]">
          {value}
        </Description>
      )}
      {showChevron && onClick && (
        <ChevronRight className="w-5 h-5 text-[#999999]" />
      )}
    </div>
  </button>
);

// Divider component
const Divider = () => <div className="h-[1px] bg-[#eeeeee] mx-4" />;

export default function MobileMePage() {
  const { authenticated, profile, userId, logout, refreshProfile, ready } = useAuth();
  const { user, ready: privyReady, fundWallet } = usePrivy();
  const { wallets } = useWallets();
  const { client: smartWallet } = useSmartWallets();
  const { blockchainService, initializeService } = useBlockchainService();
  const navigate = useNavigate();

  const [userMode, setUserMode] = useState<UserMode>(null);
  const [balance, setBalance] = useState<string>('0.00');
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [showBecomeProviderDialog, setShowBecomeProviderDialog] = useState(false);
  const [isBecomingProvider, setIsBecomingProvider] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Initialize user mode
  useEffect(() => {
    if (authenticated && profile && ready) {
      const storedMode = localStorage.getItem(STORAGE_KEY) as UserMode;
      if (storedMode === 'customer' || storedMode === 'provider') {
        setUserMode(storedMode);
      } else {
        const defaultMode = profile.is_provider ? 'provider' : 'customer';
        setUserMode(defaultMode);
        localStorage.setItem(STORAGE_KEY, defaultMode);
      }
    }
  }, [authenticated, profile, ready]);

  // Get wallet address
  useEffect(() => {
    if (!user || !wallets) return;

    // Try to get smart wallet first
    const smartWalletAccount = user?.linkedAccounts?.find((account: any) => account.type === 'smart_wallet');
    if (smartWalletAccount) {
      setWalletAddress(smartWalletAccount.address);
      return;
    }

    // Fall back to embedded or external wallet
    if (wallets.length > 0) {
      setWalletAddress(wallets[0].address);
    }
  }, [user, wallets]);

  // Load wallet balance
  useEffect(() => {
    if (authenticated && walletAddress) {
      loadBalance();
    }
  }, [authenticated, walletAddress]);

  const loadBalance = async () => {
    try {
      setLoadingBalance(true);

      // Initialize blockchain service if needed
      if (!blockchainService) {
        await initializeService();
      }

      // Get USDC balance from blockchain
      if (walletAddress && blockchainService) {
        const usdcBalance = await blockchainService.getUSDCBalance(walletAddress);
        setBalance(usdcBalance);
      } else {
        setBalance('0.00');
      }
    } catch (error) {
      console.error('Failed to load balance:', error);
      setBalance('0.00');
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleModeSwitch = () => {
    if (!userMode) return;

    const newMode: UserMode = userMode === 'customer' ? 'provider' : 'customer';
    setUserMode(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);

    // Navigate to appropriate landing
    if (newMode === 'provider') {
      navigate('/provider/services');
    } else {
      navigate('/customer/bookings');
    }
  };

  const handleBecomeProvider = () => {
    if (profile?.is_provider) {
      handleModeSwitch();
    } else {
      setShowBecomeProviderDialog(true);
    }
  };

  const handleConfirmBecomeProvider = async () => {
    if (!userId || !profile) return;

    setIsBecomingProvider(true);
    try {
      await ApiClient.updateProfile({ is_provider: true }, userId);
      await refreshProfile();

      setUserMode('provider');
      localStorage.setItem(STORAGE_KEY, 'provider');
      setShowBecomeProviderDialog(false);

      navigate('/provider/services');
      toast.success('Welcome to provider mode! You can now create services.');
    } catch (error) {
      console.error('Failed to become provider:', error);
      toast.error('Failed to enable provider mode. Please try again.');
    } finally {
      setIsBecomingProvider(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem(STORAGE_KEY);
    setUserMode(null);
    await logout();
    navigate('/');
  };

  const handleFundWallet = async () => {
    if (!user) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      await fundWallet();
    } catch (error) {
      console.error('Failed to fund wallet:', error);
      toast.error('Failed to fund wallet');
    }
  };

  const handleWithdraw = () => {
    // Navigate to balance page for withdrawal
    navigate('/balance');
  };

  // If not ready, show loading
  if (!ready || !privyReady) {
    return (
      <div className="lg:hidden min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading variant="spinner" size="lg" text="Loading..." />
      </div>
    );
  }

  // If not authenticated, show auth UI
  if (!authenticated) {
    return (
      <div className="lg:hidden min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <H2 className="mb-2">Welcome to Timee</H2>
            <Text variant="small" color="secondary">
              Sign in to manage your account
            </Text>
          </div>
          <Button
            onClick={() => navigate('/auth')}
            className="w-full"
            size="lg"
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  const userName = profile?.display_name || 'User';
  const userEmail = user?.email?.address || '';

  return (
    <div className="lg:hidden min-h-screen bg-gray-50 pb-20">
      <div className="px-4 py-6 space-y-4">
        {/* Page Title */}
        <div className="mb-6">
          <H2>Me</H2>
        </div>

        {/* User Profile Section */}
        <GroupedSection>
          <button
            onClick={() => navigate('/mobile/profile')}
            className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <Avatar className="w-12 h-12">
              <AvatarImage src={profile?.avatar} alt={userName} />
              <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 text-white font-semibold">
                {userName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left">
              <Text className="font-semibold text-black">
                {userName}
              </Text>
              {userEmail && (
                <Description className="text-[#666666]">
                  {userEmail}
                </Description>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-[#999999]" />
          </button>
        </GroupedSection>

        {/* Settings Section */}
        <GroupedSection>
          <ListItem
            icon={AtSign}
            label="Username"
            value={profile?.username || 'Set username'}
            onClick={() => navigate('/mobile/username')}
          />
          <Divider />
          <ListItem
            icon={Globe}
            label="Timezone"
            value={profile?.timezone || 'UTC'}
            onClick={() => navigate('/mobile/timezone')}
          />
          {userMode === 'provider' && (
            <>
              <Divider />
              <ListItem
                icon={Plug}
                label="Integrations"
                onClick={() => navigate('/mobile/integrations')}
              />
              <Divider />
              <ListItem
                icon={DollarSign}
                label="Income"
                onClick={() => navigate('/provider/income')}
              />
              <Divider />
              <ListItem
                icon={Users}
                label="Referrals"
                onClick={() => navigate('/provider/referrals')}
              />
            </>
          )}
        </GroupedSection>

        {/* Mode Switch Section */}
        <GroupedSection>
          {!profile?.is_provider ? (
            <button
              onClick={handleBecomeProvider}
              className="w-full px-4 py-3.5 text-center hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <Text className="font-semibold text-blue-600">
                Become a Provider
              </Text>
              <Description className="text-[#666666] mt-0.5">
                Start earning by offering services
              </Description>
            </button>
          ) : (
            <button
              onClick={handleModeSwitch}
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <ArrowUpDown className="w-5 h-5 text-blue-600" />
                </div>
                <Text className="font-medium text-black">
                  Switch to {userMode === 'customer' ? 'Provider' : 'Customer'} Mode
                </Text>
              </div>
              <ChevronRight className="w-5 h-5 text-[#999999]" />
            </button>
          )}
        </GroupedSection>

        {/* Wallet Section */}
        <GroupedSection>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-600" />
                <Text className="font-semibold text-black">Wallet Balance</Text>
              </div>
              <Text className="font-bold text-lg text-black">
                {loadingBalance ? '...' : `${balance} USDC`}
              </Text>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleFundWallet}
                size="sm"
                className="flex-1"
              >
                Fund
              </Button>
              <Button
                onClick={handleWithdraw}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Withdraw
              </Button>
            </div>
          </div>
        </GroupedSection>

        {/* Logout Section */}
        <GroupedSection>
          <ListItem
            icon={LogOut}
            label="Log Out"
            onClick={handleLogout}
            showChevron={false}
            isDestructive={true}
          />
        </GroupedSection>
      </div>

      {/* Become Provider Dialog */}
      <BecomeProviderDialog
        open={showBecomeProviderDialog}
        onOpenChange={setShowBecomeProviderDialog}
        onConfirm={handleConfirmBecomeProvider}
        isLoading={isBecomingProvider}
      />
    </div>
  );
}