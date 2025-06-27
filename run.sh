#!/bin/bash

# Multi-AI Pro MCP Server Runner
# This script loads environment variables and runs the server

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Source global MCP environment if available
if [ -f "$HOME/.config/claude/mcp-env.sh" ]; then
    source "$HOME/.config/claude/mcp-env.sh"
fi

# If OPENROUTER_API_KEY is not set, load from .env
if [ -z "$OPENROUTER_API_KEY" ]; then
    if [ -f "$DIR/.env" ]; then
        set -a
        source "$DIR/.env"
        set +a
    fi
fi

# Export all required environment variables
export OPENROUTER_API_KEY="${OPENROUTER_API_KEY}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export POSTGRES_PORT="${POSTGRES_PORT:-5433}"
export POSTGRES_USER="${POSTGRES_USER:-mcp_user}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-mcp_password}"
export POSTGRES_DB="${POSTGRES_DB:-mcp_multi_ai_pro}"
export REDIS_HOST="${REDIS_HOST:-localhost}"
export REDIS_PORT="${REDIS_PORT:-6380}"

# Check if databases are running
if ! docker ps | grep -q mcp-multi-ai-postgres; then
    echo "Starting databases..."
    cd "$DIR" && docker-compose up -d
    echo "Waiting for databases to be ready..."
    sleep 5
fi

# Run the MCP server
exec node "$DIR/build/index.js"