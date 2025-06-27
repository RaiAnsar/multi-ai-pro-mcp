# Multi-AI Pro MCP Server

An advanced MCP (Model Context Protocol) server that enables orchestration of multiple AI models with persistent context management using PostgreSQL and Redis.

## Features

- 🤖 **100+ AI Models**: Access to Claude, GPT-4, Gemini, DeepSeek, Llama, and more via OpenRouter
- 💾 **Persistent Context**: Conversation history stored in PostgreSQL with Redis caching
- 🎯 **Smart Orchestration**: Multiple strategies including sequential, parallel, debate, and consensus
- 🔍 **Context Search**: Search through conversation history
- 📊 **Usage Analytics**: Track token usage and model performance
- 🚀 **One-Click Install**: Automated setup for macOS and WSL/Linux

## Quick Install (Recommended)

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- OpenRouter API key (get free at [openrouter.ai](https://openrouter.ai/keys))

### One-Click Installation

```bash
# Clone and install
git clone https://github.com/RaiAnsar/multi-ai-pro-mcp.git
cd multi-ai-pro-mcp
chmod +x install.sh
./install.sh
```

The installer will:
- ✅ Check all prerequisites
- ✅ Set up databases automatically
- ✅ Configure Claude Desktop/Code
- ✅ Ask for your OpenRouter API key
- ✅ Test the installation

### Manual Installation

If you prefer manual setup:

## Configuration

### Environment Variables

Create a `.env` file or set these environment variables:

```bash
# Required
OPENROUTER_API_KEY=your_openrouter_api_key

# Database Configuration (with defaults)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=mcp_password
POSTGRES_DB=mcp_multi_ai_pro

# Redis Configuration (with defaults)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Database Setup

Using Docker Compose (recommended):

```bash
docker-compose up -d
```

Or manually:

```sql
CREATE DATABASE mcp_multi_ai_pro;
CREATE USER mcp_user WITH PASSWORD 'mcp_password';
GRANT ALL PRIVILEGES ON DATABASE mcp_multi_ai_pro TO mcp_user;
```

## Usage

### With Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "multi-ai-pro": {
      "command": "/path/to/mcp-multi-ai-pro/run.sh"
    }
  }
}
```

### With Claude CLI

```bash
claude mcp add multi-ai-pro /path/to/mcp-multi-ai-pro/run.sh
```

## Available Tools

### ask
Ask a question to a specific AI model with persistent context.

```typescript
ask({
  prompt: "Explain quantum computing",
  model: "openai/gpt-4o", // optional, defaults to top model
  temperature: 0.7,       // optional
  useContext: true        // optional, use conversation history
})
```

### orchestrate
Orchestrate a task across multiple AI models using various strategies.

```typescript
orchestrate({
  prompt: "Design a REST API for a todo app",
  strategy: "parallel", // or "sequential", "debate", "consensus", "specialist"
  models: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet"], // optional
  useContext: true,
  options: {
    maxRounds: 3,        // for debate mode
    includeReasoning: true
  }
})
```

### compare
Compare responses from multiple AI models side by side.

```typescript
compare({
  prompt: "What's the best programming language for beginners?",
  models: ["openai/gpt-4o", "google/gemini-2.0-flash", "meta-llama/llama-3.3-70b"]
})
```

### new_conversation
Start a new conversation with a clean context.

```typescript
new_conversation({
  title: "Project Planning Session"
})
```

### history
Get conversation history from the current session.

```typescript
history({
  limit: 50
})
```

### search
Search through conversation history.

```typescript
search({
  query: "API design",
  limit: 20
})
```

### summary
Get a summary of context usage and statistics.

```typescript
summary()
```

## Orchestration Strategies

- **Sequential**: Each model refines the previous response
- **Parallel**: All models respond simultaneously, best answer selected
- **Debate**: Models discuss and refine through multiple rounds
- **Consensus**: Models work together to reach agreement
- **Specialist**: Routes to the best model for specific tasks

## Top Models Available

- **DeepSeek R1** - Best for reasoning and complex problems
- **GPT-4o** - Excellent all-around performance
- **Claude 3.5 Sonnet** - Great for creative and analytical tasks
- **Gemini 2.0 Flash** - Fast and capable
- **Llama 3.3 70B** - Open source powerhouse
- **Qwen 2.5 Coder** - Specialized for programming

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL and Redis are running
- Check connection settings in environment variables
- Verify firewall rules allow connections

### API Key Issues
- Ensure your OpenRouter API key is valid
- Check your account has sufficient credits
- Verify the API key is properly set in environment

## License

MIT

## Contributing

Pull requests are welcome! Please ensure:
- Tests pass
- Code follows existing style
- Documentation is updated

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Include error logs and configuration details