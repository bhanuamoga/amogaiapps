import {
  MessageResponse,
  AIMessageData,
  ToolMessageData,
  ContentItem,
  ToolCall,
  FunctionCall,
} from "@/types/langchin-agent/message";

export function getMessageContent(message: MessageResponse): string {
  // Type guard to check if data has content property
  if (message.data && typeof message.data === 'object' && 'content' in message.data) {
    const dataWithContent = message.data as { content: string | ContentItem[] };
    if (typeof dataWithContent.content === "string") {
      return dataWithContent.content;
    }
    // if (Array.isArray(dataWithContent.content)) {
    //   // Handle array content - extract text from ContentItem objects
    //   return dataWithContent.content.map(item => {
    //     if (typeof item === "string") {
    //       return item;
    //     } 
    //     if (typeof item === "object" && item !== null) {
    //       // Check if it's a ContentItem with text content
    //       if ('text' in item) {
    //         return (item as any).text;
    //       }
    //       // If it's a function call or other object, skip it
    //       return "";
    //     }
    //     return "";
    //   }).filter(text => text.length > 0).join(" ");
    // }
  }
  return "";
}

export function getMessageId(message: MessageResponse): string {
  if (
    message.data &&
    "id" in message.data &&
    typeof (message.data as { id?: unknown }).id === "string"
  ) {
    return (message.data as { id: string }).id;
  }
  return "";
}

export function isAIMessageWithToolCalls(
  message: MessageResponse,
): message is MessageResponse & { data: AIMessageData } {
  return (
    message.type === "ai" &&
    typeof message.data === "object" &&
    ("tool_calls" in message.data ||
      ("content" in message.data && 
        Array.isArray(message.data.content) &&
        message.data.content.some((item: ContentItem) => item.functionCall)))
  );
}

export function getToolCalls(message: MessageResponse): ToolCall[] {
  if (!isAIMessageWithToolCalls(message)) {
    return [];
  }
  return message.data.tool_calls || [];
}

export function getFunctionCalls(message: MessageResponse): FunctionCall[] {
  if (!isAIMessageWithToolCalls(message)) {
    return [];
  }

  if (Array.isArray(message.data.content)) {
    return message.data.content
      .filter((item: ContentItem) => item.functionCall)
      .map((item: ContentItem) => item.functionCall!);
  }

  return [];
}

export function hasToolCalls(message: MessageResponse): boolean {
  return getToolCalls(message).length > 0 || getFunctionCalls(message).length > 0;
}

export function isToolMessage(
  message: MessageResponse,
): message is MessageResponse & { data: ToolMessageData } {
  return (
    message.type === "tool" &&
    typeof message.data === "object" &&
    "name" in message.data &&
    "tool_call_id" in message.data
  );
}

export function getToolName(message: MessageResponse): string {
  if (isToolMessage(message)) {
    return message.data.name;
  }
  return "";
}

export function isSuccessfulToolMessage(message: MessageResponse): boolean {
  if (message.type !== "tool") return false;
  
  const data = message.data as ToolMessageData;
  
  // Check status field
  if (data.status === "error") return false;
  
  // Parse content to check for error indicators
  const content = String(data.content || "");
  try {
    const parsed = JSON.parse(content);
    if (parsed.success === false) return false;
    if (parsed.error) return false;
  } catch {
    // Not JSON - check text for errors
    if (content.toLowerCase().includes("error")) return false;
  }
  
  return true;
}

export function isAnalyticsToolMessage(message: MessageResponse): boolean {
  if (message.type !== "tool") return false;
  
  const toolName = getToolName(message);
  return toolName === "createDataDisplay" || toolName === "createDataCards";
}
