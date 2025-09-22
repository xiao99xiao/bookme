import { Hono } from "hono";
import { serve } from "@hono/node-server";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import serviceRoutes from "./routes/services.js";
import bookingRoutes from "./routes/bookings.js";
import reviewRoutes from "./routes/reviews.js";
import conversationRoutes from "./routes/conversations.js";
import integrationRoutes from "./routes/integrations.js";
import uploadRoutes from "./routes/uploads.js";
import systemRoutes from "./routes/system.js";
import transactionRoutes from "./routes/transactions.js";
import referralRoutes from "./routes/referrals.js";
import { createServer } from "http";
import { setupWebSocket, getIO } from "./websocket.js";

// Configuration imports
import { configureCors } from "./config/cors.js";
import { setupBlockchain } from "./config/blockchain.js";
import { setupServer, setupHeartbeatMonitoring } from "./config/server.js";
// Setup server configuration (environment, error handlers, graceful shutdown)
setupServer();

// Initialize Hono app
const app = new Hono();

// Configure CORS using extracted configuration
configureCors(app);

// Setup blockchain services using extracted configuration
setupBlockchain();

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
// Register transaction routes
transactionRoutes(app);
// Register referral routes
referralRoutes(app);

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

  // Setup heartbeat monitoring using extracted configuration
  setupHeartbeatMonitoring();
}
