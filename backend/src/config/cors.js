/**
 * CORS Configuration Module
 * 
 * Extracted from index.js for better modularity and maintainability.
 * Handles Cross-Origin Resource Sharing configuration for frontend domains,
 * including development, staging, production, and tunnel environments.
 * 
 * @extracted 2025-09-13
 */

import { cors } from "hono/cors";

/**
 * CORS configuration with comprehensive origin allowlist
 * Supports local development, staging, production, and tunnel environments
 */
export const corsConfig = {
  origin: [
    // Local development
    "http://localhost:8080",
    "http://localhost:5173",
    "https://localhost:8443",
    "https://192.168.0.10:8443",
    /^https:\/\/192\.168\.\d+\.\d+:8443$/, // Allow any local IP on port 8443
    
    // Cloudflare tunnels
    "https://roulette-phenomenon-airfare-claire.trycloudflare.com",
    /https:\/\/.*\.trycloudflare\.com$/, // Allow any Cloudflare tunnel
    
    // Railway deployment
    /https:\/\/.*\.up\.railway\.app$/, // Allow all Railway domains
    
    // Production domains
    "https://staging.nook.to", // Staging frontend domain
    /https:\/\/.*\.nook\.to$/, // Allow all nook.to subdomains
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
};

/**
 * Configure CORS middleware for Hono app
 * @param {Hono} app - Hono application instance
 */
export function configureCors(app) {
  app.use("*", cors(corsConfig));
  console.log("✅ CORS configuration applied");
}

export default corsConfig;