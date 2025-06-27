import { 
  AIProvider, 
  OrchestrationRequest, 
  OrchestrationResult, 
  OrchestrationStrategy,
  ProviderResponse,
  DebateRound,
  PROGRAMMING_MODELS,
  ContextMessage
} from "../types/index.js";
import { ContextManager } from "../db/context-manager.js";

export class OrchestrationEngine {
  private provider: AIProvider;
  private contextManager: ContextManager;
  private defaultModels: string[];

  constructor(provider: AIProvider, contextManager: ContextManager) {
    this.provider = provider;
    this.contextManager = contextManager;
    // Default to best programming models
    this.defaultModels = PROGRAMMING_MODELS.map(m => m.id);
  }

  async orchestrate(request: OrchestrationRequest): Promise<OrchestrationResult> {
    const models = request.models || this.defaultModels.slice(0, 3); // Use top 3 by default
    
    // Add user message to context
    if (request.useContext !== false) {
      await this.contextManager.addMessage({
        role: 'user',
        content: request.prompt,
      });
    }

    let result: OrchestrationResult;

    switch (request.strategy) {
      case OrchestrationStrategy.Sequential:
        result = await this.sequentialProcessing(request, models);
        break;
      case OrchestrationStrategy.Parallel:
        result = await this.parallelProcessing(request, models);
        break;
      case OrchestrationStrategy.Debate:
        result = await this.debateMode(request, models);
        break;
      case OrchestrationStrategy.Consensus:
        result = await this.consensusMode(request, models);
        break;
      case OrchestrationStrategy.Specialist:
        result = await this.specialistRouting(request, models);
        break;
      default:
        throw new Error(`Unknown orchestration strategy: ${request.strategy}`);
    }

    // Get conversation ID for reference
    const summary = await this.contextManager.getSummary();
    result.conversationId = summary.currentConversationId;

    return result;
  }

  private async sequentialProcessing(request: OrchestrationRequest, models: string[]): Promise<OrchestrationResult> {
    const responses: ProviderResponse[] = [];
    let currentPrompt = request.prompt;
    
    // Get conversation history if using context
    const history = request.useContext !== false ? 
      await this.contextManager.getConversationHistory() : [];

    for (const model of models) {
      const messages: ContextMessage[] = [];
      
      // Add conversation history
      if (history.length > 0) {
        history.forEach(msg => {
          messages.push({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content
          });
        });
      }

      // Add current prompt
      messages.push({ role: 'user', content: currentPrompt });

      const response = await this.provider.completeWithContext(messages, {
        ...request.options,
        model
      });
      
      responses.push({
        model,
        response,
        timestamp: new Date(),
      });

      // Save assistant response to context
      if (request.useContext !== false) {
        await this.contextManager.addMessage({
          role: 'assistant',
          content: response,
          model,
        });
      }

      // Update prompt for next model
      currentPrompt = `Original prompt: ${request.prompt}\n\nPrevious ${model} response:\n${response}\n\nPlease improve, refine, or add to this response.`;
    }

    return {
      strategy: OrchestrationStrategy.Sequential,
      models,
      responses,
    };
  }

  private async parallelProcessing(request: OrchestrationRequest, models: string[]): Promise<OrchestrationResult> {
    // Get conversation history
    const history = request.useContext !== false ? 
      await this.contextManager.getConversationHistory() : [];

    const promises = models.map(async (model) => {
      try {
        const messages: ContextMessage[] = [];
        
        // Add history
        history.forEach(msg => {
          messages.push({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content
          });
        });

        // Add current prompt
        messages.push({ role: 'user', content: request.prompt });

        const response = await this.provider.completeWithContext(messages, {
          ...request.options,
          model
        });
        
        return {
          model,
          response,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error(`Error with ${model}:`, error);
        return null;
      }
    });

    const responses = (await Promise.all(promises)).filter(Boolean) as ProviderResponse[];

    // Synthesize responses
    const synthesis = await this.synthesizeResponses(responses, request.prompt);

    // Save synthesis to context
    if (request.useContext !== false && synthesis) {
      await this.contextManager.addMessage({
        role: 'assistant',
        content: synthesis,
        model: 'synthesis',
        metadata: { models: models.join(', ') }
      });
    }

    return {
      strategy: OrchestrationStrategy.Parallel,
      models,
      responses,
      synthesis,
    };
  }

  private async debateMode(request: OrchestrationRequest, models: string[]): Promise<OrchestrationResult> {
    const maxRounds = request.options?.maxRounds || 3;
    const rounds: DebateRound[] = [];
    let debateContext = request.prompt;

    for (let round = 0; round < maxRounds; round++) {
      const roundResponses: ProviderResponse[] = [];

      for (const model of models) {
        const prompt = round === 0 
          ? debateContext
          : `${debateContext}\n\nPrevious responses in the debate:\n${this.formatDebateHistory(rounds)}\n\nProvide your perspective, counter-arguments, or refinements:`;

        const response = await this.provider.complete(prompt, {
          ...request.options,
          model
        });
        
        roundResponses.push({
          model,
          response,
          timestamp: new Date(),
        });
      }

      rounds.push({
        round: round + 1,
        responses: roundResponses,
      });
    }

    // Generate conclusion
    const conclusion = await this.generateDebateConclusion(rounds, request.prompt);

    // Save conclusion to context
    if (request.useContext !== false) {
      await this.contextManager.addMessage({
        role: 'assistant',
        content: conclusion,
        model: 'debate-conclusion',
        metadata: { 
          models: models.join(', '),
          rounds: maxRounds
        }
      });
    }

    return {
      strategy: OrchestrationStrategy.Debate,
      models,
      rounds,
      conclusion,
    };
  }

  private async consensusMode(request: OrchestrationRequest, models: string[]): Promise<OrchestrationResult> {
    const parallelResult = await this.parallelProcessing(request, models);
    const responses = parallelResult.responses || [];

    const consensus = await this.findConsensus(responses, request.prompt);

    // Save consensus to context
    if (request.useContext !== false) {
      await this.contextManager.addMessage({
        role: 'assistant',
        content: consensus,
        model: 'consensus',
        metadata: { models: models.join(', ') }
      });
    }

    return {
      strategy: OrchestrationStrategy.Consensus,
      models,
      responses,
      consensus,
    };
  }

  private async specialistRouting(request: OrchestrationRequest, models: string[]): Promise<OrchestrationResult> {
    // Analyze the prompt to determine the best specialist model
    const analysis = await this.analyzePromptType(request.prompt);
    
    // Select specialist models based on the task
    const specialists = this.selectSpecialists(analysis, models);
    
    // Route to appropriate specialists
    const responses: ProviderResponse[] = [];
    
    for (const specialist of specialists) {
      const response = await this.provider.complete(request.prompt, {
        ...request.options,
        model: specialist.model
      });
      
      responses.push({
        model: specialist.model,
        response,
        timestamp: new Date(),
      });
      
      if (request.useContext !== false) {
        await this.contextManager.addMessage({
          role: 'assistant',
          content: response,
          model: specialist.model,
          metadata: { reason: specialist.reason }
        });
      }
    }
    
    return {
      strategy: OrchestrationStrategy.Specialist,
      models: specialists.map(s => s.model),
      responses,
    };
  }

  private async analyzePromptType(prompt: string): Promise<any> {
    const analysisPrompt = `Analyze this prompt and categorize it:
    "${prompt}"
    
    Categories: coding, debugging, architecture, planning, analysis, creative
    
    Respond with: { "primary": "category", "secondary": "category", "complexity": "low|medium|high" }`;
    
    const response = await this.provider.complete(analysisPrompt, {
      model: 'openai/gpt-4o-mini',
      temperature: 0.3
    });
    
    try {
      return JSON.parse(response);
    } catch {
      return { primary: 'coding', secondary: 'general', complexity: 'medium' };
    }
  }

  private selectSpecialists(analysis: any, availableModels: string[]): any[] {
    const specialists = [];
    
    // Map task types to best models
    const specialistMap = {
      coding: ['anthropic/claude-opus-4', 'deepseek/deepseek-r1', 'mistralai/codestral-2501'],
      debugging: ['deepseek/deepseek-r1', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o'],
      architecture: ['anthropic/claude-opus-4', 'openai/gpt-4o', 'google/gemini-2.5-pro-preview'],
      planning: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.5-pro-preview'],
      analysis: ['google/gemini-2.5-pro-preview', 'anthropic/claude-3.5-sonnet', 'deepseek/deepseek-r1'],
      creative: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-2.5-pro-preview']
    };
    
    const primarySpecialists = specialistMap[analysis.primary as keyof typeof specialistMap] || ['openai/gpt-4o'];
    const secondarySpecialists = specialistMap[analysis.secondary as keyof typeof specialistMap] || [];
    
    // Select top models based on complexity
    const numModels = analysis.complexity === 'high' ? 3 : analysis.complexity === 'medium' ? 2 : 1;
    
    // Add primary specialists
    for (const model of primarySpecialists) {
      if (availableModels.includes(model) && specialists.length < numModels) {
        specialists.push({
          model,
          reason: `Selected for ${analysis.primary} tasks`
        });
      }
    }
    
    // Add secondary specialists if needed
    for (const model of secondarySpecialists) {
      if (availableModels.includes(model) && !specialists.find(s => s.model === model) && specialists.length < numModels) {
        specialists.push({
          model,
          reason: `Secondary specialist for ${analysis.secondary}`
        });
      }
    }
    
    // Fallback to first available model
    if (specialists.length === 0 && availableModels.length > 0) {
      specialists.push({
        model: availableModels[0],
        reason: 'Default model'
      });
    }
    
    return specialists;
  }

  private async synthesizeResponses(responses: ProviderResponse[], originalPrompt: string): Promise<string> {
    const synthesisPrompt = `Original question: ${originalPrompt}

I have received the following responses from different AI models:

${responses.map(r => `${r.model}:\n${r.response}`).join("\n\n---\n\n")}

Please synthesize these responses into a comprehensive, balanced answer that:
1. Incorporates the best insights from each model
2. Resolves any contradictions
3. Provides a clear, actionable response
4. Highlights any important considerations or caveats`;

    return this.provider.complete(synthesisPrompt, { 
      temperature: 0.3,
      model: 'anthropic/claude-3.5-sonnet' // Use Claude for synthesis
    });
  }

  private formatDebateHistory(rounds: DebateRound[]): string {
    return rounds.map(round => 
      `Round ${round.round}:\n${
        round.responses.map(r => `${r.model}: ${r.response}`).join("\n\n")
      }`
    ).join("\n\n---\n\n");
  }

  private async generateDebateConclusion(rounds: DebateRound[], originalPrompt: string): Promise<string> {
    const conclusionPrompt = `Original topic: ${originalPrompt}

Debate history:
${this.formatDebateHistory(rounds)}

Based on this debate, provide a balanced conclusion that:
1. Summarizes the key points raised by each model
2. Identifies areas of agreement and disagreement
3. Provides a well-reasoned final perspective
4. Suggests the most practical approach or solution`;

    return this.provider.complete(conclusionPrompt, { 
      temperature: 0.3,
      model: 'openai/gpt-4o' // Use GPT-4o for conclusion
    });
  }

  private async findConsensus(responses: ProviderResponse[], originalPrompt: string): Promise<string> {
    const consensusPrompt = `Original question: ${originalPrompt}

Different AI models provided these responses:

${responses.map(r => `${r.model}:\n${r.response}`).join("\n\n---\n\n")}

Analyze these responses and provide:
1. Common themes and points of agreement
2. Key differences in approach or content
3. A consensus view that represents the shared understanding
4. Any important caveats or considerations`;

    return this.provider.complete(consensusPrompt, { 
      temperature: 0.3,
      model: 'google/gemini-2.5-pro-preview' // Use Gemini for consensus
    });
  }
}