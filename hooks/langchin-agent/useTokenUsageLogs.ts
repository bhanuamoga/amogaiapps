import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import type { TokenUsageLogEntry } from "@/app/(authenticated)/api/woo-langchin-agent/token-usage-logs/route";

const LOGS_PER_PAGE = 20;

export interface UseTokenUsageLogsReturn {
  logs: TokenUsageLogEntry[];
  isLoading: boolean;
  error: Error | null;
  refetchLogs: () => Promise<unknown>;
  loadMoreTokenUsageLogs: () => Promise<void>;
  hasNextPage: boolean;
}

async function fetchTokenUsageLogs(
  page: number,
  limit: number = LOGS_PER_PAGE
): Promise<TokenUsageLogEntry[]> {
  const response = await fetch(
    `/api/woo-langchin-agent/token-usage-logs?page=${page}&limit=${limit}`
  );
  if (!response.ok) {
    throw new Error("Failed to load token usage logs");
  }
  return await response.json();
}

export function useTokenUsageLogs(): UseTokenUsageLogsReturn {
  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery<TokenUsageLogEntry[]>({
    queryKey: ["token-usage-logs"],
    queryFn: ({ pageParam = 0 }) => fetchTokenUsageLogs(pageParam as number),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < LOGS_PER_PAGE) return undefined;
      return allPages.length;
    },
    initialPageParam: 0,
  });

  const logs = data?.pages.flat() || [];

  const loadMoreTokenUsageLogs = useCallback(async () => {
    if (hasNextPage) {
      await fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage]);

  return {
    logs,
    isLoading,
    error: error as Error | null,
    refetchLogs: refetch,
    loadMoreTokenUsageLogs,
    hasNextPage: hasNextPage ?? false,
  };
}

