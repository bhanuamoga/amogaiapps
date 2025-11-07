export interface ConversationSuggestion {
  id: string;
  text: string;
  category: 'analytics' | 'data_analysis' | 'visualization' | 'general' | 'woocommerce' | 'follow_up';
  confidence: number; // 0-1 score for relevance
  context: string[]; // Keywords or topics that triggered this suggestion
  action?: 'send_message' | 'show_tools' | 'create_visualization';
  metadata?: {
    dataSource?: string;
    toolRequired?: string;
    followUpType?: 'question' | 'analysis' | 'visualization';
  };
}

export interface SuggestionContext {
  conversationHistory: import('./message').MessageResponse[];
  currentTopic?: string;
  threadAge: number; // Number of messages in thread
  lastMessageType: 'human' | 'ai' | 'tool' | 'error';
  hasDataDisplay: boolean; // Whether conversation contains data visualizations
  hasToolCalls: boolean; // Whether conversation includes tool usage
  mentionedDataSources: string[]; // WooCommerce, databases, etc.
  userIntent?: 'exploration' | 'analysis' | 'reporting' | 'troubleshooting';
}

export interface SuggestionConfig {
  maxSuggestions: number;
  minConfidence: number;
  categories: ConversationSuggestion['category'][];
  enableAnalytics: boolean;
  enableWooCommerce: boolean;
  enableFollowUp: boolean;
}

export interface SuggestionState {
  suggestions: ConversationSuggestion[];
  isLoading: boolean;
  lastUpdated: number;
  context: SuggestionContext | null;
}

export interface SuggestionService {
  generateSuggestions: (context: SuggestionContext, opts?: { threadId?: string; model?: string }) => Promise<ConversationSuggestion[]>;
  analyzeContext: (messages: import('./message').MessageResponse[]) => Promise<SuggestionContext>;
  getCachedSuggestions: (threadId: string) => ConversationSuggestion[] | null;
  cacheSuggestions: (threadId: string, suggestions: ConversationSuggestion[]) => void;
  getLastUsage?: () => {
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    totalTokens: number;
    model: string;
    cost: number;
  } | null;
}
