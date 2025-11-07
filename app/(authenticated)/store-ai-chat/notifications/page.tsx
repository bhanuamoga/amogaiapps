"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search,
  Star,
  Archive,
  Mail,
  MailOpen,
  FileText,
  MessageSquare,
  UserPlus,
  Calendar,
  AlertCircle,
  Share2,
  X,
  Loader2,
} from "lucide-react";
import { useNotifications } from "@/hooks/langchin-agent/useNotifications";
import type { Notification } from "@/types/langchin-agent/notification";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "message":
      return <MessageSquare className="h-5 w-5 text-blue-500" />;
    case "file":
      return <FileText className="h-5 w-5 text-green-500" />;
    case "user":
      return <UserPlus className="h-5 w-5 text-purple-500" />;
    case "calendar":
      return <Calendar className="h-5 w-5 text-orange-500" />;
    case "alert":
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    case "chat-shared":
      return <Share2 className="h-5 w-5 text-cyan-500" />;
    default:
      return <Mail className="h-5 w-5 text-gray-500" />;
  }
};

const extractPathFromUrl = (url: string | null): string | null => {
  if (!url) return null;
  try {
    // If it's already a path (starts with /), return it as is
    if (url.startsWith("/")) return url;
    
    // Try to parse as URL and extract pathname
    const urlObj = new URL(url);
    return urlObj.pathname + (urlObj.search || "");
  } catch {
    // If parsing fails, check if it's already a path
    if (url.startsWith("/")) return url;
    return null;
  }
};

export default function NotificationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "unread" | "read" | "archived" | "favorite">("unread");
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  const router = useRouter();
  
  const {
    notifications,
    isLoading,
    // refetchNotifications,
    loadMoreNotifications,
    toggleFavorite,
    toggleArchive,
    markAsRead,
  } = useNotifications();

  // Load more notifications on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (loadingMore || !hasMore || isLoading) return;

      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = document.documentElement.scrollTop;
      const clientHeight = document.documentElement.clientHeight;

      // Load more when user is 200px from bottom
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        setLoadingMore(true);
        loadMoreNotifications().finally(() => {
          setLoadingMore(false);
        });
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadingMore, hasMore, isLoading, loadMoreNotifications]);

  const filteredNotifications = notifications.filter((notification: Notification) => {
    const matchesSearch =
      (notification.user_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (notification.content || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (notification.ref_chat_url || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedFilter === "unread") {
      return matchesSearch && notification.read_status === false;
    } else if (selectedFilter === "read") {
      return matchesSearch && notification.read_status === true;
    } else if (selectedFilter === "archived") {
      return matchesSearch && notification.archive_status === true;
    } else if (selectedFilter === "favorite") {
      return matchesSearch && notification.favorite === true;
    }

    return matchesSearch;
  });

  // Check if there's more data to load (simplified - in real implementation, should come from API)
  const hasMoreMemo = useMemo(() => {
    return notifications.length > 0;
  }, [notifications.length]);
  
  useEffect(() => {
    setHasMore(hasMoreMemo);
  }, [hasMoreMemo]);

  const handleOpenChat = useCallback(async (notification: Notification) => {
    const actionKey = `open-${notification.id}`;
    if (loadingActions.has(actionKey)) return;
    
    setLoadingActions(prev => new Set(prev).add(actionKey));
    
    try {
      if (notification.ref_chat_url) {
        // Mark as read if it's unread
        if (!notification.read_status) {
          await markAsRead(notification.id);
        }
        
        const path = extractPathFromUrl(notification.ref_chat_url);
        if (path) {
          router.push(path);
        }
      }
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }
  }, [router, markAsRead, loadingActions]);

  const filterCounts = {
    unread: notifications.filter((n: Notification) => n.read_status === false && n.archive_status === false).length,
    read: notifications.filter((n: Notification) => n.read_status === true && n.archive_status === false).length,
    archived: notifications.filter((n: Notification) => n.archive_status === true).length,
    favorite: notifications.filter((n: Notification) => n.favorite === true && n.archive_status === false).length,
  };

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    const actionKey = `read-${notificationId}`;
    if (loadingActions.has(actionKey)) return;
    
    setLoadingActions(prev => new Set(prev).add(actionKey));
    
    try {
      await markAsRead(notificationId);
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }
  }, [markAsRead, loadingActions]);

  const handleToggleFavorite = useCallback(async (notificationId: string, currentFavorite: boolean) => {
    const actionKey = `favorite-${notificationId}`;
    if (loadingActions.has(actionKey)) return;
    
    setLoadingActions(prev => new Set(prev).add(actionKey));
    
    try {
      await toggleFavorite(notificationId, currentFavorite);
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }
  }, [toggleFavorite, loadingActions]);

  const handleToggleArchive = useCallback(async (notificationId: string, currentArchive: boolean) => {
    const actionKey = `archive-${notificationId}`;
    if (loadingActions.has(actionKey)) return;
    
    setLoadingActions(prev => new Set(prev).add(actionKey));
    
    try {
      await toggleArchive(notificationId, currentArchive);
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }
  }, [toggleArchive, loadingActions]);

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
          <div className="flex items-center justify-end">
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
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedFilter === "all" ? "default" : "outline"}
              size="sm"
              className="h-8 px-3 text-xs font-medium gap-0"
              onClick={() => setSelectedFilter("all")}
            >
              All
            </Button>
            <Button
              variant={selectedFilter === "unread" ? "default" : "outline"}
              size="sm"
              className="h-8 px-3 text-xs font-medium gap-0"
              onClick={() => setSelectedFilter("unread")}
            >
              <MailOpen className="h-3.5 w-3.5 mr-1.5" />
              Unread
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-background/50">
                {filterCounts.unread}
              </Badge>
            </Button>
            <Button
              variant={selectedFilter === "read" ? "default" : "outline"}
              size="sm"
              className="h-8 px-3 text-xs font-medium gap-0"
              onClick={() => setSelectedFilter("read")}
            >
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Read
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-background/50">
                {filterCounts.read}
              </Badge>
            </Button>
            <Button
              variant={selectedFilter === "favorite" ? "default" : "outline"}
              size="sm"
              className="h-8 px-3 text-xs font-medium gap-0"
              onClick={() => setSelectedFilter("favorite")}
            >
              <Star className="h-3.5 w-3.5 mr-1.5" />
              Favorite
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-background/50">
                {filterCounts.favorite}
              </Badge>
            </Button>
            <Button
              variant={selectedFilter === "archived" ? "default" : "outline"}
              size="sm"
              className="h-8 px-3 text-xs font-medium gap-0"
              onClick={() => setSelectedFilter("archived")}
            >
              <Archive className="h-3.5 w-3.5 mr-1.5" />
              Archived
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-background/50">
                {filterCounts.archived}
              </Badge>
            </Button>
          </div>

          {/* Notifications List */}
          <div className="space-y-3">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {filteredNotifications.map((notification: Notification) => (
                  <Card
                    key={notification.id}
                    className={`group hover:shadow-md transition-all duration-200 border-0 shadow-sm ${
                      !notification.read_status && notification.archive_status === false ? "bg-primary/5" : ""
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Avatar or Icon */}
                        <div className="flex-shrink-0">
                          {notification.user_name ? (
                            <Avatar className="h-10 w-10">
                              <AvatarImage src="/placeholder.svg" alt={notification.user_name} />
                              <AvatarFallback>
                                {notification.user_name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              {getNotificationIcon("alert")}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-medium text-sm">{notification.user_name || "System"}</p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleToggleFavorite(notification.id, notification.favorite || false)}
                                disabled={loadingActions.has(`favorite-${notification.id}`)}
                              >
                                {loadingActions.has(`favorite-${notification.id}`) ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                ) : (
                                  <Star
                                    className={`h-4 w-4 ${
                                      notification.favorite
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-muted-foreground"
                                    }`}
                                  />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleToggleArchive(notification.id, notification.archive_status || false)}
                                disabled={loadingActions.has(`archive-${notification.id}`)}
                              >
                                {loadingActions.has(`archive-${notification.id}`) ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                ) : (
                                  <Archive
                                    className={`h-4 w-4 ${
                                      notification.archive_status ? "text-primary" : "text-muted-foreground"
                                    }`}
                                  />
                                )}
                              </Button>
                              {notification.ref_chat_url && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleOpenChat(notification)}
                                  disabled={loadingActions.has(`open-${notification.id}`)}
                                >
                                  {loadingActions.has(`open-${notification.id}`) ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  ) : (
                                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </Button>
                              )}
                              {!notification.read_status && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  disabled={loadingActions.has(`read-${notification.id}`)}
                                >
                                  {loadingActions.has(`read-${notification.id}`) ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  ) : (
                                    <MailOpen className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-foreground/80 mb-2">
                            {notification.content || "No message content"}
                          </p>
                          {notification.ref_chat_url && (
                            <div className="mb-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground truncate">
                              {typeof window !== "undefined" && extractPathFromUrl(notification.ref_chat_url)}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">
                              {formatDate(notification.createdAt)}
                            </p>
                            {!notification.read_status && notification.archive_status === false && (
                              <Badge variant="secondary" className="h-5 px-2 text-xs">
                                New
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {loadingMore && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </>
            )}

            {filteredNotifications.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No notifications found</h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search terms"
                    : selectedFilter === "archived"
                      ? "No archived notifications"
                      : "You're all caught up!"}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

