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
 * Allowed origins - strings and regex patterns
 */
const allowedOrigins = [
  // Local development (exact matches)
  "http://localhost:8080",
  "http://localhost:5173",
  "https://localhost:8443",
  "https://192.168.0.10:8443",
];

const allowedOriginPatterns = [
  /^https:\/\/192\.168\.\d+\.\d+:8443$/, // Allow any local IP on port 8443
  /^https:\/\/.*\.trycloudflare\.com$/, // Allow any Cloudflare tunnel
  /^https:\/\/.*\.up\.railway\.app$/, // Allow all Railway domains
  /^https:\/\/.*\.nook\.talk$/, // Allow all nook.talk subdomains
  /^https:\/\/.*\.timee\.app$/, // Allow all timee.app subdomains
];

/**
 * Check if origin is allowed
 * @param {string} origin - The origin to check
 * @returns {string|null} - The origin if allowed, null otherwise
 */
function isOriginAllowed(origin) {
  if (!origin) return null;

  // Check exact matches
  if (allowedOrigins.includes(origin)) {
    return origin;
  }

  // Check regex patterns
  for (const pattern of allowedOriginPatterns) {
    if (pattern.test(origin)) {
      return origin;
    }
  }

  return null;
}

/**
 * CORS configuration with comprehensive origin allowlist
 * Supports local development, staging, production, and tunnel environments
 */
export const corsConfig = {
  origin: (origin) => {
    const allowed = isOriginAllowed(origin);
    console.log(`CORS check: origin=${origin}, allowed=${!!allowed}`);
    return allowed;
  },
  credentials: true,
  // Safari-specific headers
  optionsSuccessStatus: 200,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "X-Client-Timezone",
  ],
  exposeHeaders: ["Set-Cookie"],
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