"use client";

import { useRouter } from "next/navigation";
import { useThreads } from "@/hooks/langchin-agent/useThreads";
import { 
  Check, 
  Loader2, 
  Search, 
  SquarePen, 
  Bookmark, 
  Archive, 
  MessageCircle, 
  History, 
  Share2, 
  Copy, 
  X 
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ChatHistoryPage() {
  const router = useRouter();
  const { threads, refetchThreads } = useThreads();
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedTitleId, setCopiedTitleId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "bookmarked" | "archived">("all");
  const [isCreating, setIsCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleCreateThread = async () => {
    setIsCreating(true);
    try {
      // window.location.href = `/store-ai-chat`;
      // Use router.push for proper Next.js navigation
      router.push(`/store-ai-chat`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleBookmark = async (threadId: string, currentBookmarked: boolean) => {
    setUpdatingId(threadId);
    try {
      await fetch("/api/woo-langchin-agent/agent/threads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: threadId, bookmarked: !currentBookmarked }),
      });
      await refetchThreads();
    } catch (e) {
      console.error("Failed to update bookmark", e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleArchive = async (threadId: string, currentArchived: boolean) => {
    setUpdatingId(threadId);
    try {
      await fetch("/api/woo-langchin-agent/agent/threads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: threadId, archived: !currentArchived }),
      });
      await refetchThreads();
    } catch (e) {
      console.error("Failed to update archive", e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenChat = (threadId: string) => {
    router.push(`/store-ai-chat/${threadId}`);
  };

  const handleCopyShareUrl = (threadId: string) => {
    const shareUrl = `${window.location.origin}/store-ai-chat/${threadId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedId(threadId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyTitle = (title: string, threadId: string) => {
    navigator.clipboard.writeText(title);
    setCopiedTitleId(threadId);
    setTimeout(() => setCopiedTitleId(null), 2000);
  };

  const filteredThreads = threads.filter((thread) => {
    if (activeFilter === "archived" && !thread.archived) return false;
    if (activeFilter !== "archived" && thread.archived) return false;
    if (activeFilter === "bookmarked" && !thread.bookmarked) return false;

    const matchesSearch = (thread.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                         thread.id.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    if (diffInHours < 48) return "Yesterday";
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="mx-auto px-3 sm:px-4 py-3 max-w-full sm:max-w-[800px]">
          <div className="flex items-center justify-between">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCreateThread}
              disabled={isCreating}
              className="gap-2"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SquarePen className="h-4 w-4" />
              )}
              New Chat
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/store-ai-chat")} className="gap-2">
              <X className="h-4 w-4" />
              <span>Close</span>
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-full sm:max-w-[800px]">
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search chat history..."
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
              All Chats
            </Button>
            <Button
              variant={activeFilter === "bookmarked" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter("bookmarked")}
            >
              <Bookmark className="h-4 w-4 mr-1" />
              Bookmarked
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

          {/* Chat History Cards */}
          <div className="space-y-4">
            {filteredThreads.map((thread) => (
              <Card key={thread.id} className="hover:shadow-md transition-shadow">
                <CardContent className="px-4 sm:px-5 pt-3 pb-2">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src="/placeholder.svg" alt="User" />
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-sm">User</span>
                          <span className="text-muted-foreground text-xs">•</span>
                          <span className="font-medium text-sm truncate">
                            {thread.title || `Thread ${thread.id.slice(0, 8)}`}
                          </span>
                          <div className="flex items-center gap-1 ml-auto">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleCopyTitle(thread.title || `Thread ${thread.id.slice(0, 8)}`, thread.id)}
                            >
                              {copiedTitleId === thread.id ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleCopyShareUrl(thread.id)}
                            >
                              {copiedId === thread.id ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Share2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(thread.createdAt)}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Thread ID */}
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">Thread ID</p>
                        <p className="text-sm font-bold text-foreground">{thread.id}</p>
                      </div>
                    </div>

                    {/* Token Use */}
                    {thread.tokenUsage && (
                      <div className="pt-4 border-t border-border">
                        <div className="space-y-2">
                          <p className="text-sm font-bold text-foreground">Token Use</p>
                          <div className="flex gap-4 text-sm font-bold text-foreground flex-wrap">
                            <div className="flex items-center gap-1">
                              <span>Prompt:</span>
                              <span>{thread.tokenUsage.prompt_tokens}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span>Completion:</span>
                              <span>{thread.tokenUsage.completion_tokens}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span>Total:</span>
                              <span>{thread.tokenUsage.total_tokens}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span>Cost:</span>
                              <span>${thread.tokenUsage.total_cost.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Icons */}
                    <div className="flex items-center gap-2 pt-4 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => handleToggleBookmark(thread.id, thread.bookmarked || false)}
                        disabled={updatingId === thread.id}
                      >
                        <Bookmark
                          className={`h-5 w-5 ${thread.bookmarked ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`}
                        />
                      </Button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4 border-t border-border pb-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleToggleArchive(thread.id, thread.archived || false)}
                        disabled={updatingId === thread.id}
                        className="flex-1"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        {thread.archived ? "Unarchive" : "Archive"}
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => handleOpenChat(thread.id)} 
                        className="flex-1"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Open Chat
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredThreads.length === 0 && (
              <div className="text-center py-12">
                <History className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No chat history found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? "Try adjusting your search" : "Start a conversation to see your chat history here"}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
