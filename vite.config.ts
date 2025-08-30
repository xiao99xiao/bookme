import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath, URL } from "url";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    watch: {
      usePolling: false,
      interval: 100,
    },
    hmr: {
      clientPort: 443,
    },
    allowedHosts: [
      '.trycloudflare.com', // Allow all Cloudflare tunnel domains
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
      "@": process.cwd().endsWith('/src') 
        ? process.cwd()  // If already in src, use it directly
        : path.resolve(process.cwd(), "./src"),
    },
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      '@privy-io/react-auth', 
      '@privy-io/react-auth/smart-wallets',
      '@supabase/supabase-js',
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
