export interface AIProvider {
  name: string;
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  completeWithContext(messages: ContextMessage[], options?: CompletionOptions): Promise<string>;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  stream?: boolean;
}

export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export enum OrchestrationStrategy {
  Sequential = "sequential",
  Parallel = "parallel",
  Debate = "debate",
  Consensus = "consensus",
  Specialist = "specialist"
}

export interface OrchestrationRequest {
  prompt: string;
  strategy: OrchestrationStrategy;
  models?: string[];
  options?: OrchestrationOptions;
  useContext?: boolean;
}

export interface OrchestrationOptions {
  maxRounds?: number;
  temperature?: number;
  includeReasoning?: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  contextLength: number;
  pricing: {
    input: number;
    output: number;
  };
  capabilities?: string[];
}

// Best models for programming tasks - Updated with correct OpenRouter model IDs
export const PROGRAMMING_MODELS: ModelConfig[] = [
  {
    id: 'deepseek/deepseek-v3',
    name: 'DeepSeek V3',
    contextLength: 163840,
    pricing: { input: 0.00000055, output: 0.0000022 },
    capabilities: ['reasoning', 'coding', 'debugging']
  },
  {
    id: 'deepseek/deepseek-r1-0528',
    name: 'DeepSeek R1 0528',
    contextLength: 128000,
    pricing: { input: 0.00000055, output: 0.0000022 },
    capabilities: ['reasoning', 'coding', 'debugging', 'open-reasoning']
  },
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    contextLength: 200000,
    pricing: { input: 0.000003, output: 0.000015 },
    capabilities: ['coding', 'swe-bench-leader', 'agent-workflows']
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    contextLength: 1048576,
    pricing: { input: 0.00000125, output: 0.00001 },
    capabilities: ['coding', 'reasoning', 'long-context']
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    contextLength: 1048576,
    pricing: { input: 0.000000075, output: 0.0000003 },
    capabilities: ['coding', 'reasoning', 'fast', 'thinking']
  },
  {
    id: 'x-ai/grok-3-beta',
    name: 'xAI Grok 3 Beta',
    contextLength: 131072,
    pricing: { input: 0.000005, output: 0.000015 },
    capabilities: ['coding', 'data-extraction', 'text-summarization']
  },
  {
    id: 'openai/gpt-4.1',
    name: 'GPT-4.1',
    contextLength: 1047576,
    pricing: { input: 0.000002, output: 0.000008 },
    capabilities: ['coding', 'swe-bench', 'agent-reliability']
  },
  {
    id: 'meta-llama/llama-4-maverick',
    name: 'Llama 4 Maverick',
    contextLength: 1048576,
    pricing: { input: 0.0000018, output: 0.0000018 },
    capabilities: ['multimodal', 'coding', 'mixture-of-experts']
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct',
    name: 'Qwen 2.5 Coder 32B',
    contextLength: 32768,
    pricing: { input: 0.00000018, output: 0.00000018 },
    capabilities: ['coding', 'instruction-following', 'multilingual']
  },
  {
    id: 'mistralai/codestral-2501',
    name: 'Codestral 2501',
    contextLength: 262144,
    pricing: { input: 0.0000003, output: 0.0000009 },
    capabilities: ['coding', 'low-latency', 'completion']
  }
];

// Marketing/SEO focused models
export const MARKETING_MODELS: ModelConfig[] = [
  {
    id: 'google/gemini-2.5-flash-preview-05-20',
    name: 'Gemini 2.5 Flash Preview',
    contextLength: 1048576,
    pricing: { input: 0.000000075, output: 0.0000003 },
    capabilities: ['content', 'reasoning', 'thinking', 'fast']
  },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    contextLength: 1048576,
    pricing: { input: 0.000000075, output: 0.0000003 },
    capabilities: ['content', 'multimodal', 'fast']
  },
  {
    id: 'qwen/qwen-2.5-7b-instruct',
    name: 'Qwen 2.5 7B',
    contextLength: 32768,
    pricing: { input: 0.00000012, output: 0.00000012 },
    capabilities: ['content', 'multilingual', 'efficient']
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    contextLength: 131072,
    pricing: { input: 0.00000035, output: 0.00000035 },
    capabilities: ['content', 'instruction-following', 'multilingual']
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    contextLength: 128000,
    pricing: { input: 0.00000015, output: 0.0000006 },
    capabilities: ['content', 'cost-effective', 'multimodal']
  },
  {
    id: 'anthropic/claude-3.7-sonnet',
    name: 'Claude 3.7 Sonnet',
    contextLength: 200000,
    pricing: { input: 0.000003, output: 0.000015 },
    capabilities: ['content', 'reasoning', 'agent-workflows']
  },
  {
    id: 'mistralai/mistral-nemo',
    name: 'Mistral Nemo',
    contextLength: 131072,
    pricing: { input: 0.00000013, output: 0.00000013 },
    capabilities: ['content', 'multilingual', 'function-calling']
  }
];

export interface ProviderResponse {
  model: string;
  response: string;
  timestamp: Date;
  tokensUsed?: {
    input: number;
    output: number;
  };
}

export interface OrchestrationResult {
  strategy: OrchestrationStrategy;
  models: string[];
  responses?: ProviderResponse[];
  rounds?: DebateRound[];
  synthesis?: string;
  consensus?: string;
  conclusion?: string;
  conversationId?: string;
}

export interface DebateRound {
  round: number;
  responses: ProviderResponse[];
}