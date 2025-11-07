export interface TokenUsage {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  total_cost: number;
  model_costs: Record<string, number>;
  last_updated: string | null;
}

export interface Thread {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  tokenUsage?: TokenUsage;
  bookmarked?: boolean;
  archived?: boolean;
}

export interface MessageOptions {
  model?: string;
  provider?: string;
  apiKey?: string;
  tools?: string[];
  allowTool?: "allow" | "deny";
  approveAllTools?: boolean; // if true, skip tool approval prompts
  wooCommerceCredentials?: {
    url: string;
    consumerKey: string;
    consumerSecret: string;
  };
}

export interface MessageRequest {
  threadId: string;
  type: "human";
  content: string;
  model?: string;
  tools?: string[];
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  id: string;
  type: "tool_call";
}

export interface ToolCallChunk {
  name: string;
  args: string;
  index: number;
  type: "tool_call_chunk";
  id: string;
}

export interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ContentItem {
  functionCall?: FunctionCall;
  thoughtSignature?: string;
}

export interface AIMessageData {
  id: string;
  content: string | ContentItem[];
  tool_calls?: ToolCall[];
  tool_call_chunks?: ToolCallChunk[];
  additional_kwargs?: Record<string, unknown>;
  invalid_tool_calls?: unknown[];
  response_metadata?: Record<string, unknown>;
  liked?: boolean;
  disliked?: boolean;
  favorited?: boolean;
  bookmarked?: boolean;
}

export interface ToolMessageData {
  id: string;
  content: string;
  status: string;
  artifact?: unknown[];
  tool_call_id: string;
  name: string;
  metadata?: Record<string, unknown>;
  additional_kwargs?: Record<string, unknown>;
  response_metadata?: Record<string, unknown>;
}

export interface BasicMessageData {
  id: string;
  content: string;
  favorited?: boolean;
  bookmarked?: boolean;
}

export interface ToolApprovalCallbacks {
  onApprove: (toolCallId: string) => void;
  onDeny: (toolCallId: string) => void;
}

export interface TokenUsageData {
  id?: string; // fake field just to remove the type error of TokenUsageData dosnt has id
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  model: string;
  cost: number;
  error?: string; // Optional error message when token usage is not available
}

export interface MessageResponse {
  type: "human" | "ai" | "tool" | "error" | "tokenUsage";

  data: BasicMessageData | AIMessageData | ToolMessageData | TokenUsageData;
  message_id?: string;
  is_liked?: boolean;
  is_disliked?: boolean;
  is_favorited?: boolean;
  is_bookmarked?: boolean;
  is_flagged?: boolean;
  is_archived?: boolean;
}
