import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ChevronRight, LogOut, CreditCard, ArrowUpDown, Globe, Plug, DollarSign, Users, Star, MapPin, Copy, Check, X, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { ApiClient } from '@/lib/api-migration';
import { toast } from 'sonner';
import { H2, H3, Text, Description, Loading } from '@/design-system';
import BecomeProviderDialog from '@/components/BecomeProviderDialog';
import { useBlockchainService } from '@/lib/blockchain-service';
import ReactMarkdown from 'react-markdown';

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
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  // Username editing state
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editingUsername, setEditingUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'checking' | 'available' | 'taken' | null>(null);
  const [usernameCheckTimeout, setUsernameCheckTimeout] = useState<NodeJS.Timeout | null>(null);

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

    // Stay on Me page when toggling from the mobile Me page
    // Don't navigate away like other parts of the app do
    toast.success(`Switched to ${newMode} mode`);
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

  // Username editing functions
  const startEditingUsername = () => {
    setIsEditingUsername(true);
    setEditingUsername(profile?.username || '');
    setUsernameStatus(null);
  };

  const checkUsernameAvailability = async (username: string) => {
    if (!username || username === profile?.username) {
      setUsernameStatus(null);
      return;
    }

    try {
      setUsernameStatus('checking');
      const result = await ApiClient.checkUsernameAvailability(username);
      setUsernameStatus(result.available ? 'available' : 'taken');
    } catch (error) {
      setUsernameStatus('taken');
    }
  };

  const handleUsernameChange = (value: string) => {
    setEditingUsername(value);

    // Clear previous timeout
    if (usernameCheckTimeout) {
      clearTimeout(usernameCheckTimeout);
    }

    // Set new timeout for checking availability
    const timeout = setTimeout(() => {
      checkUsernameAvailability(value);
    }, 500);

    setUsernameCheckTimeout(timeout);
  };

  const submitUsernameChange = async () => {
    if (!editingUsername || editingUsername === profile?.username) {
      setIsEditingUsername(false);
      return;
    }

    if (usernameStatus !== 'available') {
      toast.error('Username is not available');
      return;
    }

    try {
      await ApiClient.updateUsername(editingUsername);
      await refreshProfile(); // Refresh to get updated profile
      setIsEditingUsername(false);
      toast.success('Username updated successfully!');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update username');
    }
  };

  const cancelEditingUsername = () => {
    setIsEditingUsername(false);
    setEditingUsername('');
    setUsernameStatus(null);
    if (usernameCheckTimeout) {
      clearTimeout(usernameCheckTimeout);
    }
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
      <div className="space-y-4">
        {/* Mode Toggle - Top of page */}
        {profile?.is_provider && (
          <div className="px-4 pt-4">
            <div className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
              userMode === 'provider'
                ? 'bg-blue-50 border border-blue-200'
                : 'bg-green-50 border border-green-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${
                  userMode === 'provider' ? 'text-blue-700' : 'text-green-700'
                }`}>
                  {userMode === 'provider' ? 'Provider' : 'Customer'} mode
                </span>
              </div>
              <button
                onClick={handleModeSwitch}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  userMode === 'provider'
                    ? 'bg-blue-600 focus:ring-blue-500'
                    : 'bg-green-600 focus:ring-green-500'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    userMode === 'provider' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Profile Header Section - No border, Twitter-like */}
        <div className="px-4 py-6">
          <div className="flex gap-4 items-start mb-4">
            {/* Avatar */}
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarImage
                src={profile?.avatar || ""}
                alt={userName}
              />
              <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 text-white font-semibold text-lg">
                {userName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Name and Info */}
            <div className="flex-1 min-w-0">
              <H3 className="font-semibold text-black mb-1">
                {userName}
              </H3>

              {/* Rating and Location */}
              <div className="flex flex-wrap gap-2 mb-2">
                {profile?.rating !== undefined && profile?.review_count !== undefined && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-gray-600 fill-current" />
                    <Description className="text-gray-600">
                      {profile.rating.toFixed(1)} ({profile.review_count} reviews)
                    </Description>
                  </div>
                )}
                {profile?.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-gray-600" />
                    <Description className="text-gray-600">
                      {profile.location}
                    </Description>
                  </div>
                )}
              </div>
            </div>

            {/* Edit Profile Button */}
            <Button
              onClick={() => navigate('/mobile/profile')}
              variant="outline"
              size="xs"
            >
              Edit
            </Button>
          </div>

          {/* Bio */}
          {profile?.bio && (
            <div className="mt-3">
              <div
                className={`text-sm text-gray-700 leading-relaxed ${
                  !isBioExpanded ? 'line-clamp-3' : ''
                }`}
              >
                <ReactMarkdown
                  components={{
                    // Render everything as plain text with consistent paragraph styling
                    p: ({ children }) => <span>{children}</span>,
                    h1: ({ children }) => <span>{children}</span>,
                    h2: ({ children }) => <span>{children}</span>,
                    h3: ({ children }) => <span>{children}</span>,
                    h4: ({ children }) => <span>{children}</span>,
                    h5: ({ children }) => <span>{children}</span>,
                    h6: ({ children }) => <span>{children}</span>,
                    ul: ({ children }) => <span>{children}</span>,
                    ol: ({ children }) => <span>{children}</span>,
                    li: ({ children }) => <span>• {children}</span>,
                    blockquote: ({ children }) => <span>{children}</span>,
                    strong: ({ children }) => <strong>{children}</strong>,
                    em: ({ children }) => <em>{children}</em>,
                    a: ({ children, href }) => (
                      <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    ),
                    br: () => <span> </span>,
                  }}
                >
                  {profile.bio}
                </ReactMarkdown>
              </div>
              {profile.bio.length > 150 && (
                <button
                  onClick={() => setIsBioExpanded(!isBioExpanded)}
                  className="text-sm text-blue-600 hover:text-blue-700 mt-1 font-medium"
                >
                  {isBioExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}

          {/* Profile Link Share */}
          {profile?.username && (
            <div className="mt-4">
              {!isEditingUsername ? (
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-600">
                    <span className="select-all">
                      {window.location.host}/
                      <button
                        onClick={startEditingUsername}
                        className="underline decoration-dotted decoration-gray-400 hover:decoration-gray-600 transition-colors leading-5"
                      >
                        {profile.username}
                      </button>
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const profileUrl = `${window.location.origin}/${profile.username}`;
                        await navigator.clipboard.writeText(profileUrl);
                        toast.success('Profile link copied!');
                      } catch (error) {
                        toast.error('Failed to copy link');
                      }
                    }}
                    className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded-md transition-colors"
                    aria-label="Copy profile link"
                  >
                    <Copy className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-600 flex items-center">
                    <span>{window.location.host}/</span>
                    <input
                      value={editingUsername}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          submitUsernameChange();
                        } else if (e.key === 'Escape') {
                          cancelEditingUsername();
                        }
                      }}
                      className="bg-transparent border-none outline-none text-sm text-gray-600 underline decoration-dotted decoration-gray-400 hover:decoration-gray-600 transition-colors min-w-[120px] focus:ring-0 p-0 leading-5 h-5"
                      autoFocus
                      placeholder="username"
                    />
                  </div>
                  <div className="flex items-center w-7 h-7 justify-center">
                    {usernameStatus === 'checking' && (
                      <Loader2 className="h-3.5 w-3.5 text-gray-400 animate-spin" />
                    )}
                    {usernameStatus === 'available' && (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    )}
                    {usernameStatus === 'taken' && (
                      <X className="h-3.5 w-3.5 text-red-500" />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-4 space-y-4">

        {/* Settings Section */}
        <GroupedSection>
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

        {/* Become Provider Section - Only show for non-providers */}
        {!profile?.is_provider && (
          <GroupedSection>
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
          </GroupedSection>
        )}

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