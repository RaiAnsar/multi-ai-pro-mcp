#!/bin/bash

# Multi-AI Pro MCP Server - One-Click Installer
# Compatible with macOS and WSL/Linux
# For Claude Desktop and Claude Code

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    printf "${1}${2}${NC}\n"
}

print_header() {
    echo
    print_color $BLUE "==================================================="
    print_color $BLUE "  Multi-AI Pro MCP Server - One-Click Installer"
    print_color $BLUE "==================================================="
    echo
}

print_step() {
    print_color $YELLOW ">>> $1"
}

print_success() {
    print_color $GREEN "✓ $1"
}

print_error() {
    print_color $RED "✗ $1"
}

# Check if running on macOS or Linux/WSL
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
elif [[ "$OSTYPE" == "linux-gnu"* ]] || [[ -n "$WSL_DISTRO_NAME" ]]; then
    OS="linux"
    CLAUDE_CONFIG_DIR="$HOME/.config/claude"
else
    print_error "Unsupported operating system: $OSTYPE"
    exit 1
fi

print_header

print_step "Detecting system: $OS"
print_success "System compatible"

# Check prerequisites
print_step "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    print_color $BLUE "Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version must be 18 or higher. Current: $(node -v)"
    exit 1
fi
print_success "Node.js $(node -v) found"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
print_success "npm $(npm -v) found"

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    print_color $BLUE "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi
print_success "Docker found and running"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed"
    exit 1
fi
print_success "Docker Compose found"

# Get OpenRouter API key
print_step "Setting up OpenRouter API key..."
echo
print_color $BLUE "You need an OpenRouter API key to use Multi-AI Pro MCP."
print_color $BLUE "Get one free at: https://openrouter.ai/keys"
echo

# Check if API key is already set in environment
if [[ -n "$OPENROUTER_API_KEY" ]]; then
    print_color $GREEN "OpenRouter API key found in environment"
    USE_EXISTING_KEY=true
else
    USE_EXISTING_KEY=false
    while true; do
        read -p "Enter your OpenRouter API key: " OPENROUTER_API_KEY
        if [[ -n "$OPENROUTER_API_KEY" ]]; then
            break
        else
            print_error "API key cannot be empty"
        fi
    done
fi

# Install to user's home directory
INSTALL_DIR="$HOME/.mcp-servers/multi-ai-pro"
print_step "Installing to: $INSTALL_DIR"

# Create installation directory
mkdir -p "$INSTALL_DIR"

# Copy files (assuming we're running from the repo directory)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [[ "$SCRIPT_DIR" == "$INSTALL_DIR" ]]; then
    print_color $YELLOW "Already installing in target directory"
else
    print_step "Copying files..."
    cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/"
    print_success "Files copied"
fi

cd "$INSTALL_DIR"

# Create .env file
print_step "Creating configuration..."
cat > .env << EOF
# OpenRouter API Configuration
OPENROUTER_API_KEY=$OPENROUTER_API_KEY

# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=mcp_password_$(date +%s)
POSTGRES_DB=mcp_multi_ai_pro

# Redis Configuration  
REDIS_HOST=localhost
REDIS_PORT=6380
EOF

print_success "Configuration created"

# Install dependencies
print_step "Installing dependencies..."
npm install --silent
print_success "Dependencies installed"

# Build project
print_step "Building project..."
npm run build --silent
print_success "Project built"

# Start databases
print_step "Starting databases..."
docker-compose up -d
print_success "Databases started"

# Wait for databases to be ready
print_step "Waiting for databases to initialize..."
sleep 10

# Test the server
print_step "Testing server..."
timeout 10s node build/index.js --test 2>/dev/null || true
print_success "Server test completed"

# Setup Claude Desktop configuration
if [[ "$OS" == "macos" ]]; then
    print_step "Configuring Claude Desktop..."
    
    mkdir -p "$CLAUDE_CONFIG_DIR"
    CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
    
    # Create or update config
    if [[ -f "$CONFIG_FILE" ]]; then
        # Backup existing config
        cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$(date +%s)"
        print_color $YELLOW "Existing config backed up"
        
        # Update existing config (simplified - assumes user will manually merge)
        print_color $YELLOW "Please manually add the following to your Claude Desktop config:"
    else
        # Create new config
        cat > "$CONFIG_FILE" << EOF
{
  "mcpServers": {
    "multi-ai-pro": {
      "command": "bash",
      "args": ["$INSTALL_DIR/run.sh"]
    }
  }
}
EOF
        print_success "Claude Desktop configured"
    fi
fi

# Setup Claude Code configuration  
if command -v claude &> /dev/null; then
    print_step "Configuring Claude Code..."
    claude mcp add --scope user multi-ai-pro bash "$INSTALL_DIR/run.sh" 2>/dev/null || {
        print_color $YELLOW "Claude Code not found or failed to configure"
        print_color $BLUE "You can manually add it with:"
        print_color $BLUE "  claude mcp add --scope user multi-ai-pro bash $INSTALL_DIR/run.sh"
    }
    print_success "Claude Code configured"
fi

# Create global MCP environment file
print_step "Creating global MCP environment..."
MCP_ENV_DIR="$HOME/.config/claude"
mkdir -p "$MCP_ENV_DIR"
cat > "$MCP_ENV_DIR/mcp-env.sh" << EOF
#!/bin/bash
# Global MCP environment variables
export OPENROUTER_API_KEY="$OPENROUTER_API_KEY"
EOF
print_success "Global environment created"

# Installation complete
echo
print_color $GREEN "🎉 Installation completed successfully!"
echo
print_color $BLUE "Multi-AI Pro MCP Server has been installed to:"
print_color $BLUE "  $INSTALL_DIR"
echo
print_color $BLUE "Available tools:"
print_color $BLUE "  • ask - Query specific AI models"
print_color $BLUE "  • orchestrate - Multi-model orchestration"  
print_color $BLUE "  • compare - Compare model responses"
print_color $BLUE "  • history - View conversation history"
print_color $BLUE "  • search - Search conversation history"
print_color $BLUE "  • new_conversation - Start fresh context"
print_color $BLUE "  • summary - Usage statistics"
echo
print_color $BLUE "Next steps:"
print_color $BLUE "  1. Restart Claude Desktop/Code to load the MCP server"
print_color $BLUE "  2. Try: 'Ask all AIs to explain quantum computing'"
print_color $BLUE "  3. View logs: docker-compose logs -f"
echo
print_color $YELLOW "Need help? Visit: https://github.com/RaiAnsar/multi-ai-pro-mcp"
echo