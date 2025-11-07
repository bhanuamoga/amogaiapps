"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Star,
  Flag,
  Archive,
  MessageCircle,
  History,
  Bot,
  User,
  X,
  Heart,
} from "lucide-react";
import type { MessageResponse } from "@/types/langchin-agent/message";
import { getMessageContent, getMessageId, hasToolCalls, getToolCalls } from "@/services/langchin-agent/messageUtils";
import { AnalyticsMessage } from "./AnalyticsMessage";

interface PromptHistoryInlineProps {
  open: boolean;
  onClose: () => void;
  messages: MessageResponse[];
  onMessageClick: (messageId: string) => void;
}

type FilterType = "all" | "favorite" | "bookmark" | "actionItems" | "archived";

export function PromptHistoryInline({
  open,
  onClose,
  messages,
  onMessageClick,
}: PromptHistoryInlineProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  // Filter messages based on search and active filter
  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      // Only show human and AI messages, exclude tool/error messages
      if (message.type !== "human" && message.type !== "ai") return false;

      // Filter by active tab
      if (activeFilter === "favorite" && !message.is_favorited) return false;
      if (activeFilter === "bookmark" && !message.is_bookmarked) return false;
      if (activeFilter === "actionItems" && !message.is_flagged) return false;
      if (activeFilter === "archived" && !message.is_archived) return false;

      // For "All Prompts", only show messages that have at least one flag
      if (activeFilter === "all") {
        const hasAnyFlag = message.is_favorited || message.is_bookmarked || message.is_flagged || message.is_archived;
        if (!hasAnyFlag) return false;
      }

      // Filter by search query (search in content)
      const content = getMessageContent(message);
      return content.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [messages, activeFilter, searchQuery]);

  const handleMessageClick = (message: MessageResponse) => {
    const messageId = getMessageId(message);
    if (messageId) {
      onMessageClick(messageId);
    }
  };

  // Cleanup effect to ensure proper state reset
  useEffect(() => {
    if (!open) {
      // Reset search and filter when closed
      setSearchQuery("");
      setActiveFilter("all");
    }
  }, [open]);

  const truncateText = (text: string, maxLength = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const getMessageTypeIcon = (message: MessageResponse) => {
    if (message.type === "human") {
      return <User className="h-4 w-4" />;
    }
    return <Bot className="h-4 w-4" />;
  };

  const getMessageTypeLabel = (message: MessageResponse) => {
    return message.type === "human" ? "User" : "AI Assistant";
  };

  const getTokenUsage = (message: MessageResponse) => {
    // Try to extract token usage from message metadata if available
    if (message.data && typeof message.data === 'object' && 'tokenUsage' in message.data) {
      const tokenUsage = message.data.tokenUsage as Record<string, unknown>;
      if (tokenUsage && typeof tokenUsage === 'object') {
        return {
          prompt: tokenUsage.prompt_tokens || 0,
          completion: tokenUsage.completion_tokens || 0,
          total: tokenUsage.total_tokens || 0,
        };
      }
    }
    return null;
  };

  if (!open) return null;

  return (
    <div className="absolute top-0 left-0 right-0 bottom-0 z-50 bg-background animate-in slide-in-from-top-4 duration-300">
      <div className="h-full flex flex-col">
        {/* Header with close button */}
        <div className="flex-shrink-0 bg-background border-b p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Prompt History</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-shrink-0 p-4 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search prompt history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={activeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("all")}
              >
                All Prompts
              </Button>
              <Button
                variant={activeFilter === "favorite" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("favorite")}
              >
                <Heart className="h-4 w-4 mr-1" />
                Favorite
              </Button>
              <Button
                variant={activeFilter === "bookmark" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("bookmark")}
              >
                <Star className="h-4 w-4 mr-1" />
                Important
              </Button>
              <Button
                variant={activeFilter === "actionItems" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("actionItems")}
              >
                <Flag className="h-4 w-4 mr-1" />
                Action Items
              </Button>
              <Button
                variant={activeFilter === "archived" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("archived")}
              >
                <Archive className="h-4 w-4 mr-1" />
                Archived
              </Button>
            </div>
          </div>

          {/* Message Cards */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
            <div className="space-y-4">
              {filteredMessages.map((message) => {
                const messageId = getMessageId(message);
                const content = getMessageContent(message);
                const tokenUsage = getTokenUsage(message) as { prompt: number; completion: number; total: number };

                // Check for analytics tools in AI messages
                const hasTools = hasToolCalls(message);
                const toolCalls = getToolCalls(message);
                const analyticsTools = ['createDataCards', 'createDataDisplay'];
                const hasAnalyticsTools = hasTools && toolCalls.some(toolCall => analyticsTools.includes(toolCall.name));

                return (
                  <Card key={messageId} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted">
                            {getMessageTypeIcon(message)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {getMessageTypeLabel(message)}
                              </span>
                              <span className="text-muted-foreground text-xs">•</span>
                              <span className="text-xs text-muted-foreground">
                                {message.type === "human" ? "User Message" : "AI Response"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Content</p>
                          <p className="text-sm text-muted-foreground">
                            {content ? truncateText(content, 150) : "No content available"}
                          </p>
                        </div>

                        {/* Analytics Tools Display */}
                        {hasAnalyticsTools && (
                          <div className="space-y-2 pt-2 border-t border-border">
                            <p className="text-sm font-medium">Analytics Display</p>
                            <div className="space-y-2">
                              {toolCalls
                                .filter(toolCall => analyticsTools.includes(toolCall.name))
                                .map((toolCall, index) => {
                                  // Parse the tool call arguments to create analytics data
                                  try {
                                    const args = typeof toolCall.args === 'string' ? JSON.parse(toolCall.args) : toolCall.args;
                                    const analyticsData = {
                                      type: toolCall.name === 'createDataCards' ? 'data_cards' : 'data_display',
                                      ...args
                                    };
                                    return <AnalyticsMessage key={index} data={analyticsData} className="w-full" />;
                                  } catch (error) {
                                    console.warn('Failed to parse analytics tool call:', error);
                                    return null;
                                  }
                                })}
                            </div>
                          </div>
                        )}

                        {/* Token Usage */}
                        {tokenUsage && (
                          <div className="space-y-1 pt-2 border-t border-border">
                            <p className="text-sm font-medium">Token Usage</p>
                            <div className="flex gap-4 text-sm text-muted-foreground flex-wrap">
                              <div className="flex items-center gap-1">
                                <span>Prompt:</span>
                                <span>{tokenUsage.prompt}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span>Completion:</span>
                                <span>{tokenUsage.completion}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span>Total:</span>
                                <span>{tokenUsage.total}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Action Icons */}
                        <div className="flex gap-3 pt-3 pb-2">
                          {message.is_favorited && (
                            <Heart className="h-5 w-5 fill-red-500 text-red-500" />
                          )}
                          {message.is_bookmarked && (
                            <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                          )}
                          {message.is_flagged && (
                            <Flag className="h-5 w-5 fill-orange-500 text-orange-500" />
                          )}
                          {message.is_archived && (
                            <Archive className="h-5 w-5 fill-gray-500 text-gray-500" />
                          )}
                        </div>

                        {/* Action Button */}
                        <div className="pt-2 border-t border-border">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleMessageClick(message)}
                            className="w-full"
                          >
                            <MessageCircle className="h-4 w-4 mr-1" />
                            Go to Message
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {filteredMessages.length === 0 && (
                <div className="text-center py-12">
                  <History className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No messages found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? "Try adjusting your search or filter"
                      : "No messages match the selected filter"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
