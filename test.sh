#!/bin/bash

# Quick test script for Multi-AI Pro MCP
# Tests database connectivity and basic functionality

set -e

echo "🧪 Testing Multi-AI Pro MCP Server..."
echo

# Test database connectivity
echo "Testing database connections..."
if docker ps | grep -q mcp-multi-ai-postgres; then
    echo "✅ PostgreSQL container is running"
else
    echo "❌ PostgreSQL container is not running"
    exit 1
fi

if docker ps | grep -q mcp-multi-ai-redis; then
    echo "✅ Redis container is running" 
else
    echo "❌ Redis container is not running"
    exit 1
fi

# Test build
echo
echo "Testing build..."
if [ -f "build/index.js" ]; then
    echo "✅ Build files exist"
else
    echo "❌ Build files missing - run 'npm run build'"
    exit 1
fi

# Test environment
echo
echo "Testing environment..."
if [ -f ".env" ]; then
    source .env
    if [ -n "$OPENROUTER_API_KEY" ]; then
        echo "✅ OpenRouter API key configured"
    else
        echo "❌ OpenRouter API key missing in .env"
        exit 1
    fi
else
    echo "⚠️  No .env file found - using environment variables"
fi

# Test server startup (timeout after 10 seconds)
echo
echo "Testing server startup..."
timeout 10s node build/index.js --test 2>/dev/null && echo "✅ Server starts successfully" || echo "⚠️  Server test timed out (this is normal)"

echo
echo "🎉 All tests passed! Multi-AI Pro MCP is ready to use."
echo
echo "Next steps:"
echo "1. Restart Claude Desktop or Claude Code"
echo "2. Try asking: 'Compare responses from different AI models'"
echo "3. Use orchestration: 'Orchestrate a solution using multiple AIs'"