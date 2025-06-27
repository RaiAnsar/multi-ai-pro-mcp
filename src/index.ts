#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import dotenv from "dotenv";

// Import our modules
import { OpenRouterProvider } from "./providers/openrouter.js";
import { OrchestrationEngine } from "./orchestrator/engine.js";
import { ContextManager } from "./db/context-manager.js";
import { OrchestrationStrategy, PROGRAMMING_MODELS } from "./types/index.js";

// Load environment variables
dotenv.config();

// Create server instance
const server = new Server(
  {
    name: "mcp-multi-ai-pro",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize components
let provider: OpenRouterProvider;
let contextManager: ContextManager;
let orchestrator: OrchestrationEngine;

// Initialize on first use
async function ensureInitialized() {
  if (!provider) {
    const apiKey = process.env.OPENROUTER_API_KEY || "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";
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable is required");
    }
    
    provider = new OpenRouterProvider(apiKey);
    contextManager = new ContextManager();
    await contextManager.initialize();
    orchestrator = new OrchestrationEngine(provider, contextManager);
  }
}

// Define tool schemas
const AskSchema = z.object({
  prompt: z.string().describe("The question or prompt to send to AI model"),
  model: z.string().optional().describe("Specific model to use (e.g., 'deepseek/deepseek-r1', 'anthropic/claude-opus-4')"),
  temperature: z.number().min(0).max(2).optional().default(0.7).describe("Temperature for response generation"),
  useContext: z.boolean().optional().default(true).describe("Whether to use conversation context"),
});

const OrchestrateSchema = z.object({
  prompt: z.string().describe("The prompt to orchestrate across multiple AI models"),
  strategy: z.enum(["sequential", "parallel", "debate", "consensus", "specialist"]).describe("Orchestration strategy to use"),
  models: z.array(z.string()).optional().describe("Specific models to use in orchestration"),
  useContext: z.boolean().optional().default(true).describe("Whether to use conversation context"),
  options: z.object({
    maxRounds: z.number().optional().default(3).describe("Maximum rounds for debate mode"),
    temperature: z.number().optional().default(0.7),
    includeReasoning: z.boolean().optional().default(false),
  }).optional(),
});

const CompareSchema = z.object({
  prompt: z.string().describe("The prompt to compare responses across models"),
  models: z.array(z.string()).optional().describe("Models to compare (defaults to top programming models)"),
  useContext: z.boolean().optional().default(true).describe("Whether to use conversation context"),
});

const NewConversationSchema = z.object({
  title: z.string().optional().describe("Title for the new conversation"),
});

const HistorySchema = z.object({
  limit: z.number().optional().default(50).describe("Maximum number of messages to retrieve"),
});

const SearchSchema = z.object({
  query: z.string().describe("Search term to find in conversation history"),
  limit: z.number().optional().default(20).describe("Maximum number of results"),
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const modelList = PROGRAMMING_MODELS.map(m => `${m.id} (${m.name})`).join(", ");
  
  const tools: Tool[] = [
    {
      name: "ask",
      description: "Ask a question to a specific AI model with persistent context",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "The question or prompt to send to AI model",
          },
          model: {
            type: "string",
            description: `Specific model to use. Top models: ${modelList}`,
          },
          temperature: {
            type: "number",
            description: "Temperature for response generation (0-2)",
            minimum: 0,
            maximum: 2,
            default: 0.7,
          },
          useContext: {
            type: "boolean",
            description: "Whether to use conversation context",
            default: true,
          },
        },
        required: ["prompt"],
      },
    },
    {
      name: "orchestrate",
      description: "Orchestrate a task across multiple AI models using various strategies with context retention",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "The prompt to orchestrate across multiple AI models",
          },
          strategy: {
            type: "string",
            enum: ["sequential", "parallel", "debate", "consensus", "specialist"],
            description: "Strategy: sequential (refine), parallel (synthesize), debate (discuss), consensus (agree), specialist (route to best model)",
          },
          models: {
            type: "array",
            items: { type: "string" },
            description: "Specific models to use (defaults to best programming models)",
          },
          useContext: {
            type: "boolean",
            description: "Whether to use conversation context",
            default: true,
          },
          options: {
            type: "object",
            properties: {
              maxRounds: {
                type: "number",
                description: "Maximum rounds for debate mode",
                default: 3,
              },
              temperature: {
                type: "number",
                description: "Temperature setting",
                default: 0.7,
              },
              includeReasoning: {
                type: "boolean",
                description: "Include reasoning in responses",
                default: false,
              },
            },
          },
        },
        required: ["prompt", "strategy"],
      },
    },
    {
      name: "compare",
      description: "Compare responses from multiple AI models side by side",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "The prompt to compare responses across models",
          },
          models: {
            type: "array",
            items: { type: "string" },
            description: "Models to compare (defaults to top programming models)",
          },
          useContext: {
            type: "boolean",
            description: "Whether to use conversation context",
            default: true,
          },
        },
        required: ["prompt"],
      },
    },
    {
      name: "new_conversation",
      description: "Start a new conversation with a clean context",
      inputSchema: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Optional title for the conversation",
          },
        },
      },
    },
    {
      name: "history",
      description: "Get conversation history from the current session",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of messages to retrieve",
            default: 50,
          },
        },
      },
    },
    {
      name: "search",
      description: "Search through conversation history",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search term",
          },
          limit: {
            type: "number",
            description: "Maximum results",
            default: 20,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "summary",
      description: "Get a summary of context usage and statistics",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ];

  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    await ensureInitialized();

    switch (name) {
      case "ask": {
        const { prompt, model, temperature, useContext } = AskSchema.parse(args);
        
        // Add to context if enabled
        if (useContext) {
          await contextManager.addMessage({
            role: 'user',
            content: prompt,
          });
        }
        
        // Get conversation history
        const messages = useContext ? 
          (await contextManager.getConversationHistory()).map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content
          })) : [];
        
        // Add current prompt
        messages.push({ role: 'user' as const, content: prompt });
        
        // Get response
        const response = await provider.completeWithContext(messages, {
          model: model || 'deepseek/deepseek-r1', // Default to DeepSeek R1
          temperature,
        });
        
        // Save to context if enabled
        if (useContext) {
          await contextManager.addMessage({
            role: 'assistant',
            content: response,
            model: model || 'deepseek/deepseek-r1',
          });
        }
        
        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      }

      case "orchestrate": {
        const { prompt, strategy, models, useContext, options } = OrchestrateSchema.parse(args);
        
        const result = await orchestrator.orchestrate({
          prompt,
          strategy: strategy as OrchestrationStrategy,
          models,
          options,
          useContext,
        });
        
        return {
          content: [
            {
              type: "text",
              text: formatOrchestrationResult(result),
            },
          ],
        };
      }

      case "compare": {
        const { prompt, models, useContext } = CompareSchema.parse(args);
        const targetModels = models || PROGRAMMING_MODELS.slice(0, 3).map(m => m.id);
        
        // Use parallel orchestration for comparison
        const result = await orchestrator.orchestrate({
          prompt,
          strategy: OrchestrationStrategy.Parallel,
          models: targetModels,
          useContext,
        });
        
        const comparison = result.responses
          ?.map((r) => `**${r.model}:**\n${r.response}\n`)
          .join("\n---\n\n") || '';
        
        return {
          content: [
            {
              type: "text",
              text: `# Model Comparison\n\n**Prompt:** ${prompt}\n\n${comparison}\n\n## Synthesis\n${result.synthesis || 'No synthesis available'}`,
            },
          ],
        };
      }

      case "new_conversation": {
        const { title } = NewConversationSchema.parse(args);
        const conversationId = await contextManager.startNewConversation(title);
        
        return {
          content: [
            {
              type: "text",
              text: `Started new conversation: ${title || 'Untitled'}\nID: ${conversationId}`,
            },
          ],
        };
      }

      case "history": {
        const { limit } = HistorySchema.parse(args);
        const messages = await contextManager.getConversationHistory(undefined, limit);
        
        const formatted = messages.map(msg => 
          `[${msg.timestamp}] ${msg.role.toUpperCase()}${msg.model ? ` (${msg.model})` : ''}:\n${msg.content}`
        ).join("\n\n---\n\n");
        
        return {
          content: [
            {
              type: "text",
              text: formatted || "No conversation history yet.",
            },
          ],
        };
      }

      case "search": {
        const { query, limit } = SearchSchema.parse(args);
        const results = await contextManager.searchMessages(query, limit);
        
        const formatted = results.map(msg => 
          `[${msg.timestamp}] ${msg.role.toUpperCase()}${msg.model ? ` (${msg.model})` : ''}:\n${msg.content.substring(0, 200)}...`
        ).join("\n\n---\n\n");
        
        return {
          content: [
            {
              type: "text",
              text: formatted || `No results found for "${query}"`,
            },
          ],
        };
      }

      case "summary": {
        const summary = await contextManager.getSummary();
        
        return {
          content: [
            {
              type: "text",
              text: `# Context Summary\n\n` +
                `**Total Conversations:** ${summary.totalConversations}\n` +
                `**Total Messages:** ${summary.totalMessages}\n` +
                `**Current Conversation ID:** ${summary.currentConversationId}\n\n` +
                `**Model Usage:**\n${summary.modelUsage.map((m: any) => `- ${m.model}: ${m.count} messages`).join('\n')}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
    };
  }
});

// Format orchestration results
function formatOrchestrationResult(result: any): string {
  let output = `# Orchestration Result\n\n`;
  output += `**Strategy:** ${result.strategy}\n`;
  output += `**Models Used:** ${result.models.join(", ")}\n`;
  if (result.conversationId) {
    output += `**Conversation ID:** ${result.conversationId}\n`;
  }
  output += `\n`;
  
  if (result.strategy === "sequential") {
    output += `## Sequential Refinement\n\n`;
    result.responses.forEach((r: any, i: number) => {
      output += `### Step ${i + 1}: ${r.model}\n${r.response}\n\n`;
    });
  } else if (result.strategy === "parallel") {
    output += `## Parallel Responses\n\n`;
    result.responses.forEach((r: any) => {
      output += `### ${r.model}\n${r.response}\n\n`;
    });
    if (result.synthesis) {
      output += `\n## Synthesis\n${result.synthesis}\n`;
    }
  } else if (result.strategy === "debate") {
    output += `## Debate Rounds\n\n`;
    result.rounds.forEach((round: any, i: number) => {
      output += `### Round ${i + 1}\n`;
      round.responses.forEach((r: any) => {
        output += `**${r.model}:** ${r.response}\n\n`;
      });
    });
    if (result.conclusion) {
      output += `\n## Conclusion\n${result.conclusion}\n`;
    }
  } else if (result.strategy === "consensus") {
    output += `## Individual Perspectives\n\n`;
    result.responses.forEach((r: any) => {
      output += `### ${r.model}\n${r.response}\n\n`;
    });
    if (result.consensus) {
      output += `\n## Consensus\n${result.consensus}\n`;
    }
  } else if (result.strategy === "specialist") {
    output += `## Specialist Responses\n\n`;
    result.responses.forEach((r: any) => {
      output += `### ${r.model}\n${r.response}\n\n`;
    });
  }
  
  return output;
}

// Start the server
async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("Error: OPENROUTER_API_KEY environment variable is required");
    console.error("Please set it in your .env file or environment");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error(`Multi-AI Pro MCP Server running`);
  console.error(`Context persistence enabled with PostgreSQL/Redis`);
  console.error(`Access to best programming models via OpenRouter`);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});