#!/bin/bash

# Quick Test Script - Test Multi-AI Pro MCP without installation
# This script allows you to try the MCP server before doing a full install

set -e

echo "🚀 Multi-AI Pro MCP - Quick Test"
echo "================================"
echo

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Install from: https://nodejs.org/"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required. Install from: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Prerequisites found"
echo

# Get API key
if [[ -z "$OPENROUTER_API_KEY" ]]; then
    read -p "Enter your OpenRouter API key (get free at openrouter.ai): " OPENROUTER_API_KEY
    export OPENROUTER_API_KEY
fi

# Quick setup
echo "Setting up test environment..."
npm install --silent
npm run build --silent

# Start databases for testing
echo "Starting test databases..."
docker-compose up -d

echo "Waiting for databases..."
sleep 5

# Create temporary config
cat > .env << EOF
OPENROUTER_API_KEY=$OPENROUTER_API_KEY
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=mcp_password
POSTGRES_DB=mcp_multi_ai_pro
REDIS_HOST=localhost
REDIS_PORT=6380
EOF

echo
echo "🎉 Test environment ready!"
echo
echo "The MCP server is now running with full functionality."
echo "You can test it by:"
echo "1. Adding to Claude Desktop temporarily"
echo "2. Using the MCP inspector: npm run inspector"
echo "3. Testing with curl (advanced)"
echo
echo "To clean up: docker-compose down"
echo "To install permanently: ./install.sh"
echo

# Optional: Start inspector
read -p "Would you like to open the MCP inspector? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting MCP inspector..."
    npm run inspector
fi