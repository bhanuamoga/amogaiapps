"use client";
import { MessageInput } from "./MessageInput";
import MessageList from "./MessageList";
import { useChatThread } from "@/hooks/langchin-agent/useChatThread";
import { Loader2, Bot } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageOptions } from "@/types/langchin-agent/message";
import type { ConversationSuggestion } from "@/types/langchin-agent/suggestion";
// import { TokenUsageDisplay } from "./TokenUsageDisplay";
import { useThreads } from "@/hooks/langchin-agent/useThreads";
import { useUISettings } from "@/context/langchin-agent/UISettingsContext";
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThreadHeader } from "./ThreadHeader";
import { PromptHistoryInline } from "./PromptHistoryInline";

interface ThreadProps {
  threadId: string;
  onFirstMessageSent?: (threadId: string) => void;
  pendingMessage?: {message: string, opts?: MessageOptions} | null;
  onPendingMessageSent?: () => void;
  isNewThread?: boolean;
  onFirstStreamStart?: () => void;
}

export const Thread = ({ threadId, onFirstMessageSent, pendingMessage, onPendingMessageSent, isNewThread = false, onFirstStreamStart }: ThreadProps) => {
  const queryClient = useQueryClient();
  const { threads } = useThreads();
  const { selectedAiConfig, selectedApi } = useUISettings();
  const {
    messages,
    isLoadingHistory,
    isSending,
    isWaitingForResponse,
    sendMessage,
    approveToolExecution,
    suggestions,
    isLoadingSuggestions,
  } = useChatThread({ 
    threadId, 
    isNewThread,
    aiConfig: selectedAiConfig ? {
      model: selectedAiConfig.model,
      provider: selectedAiConfig.provider,
      apiKey: selectedAiConfig.apiKey,
    } : undefined,
    wooCommerceConfig: selectedApi ? {
      url: selectedApi.apiUrl,
      consumerKey: selectedApi.apiKey,
      consumerSecret: selectedApi.apiSecret,
    } : undefined,
  });
  const currentThread = threads.find((t) => t.id === threadId);
  const firstMessageInitiatedRef = useRef(false);
  const pendingMessageProcessedRef = useRef(false);
  const urlChangeTriggeredRef = useRef(false);
  const [awaitingFirstResponse, setAwaitingFirstResponse] = useState(false);
  const [showPromptHistory, setShowPromptHistory] = useState(false);

  const handleSendMessage = useCallback(
    async (message: string, opts?: MessageOptions) => {
      const wasEmpty = messages.length === 0;

      // Clear suggestions when sending a new message
      queryClient.setQueryData(["suggestions", threadId], []);

      try {
        await sendMessage(message, opts);
      } catch (error) {
        console.error("Error in sendMessage:", error);
      }

      if (wasEmpty) {
        firstMessageInitiatedRef.current = true;
        setAwaitingFirstResponse(true);
      }
    },
    [messages.length, sendMessage, queryClient, threadId]
  );

  const handleMessageAction = useCallback(
    async (messageId: string, action: "like" | "dislike" | "favorite" | "bookmark" | "flag" | "archive") => {
      // Find the message index
      const messageIndex = messages.findIndex(msg => {
        const msgId = msg.data?.id || msg.message_id;
        return msgId === messageId;
      });

      if (messageIndex === -1) {
        console.error("Message not found");
        return;
      }

      // Get current metadata for potential rollback
      const currentMessage = messages[messageIndex];
      const currentMetadata = {
        is_liked: currentMessage.is_liked || false,
        is_disliked: currentMessage.is_disliked || false,
        is_favorited: currentMessage.is_favorited || false,
        is_bookmarked: currentMessage.is_bookmarked || false,
        is_flagged: currentMessage.is_flagged || false,
        is_archived: currentMessage.is_archived || false,
      };

      // Calculate new state
      const newMetadata = { ...currentMetadata };
      switch (action) {
        case "like":
          newMetadata.is_liked = !currentMetadata.is_liked;
          if (newMetadata.is_liked) {
            newMetadata.is_disliked = false;
          }
          break;
        case "dislike":
          newMetadata.is_disliked = !currentMetadata.is_disliked;
          if (newMetadata.is_disliked) {
            newMetadata.is_liked = false;
          }
          break;
        case "favorite":
          newMetadata.is_favorited = !currentMetadata.is_favorited;
          break;
        case "bookmark":
          newMetadata.is_bookmarked = !currentMetadata.is_bookmarked;
          break;
        case "flag":
          newMetadata.is_flagged = !currentMetadata.is_flagged;
          break;
        case "archive":
          newMetadata.is_archived = !currentMetadata.is_archived;
          break;
      }

      // Update the message in the cache immediately (optimistic update)
      queryClient.setQueryData(["messages", threadId], (old: Record<string, unknown>[] = []) => {
        const newMessages = [...old];
        newMessages[messageIndex] = {
          ...newMessages[messageIndex],
          ...newMetadata
        };
        return newMessages;
      });

      try {
        // Then call the API
        await fetch("/api/woo-langchin-agent/agent/messages/actions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            messageId, 
            action, 
            threadId,
            messageIndex
          }),
        });
      } catch (error) {
        console.error(`Failed to ${action} message:`, error);
        // Revert optimistic update on error
        queryClient.setQueryData(["messages", threadId], (old: Record<string, unknown>[] = []) => {
          const newMessages = [...old];
          newMessages[messageIndex] = {
            ...newMessages[messageIndex],
            is_liked: currentMetadata.is_liked,
            is_disliked: currentMetadata.is_disliked,
            is_favorited: currentMetadata.is_favorited,
            is_bookmarked: currentMetadata.is_bookmarked,
            is_flagged: currentMetadata.is_flagged,
            is_archived: currentMetadata.is_archived,
          };
          return newMessages;
        });
      }
    },
    [messages, threadId, queryClient]
  );

  const handleSuggestionClick = useCallback(
    async (suggestion: ConversationSuggestion) => {
      // Clear suggestions immediately for better UX
      queryClient.setQueryData(["suggestions", threadId], []);
      
      // Check if we have valid AI configuration
      if (!selectedAiConfig || !selectedAiConfig.apiKey) {
        console.error("No valid AI configuration found for suggestion");
        return;
      }

      // Send the suggestion text as a message with proper configuration
      await sendMessage(suggestion.text, {
        model: selectedAiConfig.model,
        provider: selectedAiConfig.provider,
        apiKey: selectedAiConfig.apiKey,
        tools: [],
        approveAllTools: true,
        wooCommerceCredentials: selectedApi ? {
          url: selectedApi.apiUrl,
          consumerKey: selectedApi.apiKey,
          consumerSecret: selectedApi.apiSecret,
        } : undefined,
      });
    },
    [sendMessage, threadId, queryClient, selectedAiConfig, selectedApi]
  );

  const handleScrollToBottom = useCallback(() => {
    // Find the scroll area element and scroll to bottom
    const scrollArea = document.getElementById('scroll-area');
    if (scrollArea) {
      const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, []);

  const handleScrollToMessage = useCallback((messageId: string) => {
    // Close prompt history first
    setShowPromptHistory(false);
    
    // Small delay to allow the inline component to close with animation
    setTimeout(() => {
      const element = document.getElementById(`message-${messageId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  }, []);

  // Handle pending message from home page
  useEffect(() => {
    if (pendingMessage && messages.length === 0 && !isSending && !firstMessageInitiatedRef.current && !pendingMessageProcessedRef.current) {
      pendingMessageProcessedRef.current = true;
       
      // Add a small delay to ensure the thread is fully ready
      // TOFIX: somtime the first message disapear on submit so i added a delay
      setTimeout(() => {
        handleSendMessage(pendingMessage.message, pendingMessage.opts);
        // Clear the pending message after sending
        if (onPendingMessageSent) {
          onPendingMessageSent();
        }
      }, 500); // 500ms delay to ensure thread is ready
    }
  }, [pendingMessage, messages.length, isSending, onPendingMessageSent, handleSendMessage]);

  // Detect first AI/tool/error message arrival after initial user message to trigger redirect
  useEffect(() => {
    if (awaitingFirstResponse && !isSending) {
      const hasNonHuman = messages.some((m) => m.type !== "human");
      if (hasNonHuman) {
        setAwaitingFirstResponse(false);
        if (onFirstMessageSent) onFirstMessageSent(threadId);
      }
    }
  }, [awaitingFirstResponse, isSending, messages, onFirstMessageSent, threadId]);

  // Detect first streaming message and trigger URL change
  // Using router.replace so no need to wait for streaming to complete
  useEffect(() => {
    if (isNewThread && onFirstStreamStart && messages.length > 0 && !urlChangeTriggeredRef.current && !isSending && !isWaitingForResponse) {
      // Check if we have the first AI message (streaming started)
      const hasAIMessage = messages.some((m) => m.type === "ai");
      if (hasAIMessage) {
        console.log('[Thread] Triggering route change - AI message detected');
        urlChangeTriggeredRef.current = true;
        onFirstStreamStart();
      }
    }
  }, [messages, isNewThread, onFirstStreamStart, isSending]);

  // Cleanup dialog state when thread changes
  useEffect(() => {
    setShowPromptHistory(false);
  }, [threadId]);

  // Warn user about unsaved messages when leaving the page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSending || isWaitingForResponse) {
        e.preventDefault();
        e.returnValue = 'You have an active conversation. Are you sure you want to leave?';
        return 'You have an active conversation. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSending, isWaitingForResponse]);

  // Don't show loading history if we have a pending message to send or if we're currently sending
  if (isLoadingHistory && !pendingMessage && !isSending) {
    return (
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 absolute inset-0 flex items-center justify-center backdrop-blur">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <p className="text-muted-foreground mt-2">Loading conversation history...</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col relative h-full">
      {messages.length > 0 ? (
        <>
          <ThreadHeader 
            threadId={threadId} 
            onOpenPromptHistory={() => setShowPromptHistory(true)}
          />
          
          {currentThread?.tokenUsage && (
            <>
              {/* <Popover>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent>
                  <div className="flex-shrink-0 border-b border-border bg-muted/50 px-4 py-2">
                    <TokenUsageDisplay tokenUsage={currentThread.tokenUsage} />
                  </div>
                </PopoverContent>
              </Popover> */}
            </>
          )}
          <div className="min-h-0 flex-1 relative">
            <ScrollArea className="h-full [&_[data-radix-scroll-area-viewport]>div]:!block" id="scroll-area">
              <div className="space-y-4 px-4 py-4 " id="scroll-area-content">
                <MessageList 
                  messages={messages} 
                  approveToolExecution={approveToolExecution}
                  onMessageAction={handleMessageAction}
                  suggestions={suggestions}
                  isLoadingSuggestions={isLoadingSuggestions}
                  onSuggestionClick={handleSuggestionClick}
                  isSending={isSending}
                  onScrollToBottom={handleScrollToBottom}
                />
                {isWaitingForResponse && (
                  <div className="flex gap-3">
                    <div className="bg-primary/10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
                      <Bot className="text-primary h-5 w-5" />
                    </div>
                    <div className="max-w-[80%]">
                      <div className="rounded-2xl bg-muted px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex space-x-1">
                            <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]"></div>
                            <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]"></div>
                            <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"></div>
                          </div>
                          <span className="text-sm text-muted-foreground">AI is thinking...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {/* Prompt History Inline Overlay - positioned to cover only chat area */}
            <PromptHistoryInline
              open={showPromptHistory}
              onClose={() => setShowPromptHistory(false)}
              messages={messages}
              onMessageClick={handleScrollToMessage}
            />
          </div>
          <div className={`transition-all duration-300 ${showPromptHistory ? 'h-0 opacity-0 -translate-y-4 pointer-events-none overflow-hidden' : 'flex-shrink-0 opacity-100 translate-y-0'}`}>
            <div className="w-full p-4 pb-6">
              <div className="mx-auto max-w-3xl">
                <MessageInput 
                  onSendMessage={handleSendMessage} 
                  isLoading={isSending || isWaitingForResponse}
                  messages={messages}
                  threadId={threadId}
                  showSuggestions={true}
                  suggestions={suggestions}
                  suggestionsLoading={isLoadingSuggestions}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-3xl px-4">
            <div className={`mb-5 text-center transition-all duration-300 ${showPromptHistory ? 'h-0 opacity-0 -translate-y-4 pointer-events-none overflow-hidden' : 'opacity-100 translate-y-0'}`}>
              <h1 className="text-2xl font-bold text-foreground">
                Chat with your Agent
              </h1>
              <p className="text-muted-foreground mt-2">
                Start a new conversation by sending a message
              </p>
            </div>
            <div className={`transition-all duration-300 ${showPromptHistory ? 'h-0 opacity-0 -translate-y-4 pointer-events-none overflow-hidden' : 'opacity-100 translate-y-0'}`}>
              <MessageInput 
                onSendMessage={handleSendMessage} 
                isLoading={isSending}
                messages={[]}
                threadId={null}
                showSuggestions={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
