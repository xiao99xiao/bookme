import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { PrivyProvider } from '@privy-io/react-auth'
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets'
import { base, baseSepolia } from 'viem/chains'

createRoot(document.getElementById("root")!).render(
  <PrivyProvider
    appId={import.meta.env.VITE_PRIVY_APP_ID}
    config={{
      appearance: {
        theme: 'light'
      },
      defaultChain: import.meta.env.MODE === 'production' ? base : baseSepolia,
      supportedChains: [base, baseSepolia],
      embeddedWallets: {
        ethereum: {
          createOnLogin: 'users-without-wallets'
        }
      }
    }}
  >
    <SmartWalletsProvider
      config={{
        sponsorGas: true
      }}
    >
      <App />
    </SmartWalletsProvider>
  </PrivyProvider>
);
