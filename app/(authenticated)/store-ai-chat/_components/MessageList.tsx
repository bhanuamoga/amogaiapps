import type { MessageResponse, ToolApprovalCallbacks } from "@/types/langchin-agent/message";
import type { ConversationSuggestion } from "@/types/langchin-agent/suggestion";
import { HumanMessage } from "./HumanMessage";
import { AIMessage } from "./AIMessage";
import { ErrorMessage } from "./ErrorMessage";
import { MessageActions } from "./MessageActions";
import { useEffect, useRef, useState, useMemo } from "react";
import { getMessageId, getToolCalls, isSuccessfulToolMessage, isAnalyticsToolMessage } from "@/services/langchin-agent/messageUtils";
import dynamic from "next/dynamic";
import { useUISettings } from "@/context/langchin-agent/UISettingsContext";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronDown } from "lucide-react";

const ToolMessage = dynamic(() => import("./ToolMessage").then((m) => m.ToolMessage), {
  ssr: false,
  loading: () => (
    <div className="rounded bg-muted p-4 text-sm text-muted-foreground">Loading tool output…</div>
  ),
});

interface MessageListProps {
  messages: MessageResponse[];
  approveToolExecution?: (toolCallId: string, action: "allow" | "deny") => Promise<void>;
  onMessageAction?: (messageId: string, action: "like" | "dislike" | "favorite" | "bookmark" | "flag" | "archive") => Promise<void>;
  suggestions?: ConversationSuggestion[];
  isLoadingSuggestions?: boolean;
  onSuggestionClick?: (suggestion: ConversationSuggestion) => void;
  isSending?: boolean;
  onScrollToBottom?: () => void;
}

const MessageList = ({ messages, approveToolExecution, onMessageAction, suggestions = [], isLoadingSuggestions = false, onSuggestionClick, isSending = false, onScrollToBottom }: MessageListProps) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(messages.length);
  const { hideToolMessages } = useUISettings();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [lastSeenMessageCount, setLastSeenMessageCount] = useState(0);

  // Create a map of tool call success status for efficient lookup
  const toolCallSuccessMap = useMemo(() => {
    const successMap: Record<string, boolean> = {};
    
    messages.forEach(message => {
      if (message.type === "tool" && isAnalyticsToolMessage(message)) {
        const toolData = message.data as { tool_call_id?: string };
        if (toolData.tool_call_id) {
          successMap[toolData.tool_call_id] = isSuccessfulToolMessage(message);
        }
      }
    });
    
    return successMap;
  }, [messages]);

  // Helper function to check if an AI message should be hidden entirely
  const shouldHideAIMessage = (message: MessageResponse): boolean => {
    if (message.type !== "ai") return false;
    
    const toolCalls = getToolCalls(message);
    const analyticsTools = ['createDataCards', 'createDataDisplay'];
    const analyticsToolCalls = toolCalls.filter(tc => analyticsTools.includes(tc.name));
    
    // If no analytics tool calls, don't hide
    if (analyticsToolCalls.length === 0) return false;
    
    // If all analytics tool calls failed, hide the entire message
    const allAnalyticsFailed = analyticsToolCalls.every(tc => {
      if (!tc.id) return false; // If no ID, don't hide
      return toolCallSuccessMap[tc.id] === false;
    });
    
    return allAnalyticsFailed;
  };

  // Function to scroll to bottom
  const scrollToBottom = () => {
    if (onScrollToBottom) {
      onScrollToBottom();
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    setShowScrollButton(false);
    setLastSeenMessageCount(messages.length);
  };

  useEffect(() => {
    // Scroll to bottom when messages change (including initial load)
    if (messages.length > 0) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
    // Update the ref to track the current count
    previousMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Auto-scroll when suggestions appear
  useEffect(() => {
    if (suggestions.length > 0 && !isSending) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [suggestions.length, isSending]);

  // Show scroll button when there are new messages or suggestions
  useEffect(() => {
    const hasNewMessages = messages.length > lastSeenMessageCount;
    const hasSuggestions = suggestions.length > 0 && !isSending;
    
    if (hasNewMessages || hasSuggestions) {
      setShowScrollButton(true);
    }
  }, [messages.length, suggestions.length, isSending, lastSeenMessageCount]);

  // Create approval callbacks for tool execution
  const approvalCallbacks: ToolApprovalCallbacks | undefined = approveToolExecution
    ? {
      onApprove: (toolCallId: string) => approveToolExecution(toolCallId, "allow"),
      onDeny: (toolCallId: string) => approveToolExecution(toolCallId, "deny"),
    }
    : undefined;

  // Message action handlers
  const handleMessageAction = async (messageId: string, action: "like" | "dislike" | "favorite" | "bookmark" | "flag" | "archive") => {
    if (!onMessageAction) return;

    setActionLoading(messageId);
    try {
      await onMessageAction(messageId, action);
    } catch (error) {
      console.error(`Failed to ${action} message:`, error);
    } finally {
      setActionLoading(null);
    }
  };
  // Deduplicate messages by ID
  const uniqueMessages = messages.reduce((acc: MessageResponse[], message) => {
    const messageId = getMessageId(message);
    const isDuplicate = acc.some((m) => getMessageId(m) === messageId);
    if (!isDuplicate) {
      acc.push(message);
    }
    return acc;
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-3xl space-y-6">
      {uniqueMessages.map((message, index) => {
        const messageId = getMessageId(message);
        const isLoading = actionLoading === messageId;

        // Get action states from message metadata (loaded by MetaPostgresSaver)
        const isLiked = message.type === "ai" && Boolean(message.is_liked);
        const isDisliked = message.type === "ai" && Boolean(message.is_disliked);
        const isFavorited = Boolean(message.is_favorited);
        const isBookmarked = Boolean(message.is_bookmarked);
        const isFlagged = Boolean(message.is_flagged);
        const isArchived = Boolean(message.is_archived);

        if (message.type === "human") {
          return (
            <div key={messageId} id={`message-${messageId}`}>
              <HumanMessage message={message} />
              <div className="flex justify-end mt-2 mr-11">
                <MessageActions
                  message={message}
                  messageType="human"
                  onFavorite={() => handleMessageAction(messageId, "favorite")}
                  onBookmark={() => handleMessageAction(messageId, "bookmark")}
                  onFlag={() => handleMessageAction(messageId, "flag")}
                  onArchive={() => handleMessageAction(messageId, "archive")}
                  isFavorited={isFavorited}
                  isBookmarked={isBookmarked}
                  isFlagged={isFlagged}
                  isArchived={isArchived}
                  isLoading={isLoading}
                />
              </div>
            </div>
          );
        } else if (message.type === "ai") {
          // Check if this AI message should be hidden entirely
          if (shouldHideAIMessage(message)) {
            return null; // Hide the entire AI message block
          }

          // Detect analytics tools inside AI message tool calls
          const aiToolCalls = getToolCalls(message);
          const hasAnalyticsTools = aiToolCalls.length === 0 || aiToolCalls.some((tc) =>
            tc && typeof tc.name === "string" && (tc.name === "createDataCards" || tc.name === "createDataDisplay")
          );
          return (
            <div key={messageId} id={`message-${messageId}`}>
              <AIMessage
                message={message}
                showApprovalButtons={index === messages.length - 1} // Show buttons only on the latest AI message
                approvalCallbacks={approvalCallbacks}
              />
              {hasAnalyticsTools && (
                <div className="ml-11 mt-2">
                  <MessageActions
                    message={message}
                    messageType="ai"
                    onLike={() => handleMessageAction(messageId, "like")}
                    onDislike={() => handleMessageAction(messageId, "dislike")}
                    onFavorite={() => handleMessageAction(messageId, "favorite")}
                    onBookmark={() => handleMessageAction(messageId, "bookmark")}
                    onFlag={() => handleMessageAction(messageId, "flag")}
                    onArchive={() => handleMessageAction(messageId, "archive")}
                    isLiked={isLiked}
                    isDisliked={isDisliked}
                    isFavorited={isFavorited}
                    isBookmarked={isBookmarked}
                    isFlagged={isFlagged}
                    isArchived={isArchived}
                    isLoading={isLoading}
                  />
                </div>
              )}
            </div>
          );
        } else if (message.type === "tool" && !hideToolMessages) {
          // Check if this is an analytics tool
          const isAnalyticsTool = isAnalyticsToolMessage(message);
          
          // Hide failed analytics tool calls
          if (isAnalyticsTool && !isSuccessfulToolMessage(message)) {
            return null;
          }
          
          return (
            <div key={messageId} id={`message-${messageId}`}>
              <ToolMessage message={message} />
              {isAnalyticsTool && (
                <div className="ml-11 mt-2">
                  <MessageActions
                    message={message}
                    messageType="tool"
                    onFavorite={() => handleMessageAction(messageId, "favorite")}
                    onBookmark={() => handleMessageAction(messageId, "bookmark")}
                    onFlag={() => handleMessageAction(messageId, "flag")}
                    onArchive={() => handleMessageAction(messageId, "archive")}
                    isFavorited={isFavorited}
                    isBookmarked={isBookmarked}
                    isFlagged={isFlagged}
                    isArchived={isArchived}
                    isLoading={isLoading}
                  />
                </div>
              )}
            </div>
          );
        } else if (message.type === "error") {
          return (
            <div key={messageId} id={`message-${messageId}`}>
              <ErrorMessage message={message} />
              <div className="ml-11 mt-2">
                <MessageActions
                  message={message}
                  messageType="error"
                  onFavorite={() => handleMessageAction(messageId, "favorite")}
                  onBookmark={() => handleMessageAction(messageId, "bookmark")}
                  onFlag={() => handleMessageAction(messageId, "flag")}
                  onArchive={() => handleMessageAction(messageId, "archive")}
                  isFavorited={isFavorited}
                  isBookmarked={isBookmarked}
                  isFlagged={isFlagged}
                  isArchived={isArchived}
                  isLoading={isLoading}
                />
              </div>
            </div>
          );
        }
        return null;
      })}
      
      {/* Suggestions Display - Hide when sending to avoid confusion */}
      {suggestions.length > 0 && !isSending && (
        <div className="px-4 py-3 border-t border-border/50 bg-background/50">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Follow-up suggestions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion.id}
                variant="outline"
                size="sm"
                onClick={() => onSuggestionClick?.(suggestion)}
                className="h-8 px-3 py-1 text-sm font-normal transition-all duration-200 border-border hover:bg-muted cursor-pointer rounded-full border text-foreground hover:text-foreground"
                disabled={isLoadingSuggestions}
              >
                <span className="truncate">{suggestion.text}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
      
      {/* Loading suggestions indicator - Hide when sending */}
      {isLoadingSuggestions && suggestions.length === 0 && !isSending && (
        <div className="px-4 py-3 border-t border-border/50 bg-background/50">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-muted-foreground animate-pulse" />
            <span className="text-sm font-medium text-muted-foreground">Generating suggestions...</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-8 w-32 animate-pulse rounded-full bg-muted"
              />
            ))}
          </div>
        </div>
      )}
      
      <div ref={bottomRef} className="h-px" />
      
      {/* Floating scroll to bottom button */}
      {showScrollButton && (
        <div className="fixed bottom-20 right-4 z-50">
          <Button
            onClick={scrollToBottom}
            size="icon"
            className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90 shadow-lg border-2 border-background"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default MessageList;
