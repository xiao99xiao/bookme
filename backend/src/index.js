import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { getSupabaseAdmin } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import serviceRoutes from "./routes/services.js";
import bookingRoutes from "./routes/bookings.js";
import reviewRoutes from "./routes/reviews.js";
import conversationRoutes from "./routes/conversations.js";
import integrationRoutes from "./routes/integrations.js";
import uploadRoutes from "./routes/uploads.js";
import systemRoutes from "./routes/system.js";
import dotenv from "dotenv";
import { createServer } from "http";
import { setupWebSocket, getIO } from "./websocket.js";
import BlockchainService from "./blockchain-service.js";
import EIP712Signer from "./eip712-signer.js";
import BlockchainEventMonitor from "./event-monitor.js";

// Load environment variables
dotenv.config({ path: ".env" });

// CRITICAL: Add process-level error handlers to catch silent crashes
process.on("uncaughtException", (err) => {
  console.error("❌❌❌ UNCAUGHT EXCEPTION - SERVER WILL CRASH ❌❌❌");
  console.error("Error:", err);
  console.error("Stack:", err.stack);
  console.error("Time:", new Date().toISOString());
  // Log and exit to prevent undefined behavior
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌❌❌ UNHANDLED PROMISE REJECTION ❌❌❌");
  console.error("Reason:", reason);
  console.error("Promise:", promise);
  console.error("Time:", new Date().toISOString());
  // Convert to exception
  throw reason;
});

process.on("warning", (warning) => {
  console.warn("⚠️ Process Warning:", warning.name);
  console.warn("Message:", warning.message);
  console.warn("Stack:", warning.stack);
});

// Monitor process exit
process.on("exit", (code) => {
  console.log(
    `💀 Process exiting with code: ${code} at ${new Date().toISOString()}`,
  );
});

process.on("SIGTERM", () => {
  console.log("📛 SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("📛 SIGINT received, shutting down gracefully...");
  process.exit(0);
});

console.log("✅ Process error handlers installed");
console.log(`📍 Process started at: ${new Date().toISOString()}`);
console.log(`📍 Node version: ${process.version}`);
console.log(`📍 PID: ${process.pid}`);

// Initialize Hono app
const app = new Hono();

// Enable CORS for your frontend
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:8080",
      "http://localhost:5173",
      "https://localhost:8443",
      "https://192.168.0.10:8443",
      /^https:\/\/192\.168\.\d+\.\d+:8443$/, // Allow any local IP on port 8443
      "https://roulette-phenomenon-airfare-claire.trycloudflare.com",
      /https:\/\/.*\.trycloudflare\.com$/, // Allow any Cloudflare tunnel
      /https:\/\/.*\.up\.railway\.app$/, // Allow all Railway domains
      "https://staging.timee.app", // Staging frontend domain
      /https:\/\/.*\.timee\.app$/, // Allow all timee.app subdomains
    ],
    credentials: true,
    // Safari-specific headers
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["Set-Cookie"],
  }),
);

// Debug: Check if env vars are loaded
console.log("Privy App ID:", process.env.PRIVY_APP_ID ? "Set" : "Not set");
console.log(
  "Privy App Secret:",
  process.env.PRIVY_APP_SECRET ? "Set" : "Not set",
);

// Initialize blockchain services
const blockchainService = new BlockchainService();
const eip712Signer = new EIP712Signer();

// Initialize event monitor after supabaseAdmin is created
let eventMonitor;

// Test blockchain connection on startup
blockchainService.testConnection().then((result) => {
  if (result.success) {
    console.log("✅ Blockchain connection successful");
  } else {
    console.error("❌ Blockchain connection failed:", result.error);
  }
});

const supabaseAdmin = getSupabaseAdmin();

// Initialize blockchain event monitor
eventMonitor = new BlockchainEventMonitor(supabaseAdmin);

// Start event monitoring in production or when explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_BLOCKCHAIN_MONITORING === 'true') {
  eventMonitor.startMonitoring().then(() => {
    console.log('🚀 Blockchain event monitoring started');
  }).catch(error => {
    console.error('❌ Failed to start blockchain event monitoring:', error);
  });
} else {
  console.log('⏸️ Blockchain event monitoring disabled (set ENABLE_BLOCKCHAIN_MONITORING=true to enable)');
}
console.log('🧪 TEST MODE: Blockchain event monitoring ENABLED for memory comparison');

// Initialize auth routes
authRoutes(app);
// Register user/profile routes
userRoutes(app);
// Register service routes
serviceRoutes(app);
// Register booking routes
bookingRoutes(app);
// Register review routes
reviewRoutes(app);
// Register conversation routes
conversationRoutes(app);
// Register integration routes
integrationRoutes(app);
// Register upload routes
uploadRoutes(app);
// Register system routes
systemRoutes(app);

// Export app for use in HTTPS server
export default app;

// Only start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Start server with WebSocket support
  const port = process.env.PORT || 4000;
  console.log(`🚀 Server starting on port ${port}...`);

  // Create HTTP server
  const server = serve(
    {
      fetch: app.fetch,
      port: port,
      createServer: createServer,
    },
    (info) => {
      console.log(`✅ Server running at http://localhost:${info.port}`);
      console.log(`📝 Health check: http://localhost:${info.port}/health`);
      console.log(`🔌 WebSocket server ready`);
    },
  );

  // Setup WebSocket server
  const io = setupWebSocket(server);

  // Add heartbeat logging to track when server crashes
  let heartbeatCount = 0;
  const heartbeatInterval = setInterval(() => {
    heartbeatCount++;
    const uptime = Math.floor(process.uptime());
    const memory = process.memoryUsage();
    console.log(
      `💓 Heartbeat #${heartbeatCount} - Uptime: ${uptime}s - Memory: RSS ${Math.round(memory.rss / 1024 / 1024)}MB, Heap ${Math.round(memory.heapUsed / 1024 / 1024)}MB/${Math.round(memory.heapTotal / 1024 / 1024)}MB - Time: ${new Date().toISOString()}`,
    );

    // Check for memory leaks
    if (memory.heapUsed / memory.heapTotal > 0.9) {
      console.warn("⚠️ High memory usage detected (>90% heap)");
    }
  }, 10000); // Log every 10 seconds

  // Clean up on exit
  process.on("beforeExit", () => {
    clearInterval(heartbeatInterval);
    console.log("🔚 Server shutting down, clearing intervals...");
  });
}
