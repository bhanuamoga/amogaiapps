import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Notification } from "@/types/langchin-agent/notification";

const NOTIFICATIONS_PER_PAGE = 20;

export interface UseNotificationsReturn {
  notifications: Notification[];
  isLoading: boolean;
  error: Error | null;
  refetchNotifications: () => Promise<unknown>;
  toggleFavorite: (id: string, currentFavorite: boolean) => Promise<void>;
  toggleArchive: (id: string, currentArchive: boolean) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  loadMoreNotifications: () => Promise<void>;
}

async function fetchNotifications(
  page: number,
  limit: number = NOTIFICATIONS_PER_PAGE
): Promise<Notification[]> {
  const response = await fetch(
    `/api/woo-langchin-agent/notifications?page=${page}&limit=${limit}`
  );
  if (!response.ok) {
    throw new Error("Failed to load notifications");
  }
  return await response.json();
}

export function useNotifications(): UseNotificationsReturn {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: ({ pageParam = 0 }) => fetchNotifications(pageParam as number),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < NOTIFICATIONS_PER_PAGE) return undefined;
      return allPages.length;
    },
    initialPageParam: 0,
  });

  const notifications = data?.pages.flat() || [];

  const toggleFavorite = useCallback(async (id: string, currentFavorite: boolean) => {
    try {
      await fetch("/api/woo-langchin-agent/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, favorite: !currentFavorite }),
      });
      await refetch();
    } catch (e) {
      console.error("Failed to update favorite", e);
    }
  }, [refetch]);

  const toggleArchive = useCallback(async (id: string, currentArchive: boolean) => {
    try {
      await fetch("/api/woo-langchin-agent/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, archive_status: !currentArchive }),
      });
      await refetch();
    } catch (e) {
      console.error("Failed to update archive", e);
    }
  }, [refetch]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch("/api/woo-langchin-agent/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, read_status: true }),
      });
      await refetch();
    } catch (e) {
      console.error("Failed to mark as read", e);
    }
  }, [refetch]);

  const loadMoreNotifications = useCallback(async () => {
    if (hasNextPage) {
      await fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage]);

  return {
    notifications,
    isLoading,
    error: error as Error | null,
    refetchNotifications: refetch,
    toggleFavorite,
    toggleArchive,
    markAsRead,
    loadMoreNotifications,
  };
}

