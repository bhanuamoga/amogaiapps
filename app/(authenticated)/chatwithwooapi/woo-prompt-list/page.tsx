"use client";

import { useRouter } from "next/navigation";
import { usePrompts, useDeletePrompt } from "@/hooks/langchin-agent/usePrompts";
import { 
  Check, 
  Loader2, 
  Search, 
  SquarePen, 
  Copy, 
  X,
  Clock,
  Settings
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function PromptListPage() {
  const router = useRouter();
  const { data: prompts, isLoading, error } = usePrompts();
  const deletePromptMutation = useDeletePrompt();
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive" | "scheduled">("all");

  useEffect(() => {
    console.log("prompts", prompts);
  }, [prompts]);
  const handleCopyDescription = (description: string, promptId: number) => {
    navigator.clipboard.writeText(description);
    setCopiedId(promptId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeletePrompt = async (promptId: number) => {
    if (confirm("Are you sure you want to delete this prompt?")) {
      try {
        await deletePromptMutation.mutateAsync(promptId);
      } catch (error) {
        console.error("Failed to delete prompt:", error);
      }
    }
  };

  const filteredPrompts = prompts?.filter((prompt) => {
    // Filter by status
    if (activeFilter === "active" && prompt.status !== "active") return false;
    if (activeFilter === "inactive" && prompt.status !== "inactive") return false;
    if (activeFilter === "scheduled" && !prompt.isScheduled) return false;

    // Filter by search query
    const matchesSearch = (prompt.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (prompt.description || "").toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  }) || [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    if (diffInHours < 48) return "Yesterday";
    return date.toLocaleDateString();
  };

  const formatNextExecution = (dateString: string) => {
    if (!dateString) return "Not scheduled";
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = date.getTime() - now.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    // If in the past, show as "Overdue" or the actual date
    if (diffInMs < 0) {
      const absDiffInHours = Math.abs(diffInHours);
      if (absDiffInHours < 24) return `Overdue (${absDiffInHours}h ago)`;
      const absDiffInDays = Math.abs(diffInDays);
      if (absDiffInDays < 7) return `Overdue (${absDiffInDays}d ago)`;
      return `Overdue - ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    
    // If within the next hour, show minutes
    if (diffInMinutes < 60) {
      return diffInMinutes <= 0 ? "Now" : `in ${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''}`;
    }
    
    // If within the next 24 hours, show hours
    if (diffInHours < 24) {
      return `in ${diffInHours} hour${diffInHours !== 1 ? 's' : ''}`;
    }
    
    // Format time consistently
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
    
    // If tomorrow
    if (diffInDays === 1) {
      return `Tomorrow at ${timeStr}`;
    }
    
    // If within a week, show day name and time
    if (diffInDays < 7) {
      const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
      return `${weekday} at ${timeStr}`;
    }
    
    // Otherwise show full date and time
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${timeStr}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getExecutionStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge variant="default" className="bg-blue-500">Running</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Idle</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">Error loading prompts</h3>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="mx-auto px-3 sm:px-4 py-3 max-w-full sm:max-w-[800px]">
          <div className="flex items-center justify-between">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.push("/chatwithwooapi/woo-prompt-list/new")}
              className="gap-2"
            >
              <SquarePen className="h-4 w-4" />
              New Prompt
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/chatwithwooapi")} className="gap-2">
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
              placeholder="Search prompts..."
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
              variant={activeFilter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter("active")}
            >
              Active
            </Button>
            <Button
              variant={activeFilter === "inactive" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter("inactive")}
            >
              Inactive
            </Button>
            <Button
              variant={activeFilter === "scheduled" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter("scheduled")}
            >
              <Clock className="h-4 w-4 mr-1" />
              Scheduled
            </Button>
          </div>

          {/* Prompts Grid */}
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
            {filteredPrompts.map((prompt) => (
              <Card key={prompt.id} className="flex flex-col hover:shadow-md transition-shadow">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    {getStatusBadge(prompt.status)}
                    {prompt.isScheduled && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Scheduled
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{prompt.title}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCopyDescription(prompt.description, prompt.id)}
                    >
                      {copiedId === prompt.id ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label className="font-semibold text-sm text-muted-foreground">Description</label>
                      <p className="mt-1 text-sm leading-relaxed line-clamp-3">{prompt.description}</p>
                    </div>

                    {prompt.remarks && (
                      <div>
                        <label className="font-semibold text-sm text-muted-foreground">Remarks</label>
                        <p className="mt-1 text-sm leading-relaxed">{prompt.remarks}</p>
                      </div>
                    )}

                    {prompt.isScheduled && (
                      <div>
                        <label className="font-semibold text-sm text-muted-foreground">Schedule</label>
                        <div className="mt-1 space-y-1">
                          <p className="text-sm">Frequency: {prompt.frequency}</p>
                          {prompt.scheduleTime && (
                            <p className="text-sm">Time: {prompt.scheduleTime}</p>
                          )}
                          {prompt.nextExecution && (
                            <p className="text-sm">Next: {formatNextExecution(prompt.nextExecution)}</p>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="text-sm">Status:</span>
                            {getExecutionStatusBadge(prompt.executionStatus)}
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="font-semibold text-sm text-muted-foreground">Delivery</label>
                      <div className="mt-1 space-y-1">
                        <p className="text-sm">AI Chat: {prompt.deliveryOptions?.aiChat ? "Yes" : "No"}</p>
                        <p className="text-sm">Notifier: {prompt.deliveryOptions?.notifier ? "Yes" : "No"}</p>
                        <p className="text-sm">Email: {prompt.deliveryOptions?.email ? "Yes" : "No"}</p>
                        <p className="text-sm">Chat: {prompt.deliveryOptions?.chat ? "Yes" : "No"}</p>
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-sm text-muted-foreground">Target Users</label>
                      <p className="mt-1 text-sm">
                        {prompt.targetAllUsers ? "All Users" : `${prompt.targetUserIds?.length || 0} selected users`}
                      </p>
                    </div>

                    <div>
                      <label className="font-semibold text-sm text-muted-foreground">Created</label>
                      <p className="mt-1 text-sm">{formatDate(prompt.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 border-t pt-4">
                    <Link href={`/chatwithwooapi/woo-prompt-list/${prompt.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Settings className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                    </Link>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/chatwithwooapi/prompt-schedule-logs?promptId=${prompt.id}`)}
                    >
                      <span>View Logs</span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeletePrompt(prompt.id)}
                      disabled={deletePromptMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredPrompts.length === 0 && (
            <div className="py-12 text-center">
              <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No prompts found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? "Try adjusting your search" : "Create your first scheduled prompt to get started"}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


