import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MessageOptions, MessageResponse, AIMessageData, Thread } from "@/types/langchin-agent/message";
import { createMessageStream, fetchMessageHistory } from "@/services/langchin-agent/chatService";
import type { ConversationSuggestion } from "@/types/langchin-agent/suggestion";

interface UseChatThreadOptions {
  threadId: string | null;
  isNewThread?: boolean;
  aiConfig?: {
    model: string;
    provider: string;
    apiKey: string;
  };
  wooCommerceConfig?: {
    url: string;
    consumerKey: string;
    consumerSecret: string;
  };
}

export interface UseChatThreadReturn {
  messages: MessageResponse[];
  isLoadingHistory: boolean;
  isSending: boolean;
  isWaitingForResponse: boolean;
  historyError: Error | null;
  sendError: Error | null;
  sendMessage: (text: string, opts?: MessageOptions) => Promise<void>;
  refetchMessages: () => Promise<unknown>;
  approveToolExecution: (toolCallId: string, action: "allow" | "deny") => Promise<void>;
  suggestions: ConversationSuggestion[];
  isLoadingSuggestions: boolean;
}

export function useChatThread({ threadId, isNewThread = false, aiConfig, wooCommerceConfig }: UseChatThreadOptions): UseChatThreadReturn {
  const queryClient = useQueryClient();
  const streamRef = useRef<EventSource | null>(null);
  const currentMessageRef = useRef<MessageResponse | null>(null);
  const [sendError, setSendError] = useState<Error | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [suggestions, setSuggestions] = useState<ConversationSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const suggestionsInFlightRef = useRef(false);
  const suggestionsFetchedRef = useRef<string | null>(null);

  // Reset suggestions fetched ref when thread changes
  useEffect(() => {
    suggestionsFetchedRef.current = null;
    console.log('Resetting suggestions fetched ref ##!');
  }, [threadId]);

  const {
    data: messages = [],
    isLoading: isLoadingHistory,
    error: historyError,
    refetch: refetchMessagesQuery,
  } = useQuery<MessageResponse[]>({
    queryKey: ["messages", threadId],
    enabled: !!threadId && !isNewThread, // Disable history loading for new threads
    queryFn: () => (threadId ? fetchMessageHistory(threadId) : Promise.resolve([])),
    staleTime: Infinity, // Never consider data stale - prevent automatic refetches
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache much longer
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchOnMount: false, // Prevent refetch on component mount if data exists
    refetchOnReconnect: false, // Prevent refetch on network reconnect
    refetchInterval: false, // Disable automatic polling
    refetchIntervalInBackground: false, // Disable background polling
  });

  // Ensure we fetch once the threadId becomes available (guards initial undefined cases)
  // But skip for new threads to prevent message disappearing
  // Also skip if there's an active stream to prevent losing unsaved messages
  // Only fetch if we don't already have messages in cache to prevent unnecessary reloads
  // Also skip if there are recent messages (within last 10 seconds) to prevent losing just-sent messages
  useEffect(() => {
    if (threadId && !isNewThread && !streamRef.current && !isSending) {
      const cachedMessages = queryClient.getQueryData<MessageResponse[]>(["messages", threadId]);
      
      // Only fetch if we don't have any cached messages
      if (!cachedMessages || cachedMessages.length === 0) {
        void refetchMessagesQuery();
        return;
      }
      
      // Check if there are any recent messages (within last 10 seconds)
      const now = Date.now();
      const hasRecentMessages = cachedMessages.some(msg => {
        // Check if message has a timestamp or if it's a temp message (just sent)
        if (msg.data && typeof msg.data === 'object' && 'id' in msg.data) {
          const messageId = msg.data.id;
          // If it's a temp message (starts with 'temp-'), it's recent
          if (typeof messageId === 'string' && messageId.startsWith('temp-')) {
            return true;
          }
        }
        return false;
      });
      
      // Don't refetch if there are recent messages to prevent losing them
      if (hasRecentMessages) {
        console.log('Skipping refetch due to recent messages to prevent data loss');
        return;
      }
      
      // Only refetch if we have old cached data and no recent activity
      void refetchMessagesQuery();
    }
  }, [threadId, isNewThread, refetchMessagesQuery, isSending, queryClient]);

  // Shared function to handle SSE streaming for both sendMessage and approveToolExecution
  const handleStreamResponse = useCallback(
    async (streamParams: { threadId: string; text?: string; opts?: MessageOptions }) => {
      const { threadId, text = "", opts } = streamParams;

      setIsSending(true);
      setIsWaitingForResponse(true);
      setSendError(null);

      // If another stream is active, close it before starting a new one
      if (streamRef.current) {
        try {
          streamRef.current.close();
        } catch {}
      }

      try {
        // Open SSE stream to generate the assistant response
        const stream = createMessageStream(threadId, text, opts);
        streamRef.current = stream;

        stream.onmessage = (event: MessageEvent) => {
          try {
            // Parse streaming data - it comes as a complete MessageResponse object
            const messageResponse = JSON.parse(event.data) as MessageResponse;

            // Extract the data from the MessageResponse
            const data = messageResponse.data as AIMessageData;

            // First chunk for this response id: create a new message entry
            if (
              !currentMessageRef.current ||
              !("id" in currentMessageRef.current.data) ||
              currentMessageRef.current.data.id !== data.id
            ) {
              currentMessageRef.current = messageResponse;
              queryClient.setQueryData(["messages", threadId], (old: MessageResponse[] = []) => [
                ...old,
                currentMessageRef.current!,
              ]);
              // Clear waiting state when first AI response arrives
              setIsWaitingForResponse(false);
            } else {
              // Subsequent chunks: append content if it's a string, otherwise replace
              const currentData = currentMessageRef.current.data as AIMessageData;
              const newContent =
                typeof data.content === "string" && typeof currentData.content === "string"
                  ? currentData.content + data.content
                  : data.content;

              currentMessageRef.current = {
                ...currentMessageRef.current,
                data: {
                  ...currentData,
                  content: newContent,
                  // Update tool call data if present
                  ...(data.tool_calls && { tool_calls: data.tool_calls }),
                  ...(data.additional_kwargs && { additional_kwargs: data.additional_kwargs }),
                  ...(data.response_metadata && { response_metadata: data.response_metadata }),
                },
              };
              queryClient.setQueryData(["messages", threadId], (old: MessageResponse[] = []) => {
                // Find the in-flight assistant message by its stable response id
                const currentData = currentMessageRef.current!.data;
                const idx = old.findIndex(
                  (m) => "id" in m.data && "id" in currentData && m.data.id === currentData.id,
                );
                // If it's not in the cache (race or refresh), keep existing state
                if (idx === -1) return old;
                // Immutable update so React Query subscribers are notified
                const clone = [...old];
                // Replace only the updated message entry with the latest accumulated content
                clone[idx] = currentMessageRef.current!;
                return clone;
              });
            }
          } catch {
            // Ignore malformed chunks to keep the stream alive
          }
        };

        stream.addEventListener("done", async () => {
          // Stream finished: clear flags and close
          setIsSending(false);
          setIsWaitingForResponse(false);
          currentMessageRef.current = null;
          stream.close();
          streamRef.current = null;
          await maybeFetchSuggestions();
        });

        stream.addEventListener("tokenUsage", (event: MessageEvent) => {
          try {
            console.log("Token usage event received:", event.data);
            const tokenData = JSON.parse(event.data);
            if (tokenData.type === "tokenUsage" && tokenData.data) {
              console.log("Updating token usage for thread:", threadId, tokenData.data);
              // Update the thread's token usage in the cache (ADD to existing usage)
              queryClient.setQueryData(["threads"], (old: Thread[] = []) => {
                return old.map((thread) => {
                  if (thread.id === threadId) {
                    const existingUsage = thread.tokenUsage;
                    const newUsage = tokenData.data;

                    // Add new usage to existing usage
                    const updatedUsage = {
                      total_tokens: (existingUsage?.total_tokens || 0) + newUsage.totalTokens,
                      prompt_tokens: (existingUsage?.prompt_tokens || 0) + newUsage.promptTokens,
                      completion_tokens:
                        (existingUsage?.completion_tokens || 0) + newUsage.completionTokens,
                      cached_tokens: (existingUsage?.cached_tokens || 0) + newUsage.cachedTokens,
                      total_cost: (existingUsage?.total_cost || 0) + (newUsage.cost || 0), // Calculate cost if needed
                      model_costs: {
                        ...existingUsage?.model_costs,
                        [newUsage.model]: (existingUsage?.model_costs?.[newUsage.model] || 0) + (newUsage.cost || 0),
                      },
                      last_updated: new Date().toISOString(),
                    };

                    console.log("Updated token usage:", {
                      previous: existingUsage,
                      new: newUsage,
                      total: updatedUsage,
                    });

                    return {
                      ...thread,
                      tokenUsage: updatedUsage,
                    };
                  }
                  return thread;
                });
              });
            }
          } catch (error) {
            console.error("Failed to parse token usage:", error);
          }
        });

        stream.addEventListener("error", async (ev: Event) => {
          try {
            // Try to extract a meaningful error message from the event payload
            const dataText = (ev as MessageEvent<string>)?.data;
            const message = (() => {
              try {
                const parsed = dataText ? JSON.parse(dataText) : null;
                return parsed?.message || "An error occurred while generating a response.";
              } catch {
                return "An error occurred while generating a response.";
              }
            })();
            // Surface the error in the chat as a message
            const errorMsg: MessageResponse = {
              type: "error",
              data: { id: `err-${Date.now()}`, content: `⚠️ ${message}` },
            };
            queryClient.setQueryData(["messages", threadId], (old: MessageResponse[] = []) => [
              ...old,
              errorMsg,
            ]);
          } finally {
            // Always clean up the stream and flags on error
            setIsSending(false);
            setIsWaitingForResponse(false);
            currentMessageRef.current = null;
            stream.close();
            streamRef.current = null;
            await maybeFetchSuggestions();
          }
        });
      } catch (err: unknown) {
        // Network/setup failure before the stream started: capture and expose the error
        setSendError(err as Error);
        setIsSending(false);
        setIsWaitingForResponse(false);
        currentMessageRef.current = null;
      }
    },
    [queryClient],
  );

  // Helper: fetch fresh suggestions based on latest cached messages
  const maybeFetchSuggestions = useCallback(async () => {
    if (!threadId) return;
    if (suggestionsInFlightRef.current) {
      console.log('Suggestions already in flight, skipping...');
      return;
    }
    const cachedMessages = queryClient.getQueryData<MessageResponse[]>(["messages", threadId]) || [];
    if (!cachedMessages.length) {
      setSuggestions([]);
      return;
    }
    try {
      suggestionsInFlightRef.current = true;
      setIsLoadingSuggestions(true);
      setSuggestions([]);
      
      // Send only the latest 10 messages to reduce token consumption
      const latestMessages = cachedMessages.slice(-10);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch('/api/woo-langchin-agent/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: latestMessages, 
          threadId,
          aiConfig,
          wooCommerceConfig
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`Failed to fetch suggestions: ${response.status}`);
      }
      const data = await response.json();
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);

      // Apply per-request token usage delta from suggestions generation
      const delta = (data.tokenUsageDelta as
        | { promptTokens: number; completionTokens: number; cachedTokens: number; totalTokens: number; model: string; cost: number }
        | null) || null;

      if (threadId && delta) {
        queryClient.setQueryData(["threads"], (old: Thread[] = []) => {
          return old.map((thread) => {
            if (thread.id !== threadId) return thread;

            const existingUsage = thread.tokenUsage;
            const updatedUsage = {
              total_tokens: (existingUsage?.total_tokens || 0) + (delta.totalTokens || 0),
              prompt_tokens: (existingUsage?.prompt_tokens || 0) + (delta.promptTokens || 0),
              completion_tokens: (existingUsage?.completion_tokens || 0) + (delta.completionTokens || 0),
              cached_tokens: (existingUsage?.cached_tokens || 0) + (delta.cachedTokens || 0),
              total_cost: (existingUsage?.total_cost || 0) + (delta.cost || 0), // do not estimate cost client-side
              model_costs: {
                ...(existingUsage?.model_costs || {}),
                [delta.model]: ((existingUsage?.model_costs?.[delta.model] as number) || 0) + (delta.cost || 0),
              },
              last_updated: new Date().toISOString(),
            };

            return { ...thread, tokenUsage: updatedUsage };
          });
        });
      }
    } catch (e) {
      // On failure, clear suggestions rather than leaving stale ones
      console.error('Failed to fetch suggestions:', e);
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          console.error('Suggestions request timed out after 30 seconds');
        } else {
          console.error('Suggestions request failed:', e.message);
        }
      }
      setSuggestions([]);
    } finally {
      console.log('Suggestions fetch completed, resetting flags...');
      setIsLoadingSuggestions(false);
      suggestionsInFlightRef.current = false;
    }
  }, [queryClient, threadId, aiConfig, wooCommerceConfig, aiConfig?.model, aiConfig?.provider]);

  // Safe refetch function that preserves recent messages
  const refetchMessages = useCallback(async () => {
    if (!threadId) return;
    
    const cachedMessages = queryClient.getQueryData<MessageResponse[]>(["messages", threadId]) || [];
    
    // Don't refetch if there are temp messages (recently sent)
    const hasTempMessages = cachedMessages.some(msg => {
      if (msg.data && typeof msg.data === 'object' && 'id' in msg.data) {
        const messageId = msg.data.id;
        return typeof messageId === 'string' && messageId.startsWith('temp-');
      }
      return false;
    });
    
    if (hasTempMessages) {
      console.log('Skipping manual refetch due to temp messages to prevent data loss');
      return;
    }
    
    return refetchMessagesQuery();
  }, [threadId, queryClient, refetchMessagesQuery]);

  const sendMessage = useCallback(
    async (text: string, opts?: MessageOptions) => {
      // Guard: require a thread to target
      if (!threadId) return;

      // Optimistic UI: append the user's message immediately
      const tempId = `temp-${Date.now()}`;
      const userMessage: MessageResponse = { type: "human", data: { id: tempId, content: text } };
      queryClient.setQueryData(["messages", threadId], (old: MessageResponse[] = []) => [
        ...old,
        userMessage,
      ]);

      // Handle the streaming response
      await handleStreamResponse({ threadId, text, opts });
    },
    [threadId, queryClient, handleStreamResponse],
  );

  const approveToolExecution = useCallback(
    async (toolCallId: string, action: "allow" | "deny") => {
      if (!threadId) return;

      // Handle the streaming response with allowTool parameter, empty content since we're resuming
      await handleStreamResponse({
        threadId,
        text: "",
        opts: { allowTool: action },
      });
    },
    [threadId, handleStreamResponse],
  );

  // Cleanup stream on unmount and prevent refetch during cleanup
  useEffect(
    () => () => {
      if (streamRef.current) {
        try {
          streamRef.current.close();
        } catch {}
      }
      // Clear any pending refetches to prevent data loss
      queryClient.cancelQueries({ queryKey: ["messages", threadId] });
    },
    [queryClient, threadId],
  );

  // Optionally fetch suggestions after history loads if there are messages and no active stream
  useEffect(() => {
    if (!threadId) return;
    if (isLoadingHistory) return;
    if (streamRef.current) return;
    const cachedMessages = queryClient.getQueryData<MessageResponse[]>(["messages", threadId]) || [];
    if (!cachedMessages.length) return;
    
    // Only fetch suggestions if we have valid AI config
    if (!aiConfig || !aiConfig.apiKey) {
      console.log('No valid AI config, skipping suggestions fetch');
      return;
    }
    
    // Create a unique key for this configuration
    const configKey = `${threadId}-${aiConfig.model}-${aiConfig.provider}`;
    
    // Only fetch if we haven't fetched for this configuration yet
    if (suggestionsFetchedRef.current === configKey) {
      console.log('Suggestions already fetched for this configuration, skipping...');
      return;
    }
    
    suggestionsFetchedRef.current = configKey;
    void maybeFetchSuggestions();
  }, [threadId, isLoadingHistory, queryClient, aiConfig, wooCommerceConfig]);

  return {
    messages,
    isLoadingHistory,
    isSending,
    isWaitingForResponse,
    historyError: historyError as Error | null,
    sendError,
    sendMessage,
    refetchMessages,
    approveToolExecution,
    suggestions,
    isLoadingSuggestions,
  };
}
