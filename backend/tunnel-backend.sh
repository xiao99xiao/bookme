#!/bin/bash

# Start backend server
echo "Starting backend server on port 4000..."
npm start &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start Cloudflare tunnel for backend
echo "Starting Cloudflare tunnel for backend..."
npx cloudflared tunnel --url http://localhost:4000

# Cleanup on exit
trap "kill $BACKEND_PID" EXIT