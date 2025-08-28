import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@privy-io/react-auth', '@supabase/supabase-js'],
  },
}));
