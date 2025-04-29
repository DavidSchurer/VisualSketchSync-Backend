#!/bin/bash

# Simple deployment script for the backend server

# Check if environment variables are set
if [ -z "$CORS_ORIGIN" ]; then
  echo "Warning: CORS_ORIGIN is not set. Using wildcard (*) for development."
  export CORS_ORIGIN="*"
fi

if [ -z "$PORT" ]; then
  echo "Warning: PORT is not set. Using default port 4000."
  export PORT=4000
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Start the server
echo "Starting server on port $PORT with CORS origin: $CORS_ORIGIN"
node server.js 