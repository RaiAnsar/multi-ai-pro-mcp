import OpenAI from 'openai';
import { AIProvider, CompletionOptions, ContextMessage } from '../types/index.js';

export class OpenRouterProvider implements AIProvider {
  name = 'openrouter';
  private client: OpenAI;

  constructor(apiKey: string) {
    console.error(`[DEBUG] OpenRouter Provider initialized with API key: ${apiKey.substring(0, 10)}...`);
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost',
        'X-Title': process.env.OPENROUTER_SITE_NAME || 'Multi-AI-Pro-MCP',
      }
    });
  }

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: options?.model || 'openai/gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty,
        stop: options?.stopSequences,
        stream: false,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`OpenRouter API error (${options?.model}):`, errorMessage);
      throw new Error(`OpenRouter completion failed: ${errorMessage}`);
    }
  }

  async completeWithContext(messages: ContextMessage[], options?: CompletionOptions): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: options?.model || 'openai/gpt-4o',
        messages: messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty,
        stop: options?.stopSequences,
        stream: false,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`OpenRouter API error (${options?.model}):`, errorMessage);
      throw new Error(`OpenRouter completion failed: ${errorMessage}`);
    }
  }

  async listAvailableModels(): Promise<any[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.client.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [];
    }
  }
}