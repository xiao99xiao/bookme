import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath, URL } from "url";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',
  server: {
    host: "::",
    port: process.env.VITE_HTTPS === 'true' ? 8443 : 8080,
    https: process.env.VITE_HTTPS === 'true' ? {
      cert: './certs/cert.pem',
      key: './certs/key.pem'
    } : undefined,
    watch: {
      usePolling: false,
      interval: 100,
    },
    hmr: {
      clientPort: process.env.VITE_HTTPS === 'true' ? 8443 : 443,
    },
    allowedHosts: [
      '.trycloudflare.com', // Allow all Cloudflare tunnel domains
      '.nook.to', // Allow all nook.to subdomains
      '.timee.app', // Allow staging domain (temporary)
      'localhost',
      '.localhost',
    ],
  },
  preview: {
    host: '0.0.0.0',
    port: process.env.PORT ? parseInt(process.env.PORT) : 4173,
    allowedHosts: [
      '.up.railway.app', // Allow all Railway domains
      '.trycloudflare.com', // Allow all Cloudflare tunnel domains
      '.nook.to', // Allow all nook.to subdomains
      '.timee.app', // Allow staging domain (temporary)
      'localhost',
      '.localhost',
    ],
  },
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@privy-io/react-auth',
      '@privy-io/react-auth/smart-wallets',
      'viem',
      'permissionless'
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
}));
