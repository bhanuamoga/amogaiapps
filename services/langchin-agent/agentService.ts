import { ensureAgent } from "@/lib/langchin-agent/agent";
import { ensureThread } from "@/lib/langchin-agent/thread";
import type { MessageOptions, MessageResponse, ToolCall } from "@/types/langchin-agent/message";
import { getHistory } from "@/lib/langchin-agent/agent/memory";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { updateTokenUsage, calculateModelCost } from "@/lib/langchin-agent/tokenUsage";
import { postgrest } from "@/lib/postgrest";

/**
 * Returns an async iterable producing incremental AI text chunks for a user text input.
 * Thread is ensured before streaming. The consumer (route) can package into SSE or any protocol.
 */
export async function streamResponse(params: {
  threadId: string;
  userText: string;
  userId?: number;
  opts?: MessageOptions;
}) {
  const { threadId, userText, userId, opts } = params;
  await ensureThread(threadId, userId ?? 0, userText);

  // If allowTool is present, use Command with resume action instead of regular inputs
  const inputs = opts?.allowTool
    ? new Command({
      resume: {
        action: opts.allowTool === "allow" ? "continue" : "update",
        data: {},
      },
    })
    : {
      messages: [new HumanMessage(userText)],
    };

  console.log("StreamResponse - provider:", opts?.provider, "apiKey provided:", !!opts?.apiKey);
  const agent = await ensureAgent({
    model: opts?.model,
    provider: opts?.provider,
    apiKey: opts?.apiKey,
    tools: opts?.tools,
    approveAllTools: opts?.approveAllTools,
    wooCommerceCredentials: opts?.wooCommerceCredentials,
    userId: userId ?? 0,
  });

  const iterable = await agent.stream(inputs, {
    streamMode: ["updates"],
    configurable: { 
  thread_id: threadId,
  user_id: userId ?? "anonymous",   // ⭐ This fixes "tenant or user not found"
},

    metadata: {
      user_id: 13,
      bookmarked: false,
    }
  });

  // Track token usage variables - only real tokens, no estimates
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCachedTokens = 0;
  let hasRealTokenData = false;
  const modelName = opts?.model || "unknown";

  async function* generator(): AsyncGenerator<MessageResponse, void, unknown> {
    console.log("generator");
    for await (const chunk of iterable) {
      if (!chunk) continue;

      // Handle tuple format: [type, data]
      if (Array.isArray(chunk) && chunk.length === 2) {
        const [chunkType, chunkData] = chunk;
        if (
          chunkType === "updates" &&
          chunkData &&
          typeof chunkData === "object" &&
          !Array.isArray(chunkData)
        ) {
          // Handle updates: ['updates', { agent: { messages: [Array] } }]
          if (
            "agent" in chunkData &&
            chunkData.agent &&
            typeof chunkData.agent === "object" &&
            !Array.isArray(chunkData.agent) &&
            "messages" in chunkData.agent
          ) {
            const messages = Array.isArray(chunkData.agent.messages)
              ? chunkData.agent.messages
              : [chunkData.agent.messages];

            for (const message of messages) {
              if (!message) continue;

              const isAIMessage =
                message?.constructor?.name === "AIMessageChunk" ||
                message?.constructor?.name === "AIMessage";

              if (!isAIMessage) continue;

              const messageWithTools = message as Record<string, unknown>;

              // Extract token usage - check both possible locations but don't double-count
              let tokenDataFound = false;

              // First check usage_metadata (more common for newer APIs like Gemini)
              if (!tokenDataFound && messageWithTools.usage_metadata) {
                const usageMetadata = messageWithTools.usage_metadata as Record<string, number>;

                // Handle both naming conventions
                const promptTokens = usageMetadata.prompt_tokens || usageMetadata.input_tokens || 0;
                const completionTokens = usageMetadata.completion_tokens || usageMetadata.output_tokens || 0;
                const cachedTokens = usageMetadata.cached_tokens || 0;

                if (promptTokens > 0 || completionTokens > 0) {
                  totalPromptTokens += promptTokens;
                  totalCompletionTokens += completionTokens;
                  totalCachedTokens += cachedTokens;
                  hasRealTokenData = true;
                  tokenDataFound = true;
                }
              }

              // Fallback to response_metadata.token_usage if usage_metadata wasn't found
              if (!tokenDataFound && messageWithTools.response_metadata) {
                const metadata = messageWithTools.response_metadata as Record<string, unknown>;
                if (metadata.token_usage) {
                  const tokenUsage = metadata.token_usage as Record<string, number>;

                  const promptTokens = tokenUsage.prompt_tokens || tokenUsage.input_tokens || 0;
                  const completionTokens = tokenUsage.completion_tokens || tokenUsage.output_tokens || 0;
                  const cachedTokens = tokenUsage.cached_tokens || 0;

                  if (promptTokens > 0 || completionTokens > 0) {
                    totalPromptTokens += promptTokens;
                    totalCompletionTokens += completionTokens;
                    totalCachedTokens += cachedTokens;
                    hasRealTokenData = true;
                    tokenDataFound = true;
                  }
                }
              }

              const processedMessage = processAIMessage(messageWithTools);
              if (processedMessage) {
                yield processedMessage;
              }
            }
          }
        }
      }
    }

    // Only send token usage if we have real data from the API
    if (hasRealTokenData && (totalPromptTokens > 0 || totalCompletionTokens > 0)) {
      console.log("Sending real token usage:", {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
        cachedTokens: totalCachedTokens,
        model: modelName,
      });

      // Track tokens asynchronously
      const cost = await trackTokenUsage(
        threadId,
        modelName,
        totalPromptTokens,
        totalCompletionTokens,
        totalCachedTokens,
        opts?.provider,
        userId,
      );

      // Yield token usage information
      yield {
        type: "tokenUsage",
        data: {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
          cachedTokens: totalCachedTokens,
          model: modelName,
          cost: cost?.total_cost || 0,
        },
      };
    } else {
      // No real token data available - log error but don't yield anything
      console.error("No token usage data available from API");
    }
  }

  return generator();
}

/**
 * Track token usage for a completed request
 */
export async function trackTokenUsage(
  threadId: string,
  modelName: string,
  promptTokens: number,
  completionTokens: number,
  cachedTokens: number = 0,
  provider?: string,
  userId?: number,
) {
  try {
    const totalTokens = promptTokens + completionTokens;

    // Prevent division by zero
    if (totalTokens === 0) {
      console.warn("Cannot track token usage: total tokens is 0");
      return;
    }

    const cost = calculateModelCost(modelName, promptTokens, completionTokens, provider);
    const costPer1K = cost / (totalTokens / 1000);

    await updateTokenUsage(threadId, {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cached_tokens: cachedTokens,
      model_name: modelName,
      cost_per_1k_tokens: costPer1K,
      source: 'llm',
    }, userId);

    return {
      total_cost: cost,
      model_name: modelName,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cached_tokens: cachedTokens,
    };
  } catch (error) {
    console.error("Error tracking token usage:", error);
  }
}

// Helper function to process any AI message and return the appropriate MessageResponse
function processAIMessage(message: Record<string, unknown>): MessageResponse | null {
  // Check if this is a tool call - handle both OpenAI and Gemini formats
  const hasToolCall =
    // OpenAI format: tool_calls array on message
    (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) ||
    // Gemini format: content array with functionCall
    (Array.isArray(message.content) &&
      message.content.some(
        (item: unknown) => item && typeof item === "object" && "functionCall" in item,
      ));

  if (hasToolCall) {
    // Return full AIMessageData for tool calls to preserve all information
    return {
      type: "ai",
      data: {
        id: (message.id as string) || Date.now().toString(),
        content: typeof message.content === "string" ? message.content : "",
        tool_calls: (message.tool_calls as ToolCall[]) || undefined,
        additional_kwargs: (message.additional_kwargs as Record<string, unknown>) || undefined,
        response_metadata: (message.response_metadata as Record<string, unknown>) || undefined,
      },
    };
  } else {
    // Handle regular text content - extract text from various content types
    let text = "";
    if (typeof message.content === "string") {
      text = message.content;
    } else if (Array.isArray(message.content)) {
      text = message.content
        .map((c: string | { text?: string }) => (typeof c === "string" ? c : c?.text || ""))
        .join("");
    } else {
      text = String(message.content ?? "");
    }

    // Only return message if we have actual text content
    if (text.trim()) {
      return {
        type: "ai",
        data: { id: (message.id as string) || Date.now().toString(), content: text },
      };
    }
  }

  return null;
}

/** Fetch prior messages for a thread from the LangGraph checkpoint/memory system. */
export async function fetchThreadHistory(threadId: string): Promise<MessageResponse[]> {
  const { data: thread, error } = await postgrest
    .from("Thread")
    .select("id, token_usage")
    .eq("id", threadId)
    .single();

  if (error || !thread) return [];

  try {
    const history = await getHistory(threadId);
    //return history.map((msg: BaseMessage) => msg.toDict() as MessageResponse);
    return history.map((msg: any) => msg as MessageResponse);
  } catch (e) {
    console.error("fetchThreadHistory error", e);
    return [];
  }
}