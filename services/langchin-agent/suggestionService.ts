import type {
  ConversationSuggestion,
  SuggestionContext,
  SuggestionConfig,
  SuggestionService
} from '@/types/langchin-agent/suggestion';
import type { MessageResponse } from '@/types/langchin-agent/message';
import { updateTokenUsage, calculateModelCost } from '@/lib/langchin-agent/tokenUsage';
import { AIMessageChunk } from '@langchain/core/messages';

// Default configuration for suggestions
const DEFAULT_CONFIG: SuggestionConfig = {
  maxSuggestions: 4,
  minConfidence: 0.3,
  categories: ['analytics', 'data_analysis', 'visualization', 'general', 'woocommerce', 'follow_up'],
  enableAnalytics: true,
  enableWooCommerce: true,
  enableFollowUp: true,
};

// LLM-based suggestion generation
const SUGGESTION_SYSTEM_PROMPT = `You are an AI assistant that generates contextual conversation suggestions for an analytics chat application. 

Your task is to analyze the conversation context and generate 3-5 relevant, actionable suggestions that would help the user continue their analytics journey.

**Available Categories:**
- analytics: Data analysis and insights
- data_analysis: Deep dive analysis questions  
- visualization: Chart and dashboard creation
- general: General help and exploration
- woocommerce: E-commerce specific analytics
- follow_up: Natural conversation progression

**Context Analysis:**
- Thread age: Number of messages in conversation
- Last message type: human/ai/tool/error
- Has data displays: Whether conversation includes visualizations
- Has tool calls: Whether tools have been used
- Data sources: WooCommerce, databases, APIs mentioned
- User intent: exploration/analysis/reporting/troubleshooting
- Current topic: Main subject being discussed

**Suggestion Guidelines:**
1. Be specific and actionable
2. Match the conversation context and user intent
3. For new threads, suggest analytics exploration
4. For WooCommerce context, suggest store analytics
5. After tool usage, suggest follow-up analysis
6. For data visualization context, suggest deeper analysis
7. Keep suggestions concise (under 50 characters when possible)
8. Use natural, conversational language
9. Avoid repeating what's already been discussed

**Response Format:**
Return a JSON array of suggestions with this structure:
[
  {
    "text": "Suggestion text here",
    "category": "analytics|data_analysis|visualization|general|woocommerce|follow_up",
    "confidence": 0.8,
    "context": ["keyword1", "keyword2"],
    "action": "send_message|create_visualization|show_tools",
    "metadata": {
      "dataSource": "woocommerce|database|api",
      "toolRequired": "tool_name",
      "followUpType": "question|analysis|visualization"
    }
  }
]

Generate suggestions that are contextually relevant and help the user explore their data more effectively.`;

class SuggestionServiceImpl implements SuggestionService {
  private cache = new Map<string, ConversationSuggestion[]>();
  private config: SuggestionConfig;
  private threadId?: string;
  private modelName: string = 'gemini-2.0-flash-exp';
  private lastUsage: { promptTokens: number; completionTokens: number; cachedTokens: number; totalTokens: number; model: string; cost: number } | null = null;

  constructor(config: Partial<SuggestionConfig> = {}, opts?: { threadId?: string; model?: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.threadId = opts?.threadId;
    if (opts?.model) this.modelName = opts.model;
  }

  async analyzeContext(messages: MessageResponse[]): Promise<SuggestionContext> {
    const threadAge = messages.length;
    const lastMessage = messages[messages.length - 1];
    const lastMessageType = (lastMessage?.type === 'tokenUsage' ? 'ai' : lastMessage?.type) || 'human';

    // Analyze message content for topics and data sources
    const mentionedDataSources: string[] = [];
    const hasDataDisplay = messages.some(msg =>
      msg.type === 'ai' &&
      typeof msg.data === 'object' &&
      'content' in msg.data &&
      typeof msg.data.content === 'string' &&
      (msg.data.content.includes('createDataDisplay') || msg.data.content.includes('createDataCards'))
    );

    const hasToolCalls = messages.some(msg =>
      msg.type === 'tool' ||
      (msg.type === 'ai' &&
        typeof msg.data === 'object' &&
        'tool_calls' in msg.data &&
        msg.data.tool_calls)
    );

    // Extract topics from conversation
    const allText = messages
      .filter(msg => msg.type === 'human' || msg.type === 'ai')
      .map(msg => {
        if (typeof msg.data === 'object' && 'content' in msg.data) {
          return typeof msg.data.content === 'string' ? msg.data.content : '';
        }
        return '';
      })
      .join(' ');

    // Detect data sources
    if (allText.toLowerCase().includes('woocommerce') || allText.toLowerCase().includes('woo')) {
      mentionedDataSources.push('woocommerce');
    }
    if (allText.toLowerCase().includes('database') || allText.toLowerCase().includes('sql')) {
      mentionedDataSources.push('database');
    }

    // Determine user intent
    let userIntent: SuggestionContext['userIntent'] = 'exploration';
    if (allText.toLowerCase().includes('analyze') || allText.toLowerCase().includes('analysis')) {
      userIntent = 'analysis';
    } else if (allText.toLowerCase().includes('report') || allText.toLowerCase().includes('dashboard')) {
      userIntent = 'reporting';
    } else if (allText.toLowerCase().includes('error') || allText.toLowerCase().includes('problem')) {
      userIntent = 'troubleshooting';
    }

    // Extract current topic (simplified - could be enhanced with NLP)
    const currentTopic = this.extractTopic(allText);

    return {
      conversationHistory: messages,
      currentTopic,
      threadAge,
      lastMessageType,
      hasDataDisplay,
      hasToolCalls,
      mentionedDataSources,
      userIntent
    };
  }

  async generateSuggestions(context: SuggestionContext, opts?: {
    threadId?: string;
    model?: string;
    aiConfig?: { model: string; provider: string; apiKey: string };
    wooCommerceConfig?: { url: string; consumerKey: string; consumerSecret: string };
    userId?: number;
  }): Promise<ConversationSuggestion[]> {
    try {
      // Use the existing agent infrastructure
      const { createChatModel } = await import('@/lib/langchin-agent/agent/util');
      const threadId = opts?.threadId || this.threadId;

      // Use provided AI config or fallback to defaults
      const aiConfig = opts?.aiConfig;
      const model = aiConfig?.model || opts?.model || this.modelName;
      const provider = aiConfig?.provider || 'google';
      const apiKey = aiConfig?.apiKey;

      if (!apiKey) {
        throw new Error('API key is required for suggestions generation');
      }

      // Create LLM instance using the provided AI configuration
      const llm = createChatModel({
        provider,
        model,
        apiKey,
        temperature: 0.9,
      });

      // Create suggestion-specific prompt
      const suggestionPrompt = `Based on the conversation context, generate 3-5 relevant follow-up questions that the USER would ask to continue their analytics journey.

**Context:**
- Thread Age: ${context.threadAge} messages
- Last Message Type: ${context.lastMessageType}
- Has Data Displays: ${context.hasDataDisplay ? 'Yes' : 'No'}
- Has Tool Calls: ${context.hasToolCalls ? 'Yes' : 'No'}
- Data Sources: ${context.mentionedDataSources.join(', ') || 'None'}
- User Intent: ${context.userIntent || 'Unknown'}
- Current Topic: ${context.currentTopic || 'None'}

**Conversation Summary:**
${this.summarizeConversation(context.conversationHistory)}

**IMPORTANT:** Generate suggestions as USER QUESTIONS, not AI responses. Each suggestion should be phrased as if the user is asking the AI a question.

Examples of GOOD suggestions (user questions):
- "Show me sales data for last month"
- "What are my top-selling products?"
- "Create a chart showing revenue trends"
- "Compare this month's performance to last month"

Examples of BAD suggestions (AI responses):
- "Would you like me to show you sales data?"
- "I can help you analyze your top products"
- "Let me create a chart for you"

Generate suggestions that are contextually relevant, actionable, and phrased as user questions.

Return as JSON array with format:
[{"text": "user question here", "category": "analytics|data_analysis|visualization|general|woocommerce|follow_up", "confidence": 0.8, "action": "send_message|create_visualization|show_tools"}]`;

      // Generate suggestions using the agent's LLM
      const response = await llm.invoke([
        { role: 'system', content: 'You are an AI assistant that generates follow-up questions that users would ask. Always phrase suggestions as user questions, never as AI responses or offers to help.' },
        { role: 'user', content: suggestionPrompt }
      ]);

      // Parse the response
      const suggestions = this.parseLLMResponse(response.content as string);


      // Attempt to log token usage for suggestions generation if we have threadId
      try {
        if (threadId) {
          const usage = this.extractUsageFromResponse(response);
          if (usage) {
            const cost = calculateModelCost(model, usage.prompt_tokens, usage.completion_tokens, provider);
            const total = usage.prompt_tokens + usage.completion_tokens;
            const costPer1K = total > 0 ? cost / (total / 1000) : 0;
            this.lastUsage = {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              cachedTokens: usage.cached_tokens,
              totalTokens: usage.prompt_tokens + usage.completion_tokens,
              model,
              cost: cost
            };
            await updateTokenUsage(threadId, {
              prompt_tokens: usage.prompt_tokens,
              completion_tokens: usage.completion_tokens,
              cached_tokens: usage.cached_tokens,
              model_name: model,
              cost_per_1k_tokens: costPer1K,
              source: 'suggestions',
            }, opts?.userId);
          }
        }
      } catch (e) {
        console.error('Failed to log suggestions token usage:', e);
      }

      // Add unique IDs and validate
      const validatedSuggestions = suggestions
        .map((suggestion, index) => ({
          ...suggestion,
          id: `agent-${Date.now()}-${index}`,
          confidence: Math.max(suggestion.confidence || 0.5, this.config.minConfidence)
        }))
        .filter(s => s.confidence >= this.config.minConfidence)
        .slice(0, this.config.maxSuggestions);

      return validatedSuggestions;
    } catch (error) {
      console.error('Error generating agent suggestions:', error);
      return this.getFallbackSuggestions();
    }
  }

  getCachedSuggestions(threadId: string): ConversationSuggestion[] | null {
    // Disable caching to ensure fresh suggestions
    return null;
  }

  cacheSuggestions(threadId: string, suggestions: ConversationSuggestion[]): void {
    // Disable caching to ensure fresh suggestions
    return;
  }


  private extractTopic(text: string): string | undefined {
    const topics = [
      'sales', 'revenue', 'customers', 'products', 'orders',
      'analytics', 'dashboard', 'reports', 'trends', 'performance'
    ];

    const lowerText = text.toLowerCase();
    return topics.find(topic => lowerText.includes(topic));
  }

  private summarizeConversation(messages: MessageResponse[]): string {
    if (messages.length === 0) {
      return "New conversation - no messages yet";
    }

    const recentMessages = messages.slice(-6); // Last 6 messages for context
    const summary = recentMessages
      .map(msg => {
        if (msg.type === 'human') {
          return `User: ${this.getContent(msg)}`;
        } else if (msg.type === 'ai') {
          return `AI: ${this.getContent(msg).substring(0, 100)}...`;
        } else if (msg.type === 'tool') {
          return `Tool: ${this.getContent(msg)}`;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');

    return summary || "Conversation in progress";
  }

  private getContent(message: MessageResponse): string {
    if (typeof message.data === 'object' && 'content' in message.data) {
      return typeof message.data.content === 'string' ? message.data.content : '';
    }
    return '';
  }

  // Best-effort extraction depending on provider metadata shapes
  private extractUsageFromResponse(response: Record<string, unknown> | AIMessageChunk): { prompt_tokens: number; completion_tokens: number; cached_tokens: number } | null {
    try {
      const r = response as Record<string, unknown>;
      if (r?.usage_metadata) {
        const um = r.usage_metadata as Record<string, number>;
        return {
          prompt_tokens: um.prompt_tokens || um.input_tokens || 0,
          completion_tokens: um.completion_tokens || um.output_tokens || 0,
          cached_tokens: um.cached_tokens || 0,
        };
      }
      if (
        typeof r.response_metadata === 'object' &&
        r.response_metadata !== null &&
        'token_usage' in r.response_metadata
      ) {
        const tokenUsage = (r.response_metadata as Record<string, unknown>).token_usage;
        const tu = (typeof tokenUsage === 'object' && tokenUsage !== null) ? (tokenUsage as Record<string, number>) : {};
        return {
          prompt_tokens: tu.prompt_tokens || tu.input_tokens || 0,
          completion_tokens: tu.completion_tokens || tu.output_tokens || 0,
          cached_tokens: tu.cached_tokens || 0,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  getLastUsage() {
    return this.lastUsage;
  }

  private parseLLMResponse(content: string): ConversationSuggestion[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        return Array.isArray(parsed) ? parsed : [];
      }

      // If no JSON found, try to parse the entire content
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error parsing LLM response:', error);

      // Return fallback suggestions if parsing fails
      return [
        {
          id: 'fallback-parse-1',
          text: "Show me analytics insights",
          category: 'analytics',
          confidence: 0.5,
          context: ['fallback'],
          action: 'send_message'
        },
        {
          id: 'fallback-parse-2',
          text: "Create a data visualization",
          category: 'visualization',
          confidence: 0.5,
          context: ['fallback'],
          action: 'create_visualization'
        }
      ];
    }
  }


  private getFallbackSuggestions(): ConversationSuggestion[] {
    // Fallback suggestions when LLM fails
    const fallbackSuggestions: ConversationSuggestion[] = [
      {
        id: 'fallback-1',
        text: "Show me analytics insights",
        category: 'analytics',
        confidence: 0.5,
        context: ['fallback'],
        action: 'send_message'
      },
      {
        id: 'fallback-2',
        text: "Create a data visualization",
        category: 'visualization',
        confidence: 0.5,
        context: ['fallback'],
        action: 'create_visualization'
      },
      {
        id: 'fallback-3',
        text: "Help me analyze this data",
        category: 'data_analysis',
        confidence: 0.5,
        context: ['fallback'],
        action: 'send_message'
      }
    ];

    return fallbackSuggestions.slice(0, this.config.maxSuggestions);
  }
}

// Export singleton instance
export const suggestionService = new SuggestionServiceImpl();

// Export factory function for custom configurations
export const createSuggestionService = (config: Partial<SuggestionConfig> = {}) =>
  new SuggestionServiceImpl(config);
