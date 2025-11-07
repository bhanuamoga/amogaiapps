"use client";

import { useMemo, useRef, useState } from "react";
import { useThreads } from "@/hooks/langchin-agent/useThreads";
import {
  Loader2,
  Check,
  X,
  Pencil,
  Bookmark,
  Share2,
  Bell,
  Menu,
  Copy,
  Info,
  Cpu,
  DollarSign,
  Hash,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface ThreadHeaderProps {
  threadId?: string
  welcome?: boolean
  onOpenPromptHistory?: () => void
}

export function ThreadHeader({ threadId, onOpenPromptHistory }: ThreadHeaderProps) {
  const { threads, refetchThreads, deleteThread } = useThreads();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [updatingBookmark, setUpdatingBookmark] = useState(false)

  const [urlCopied, setUrlCopied] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const handleCreateThread = async () => {
    try {
      // Use router.push for proper Next.js navigation
      // window.location.href = `/store-ai-chat`;
      router.push(`/store-ai-chat`);
    } catch (error) {
      console.error("Failed to create thread:", error);
    }
  };


  const thread = useMemo(() => {
    if (!threadId) return
    return threads.find((t) => {
      return t.id.toLowerCase().includes(threadId.toLowerCase());
    })
  }, [threadId, threads]);

  const isBookmarked = thread?.bookmarked || false;

  const startRename = (id: string, current: string | undefined) => {
    setRenamingId(id);
    setRenameValue(current || "");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const saveRename = async () => {
    if (!renamingId) return;
    setSavingRename(true);
    try {
      await fetch("/api/woo-langchin-agent/agent/threads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: renamingId, title: renameValue || "Untitled thread" }),
      });
      await refetchThreads();
      setRenamingId(null);
    } catch (e) {
      console.error("Rename failed", e);
    } finally {
      setSavingRename(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeleteThread = async (threadId: string) => {
    if (!confirm("Are you sure you want to delete this thread? This action cannot be undone.")) {
      return;
    }
    setDeletingId(threadId);
    try {
      await deleteThread(threadId);
      console.log("deletingId", deletingId)
      // Navigation will be handled by the useThreads hook if we're deleting the active thread
    } catch (e) {
      console.error("Delete failed", e);
      alert("Failed to delete thread. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };
  const handleToggleBookmark = async () => {
    if (!threadId) return;

    setUpdatingBookmark(true);
    try {
      await fetch("/api/woo-langchin-agent/agent/threads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: threadId, bookmarked: !isBookmarked }),
      });
      await refetchThreads();
    } catch (e) {
      console.error("Failed to update bookmark", e);
    } finally {
      setUpdatingBookmark(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!threadId) return;

    const url = `${window.location.origin}/store-ai-chat/${threadId}`;
    try {
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy URL", e);
    }
  };

  function handleShare(platform: string): void {
    console.log(`Sharing to ${platform}`);
  }

  if (!thread) return (
    <div className="flex items-center justify-between gap-2">
      <h1>
        langchain agent
      </h1>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopyUrl}
          disabled={!threadId}
          className="h-8 w-8 shrink-0"
        >
          {urlCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Share2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleShare("whatsapp")}>
              <span>Share on WhatsApp</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleShare("telegram")}>
              <span>Share on Telegram</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleShare("email")}>
              <span>Share via Email</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/store-ai-chat/notifications")}
          className="h-8 w-8 shrink-0 relative"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Menu className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleCreateThread}>
              <span>New</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onOpenPromptHistory?.()}>
              <span>Prompt History</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/store-ai-chat/chat-history")}>
              <span>Chat History</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/store-ai-chat/woo-prompt-list")}>
              <span>Woo Prompt List</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <div className="group mx-2">
        {!renamingId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-medium" title={thread.title || thread.id}>
                  {thread.title || `Thread ${thread.id.slice(0, 8)}`}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(thread.id, thread.title);
                  }}
                  className="hover:bg-muted inline-flex h-5 w-5 items-center justify-center rounded"
                  title="Rename"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {/* <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteThread(thread.id);
                  }}
                  disabled={deletingId === thread.id}
                  className="hover:bg-muted inline-flex h-5 w-5 items-center justify-center rounded hover:text-red-600 disabled:opacity-50"
                  title="Delete"
                >
                  {deletingId === thread.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button> */}
              </div>
            </div>
          </div>
        )}
        {renamingId && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") cancelRename();
              }}
              className="bg-background border-input focus:ring-ring/40 flex-1 rounded border px-2 py-1 text-xs focus:ring-2 focus:outline-none"
            />
            <button
              disabled={savingRename}
              onClick={saveRename}
              className="bg-primary text-primary-foreground inline-flex h-6 w-6 items-center justify-center rounded hover:brightness-110 disabled:opacity-50"
            >
              {savingRename ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={cancelRename}
              className="bg-muted text-muted-foreground inline-flex h-6 w-6 items-center justify-center rounded hover:brightness-110"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {/* <div className="text-muted-foreground/70 mt-1 flex items-center gap-2 text-[10px]">
          <span>{thread.id.slice(0, 6)}</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          <span>{new Date(thread.createdAt).toLocaleDateString()}</span>
        </div> */}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopyUrl}
          disabled={!threadId}
          className="h-8 w-8 shrink-0"
        >
          {urlCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleBookmark}
          disabled={updatingBookmark || !threadId}
          className="h-8 w-8 shrink-0"
        >
          {updatingBookmark ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-primary text-primary" : ""}`} />
          )}
        </Button>
        {thread.tokenUsage && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Info className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  <span className="font-medium">Token Usage</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Prompt Tokens</span>
                      <Badge variant="secondary" className="text-xs">
                        {thread.tokenUsage.prompt_tokens.toLocaleString()}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Completion Tokens</span>
                      <Badge variant="secondary" className="text-xs">
                        {thread.tokenUsage.completion_tokens.toLocaleString()}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Cached Tokens</span>
                      <Badge variant="secondary" className="text-xs">
                        {thread.tokenUsage.cached_tokens.toLocaleString()}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total Tokens</span>
                      <Badge variant="outline" className="text-xs">
                        {thread.tokenUsage.total_tokens.toLocaleString()}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total Cost</span>
                      <Badge variant="destructive" className="text-xs">
                        <DollarSign className="h-3 w-3 mr-1" />
                        {thread.tokenUsage.total_cost.toFixed(4)}
                      </Badge>
                    </div>
                    {thread.tokenUsage.last_updated && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Last Updated</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(thread.tokenUsage.last_updated).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {Object.keys(thread.tokenUsage.model_costs).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      <span className="font-medium text-sm">Model Costs</span>
                    </div>
                    <div className="space-y-1">
                      {Object.entries(thread.tokenUsage.model_costs).map(([model, cost]) => (
                        <div key={model} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground truncate">{model}</span>
                          <Badge variant="outline" className="text-xs">
                            <DollarSign className="h-3 w-3 mr-1" />
                            {cost.toFixed(4)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Share2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleShare("whatsapp")}>
              <span>Share on WhatsApp</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleShare("telegram")}>
              <span>Share on Telegram</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleShare("email")}>
              <span>Share via Email</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/store-ai-chat/notifications")}
          className="h-8 w-8 shrink-0 relative"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Menu className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleCreateThread}>
              <span>New</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onOpenPromptHistory?.()}>
              <span>Prompt History</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/store-ai-chat/chat-history")}>
              <span>Chat History</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/store-ai-chat/woo-prompt-list")}>
              <span>Woo Prompt List</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/store-ai-chat/prompt-schedule-logs")}>
              <span>Prompt Schedule Logs</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
