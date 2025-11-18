"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { useTokenUsageLogs } from "@/hooks/langchin-agent/useTokenUsageLogs";
import type { TokenUsageLogEntry } from "@/app/(authenticated)/api/woo-langchin-agent/token-usage-logs/route";

const formatNumber = (num: number | null | undefined) => (num?.toLocaleString('en-US') || '0');
const formatCurrency = (num: number | null | undefined) => {
  if (num === null || num === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(num);
};
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const getSourceBadgeVariant = (source: string | null | undefined) => {
  if (!source) return "secondary";
  const normalizedSource = source.toLowerCase();
  if (normalizedSource === "llm") return "default";
  if (normalizedSource === "suggestions") return "outline";
  return "secondary";
};

const getSourceBadgeClassName = (source: string | null | undefined) => {
  if (!source) return "bg-muted text-muted-foreground";
  const normalizedSource = source.toLowerCase();
  if (normalizedSource === "llm") return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
  if (normalizedSource === "suggestions") return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
  return "bg-muted text-muted-foreground";
};

const formatSource = (source: string | null | undefined) => {
  if (!source) return 'N/A';
  return source.charAt(0).toUpperCase() + source.slice(1).toLowerCase();
};

const DesktopHeader = () => (
  <div className="hidden md:grid md:grid-cols-[2fr_1.2fr_1fr_1fr_1fr_1fr_1.2fr] gap-4 p-4 border-b border-border bg-muted/50">
    <div className="font-semibold text-muted-foreground text-sm">Date & Time</div>
    <div className="font-semibold text-muted-foreground text-sm">Model Name</div>
    <div className="font-semibold text-muted-foreground text-sm">Source</div>
    <div className="text-right font-semibold text-muted-foreground text-sm">Prompt</div>
    <div className="text-right font-semibold text-muted-foreground text-sm">Completion</div>
    <div className="text-right font-semibold text-muted-foreground text-sm">Total</div>
    <div className="text-right font-semibold text-muted-foreground text-sm">Cost</div>
  </div>
);

const DesktopRow = ({ item }: { item: TokenUsageLogEntry }) => (
  <div className="hidden md:grid md:grid-cols-[2fr_1.2fr_1fr_1fr_1fr_1fr_1.2fr] gap-4 items-center p-4 border-b border-border hover:bg-muted/30 transition-colors">
    <div className="text-sm text-muted-foreground truncate">{formatDate(item.createdAt)}</div>
    <div className="flex items-center">
      <Badge variant="secondary" className="bg-primary/10 text-primary text-xs font-semibold whitespace-nowrap">
        {item.model_name || 'N/A'}
      </Badge>
    </div>
    <div className="flex items-center">
      <Badge variant={getSourceBadgeVariant(item.source)} className={`${getSourceBadgeClassName(item.source)} text-xs font-semibold whitespace-nowrap`}>
        {formatSource(item.source)}
      </Badge>
    </div>
    <div className="text-right text-sm text-foreground font-mono">{formatNumber(item.prompt_tokens)}</div>
    <div className="text-right text-sm text-foreground font-mono">{formatNumber(item.completion_tokens)}</div>
    <div className="text-right text-sm font-bold text-foreground font-mono">{formatNumber(item.total_tokens)}</div>
    <div className="text-right text-sm font-semibold text-foreground">{formatCurrency(item.cost)}</div>
  </div>
);

const MobileCard = ({ item }: { item: TokenUsageLogEntry }) => (
  <Card className="md:hidden border-border hover:shadow-md transition-shadow">
    <CardContent className="p-4">
      <div className="flex flex-row justify-between items-center mb-3">
        <div className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</div>
        <div className="flex items-center gap-2">
          <Badge variant={getSourceBadgeVariant(item.source)} className={`${getSourceBadgeClassName(item.source)} text-xs font-semibold`}>
            {formatSource(item.source)}
          </Badge>
          <Badge variant="secondary" className="bg-primary/10 text-primary text-xs font-semibold">
            {item.model_name || 'N/A'}
          </Badge>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 border-t border-border/50 pt-3">
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">Prompt</div>
          <div className="text-base font-semibold text-foreground font-mono">{formatNumber(item.prompt_tokens)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">Completion</div>
          <div className="text-base font-semibold text-foreground font-mono">{formatNumber(item.completion_tokens)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">Total</div>
          <div className="text-base font-bold text-primary font-mono">{formatNumber(item.total_tokens)}</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex justify-between items-center">
          <div className="text-xs text-muted-foreground">Cost</div>
          <div className="text-sm font-semibold text-foreground">{formatCurrency(item.cost)}</div>
        </div>
      </div>
    </CardContent>
  </Card>
);

export function TokenUsageClient() {
  const router = useRouter();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const {
    logs,
    isLoading,
    loadMoreTokenUsageLogs,
    hasNextPage,
  } = useTokenUsageLogs();

  // Find the scrollable container
  const findScrollContainer = (element: HTMLElement | null): Element | null => {
    if (!element) return null;
    
    let parent: HTMLElement | null = element.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      const overflowY = style.overflowY || style.overflow;
      const hasScroll = 
        parent.scrollHeight > parent.clientHeight &&
        (overflowY === 'auto' || overflowY === 'scroll');
      
      if (hasScroll && parent !== document.body) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  };

  // Set up Intersection Observer
  useEffect(() => {
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    // Don't set up observer if loading or no logs yet
    if (isLoading || logs.length === 0) {
      return;
    }

    // Wait for the sentinel element to be rendered
    const setupObserver = () => {
      const sentinel = loadMoreRef.current;
      if (!sentinel) {
        // Retry after a short delay if element isn't ready
        setTimeout(setupObserver, 100);
        return;
      }

      // Find scroll container or use null for viewport
      const scrollContainer = findScrollContainer(sentinel);

      // Shared loading flag for both observer and initial check
      let isCurrentlyLoading = false;

      const loadMore = () => {
        if (isCurrentlyLoading || !hasNextPage) return;
        isCurrentlyLoading = true;
        setLoadingMore(true);
        loadMoreTokenUsageLogs()
          .finally(() => {
            setLoadingMore(false);
            isCurrentlyLoading = false;
          });
      };

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          // When the sentinel element is visible (user scrolled near bottom)
          if (entry.isIntersecting) {
            loadMore();
          }
        },
        {
          // Use scroll container as root if found, otherwise use viewport
          root: scrollContainer,
          // Trigger when the element is 100px away from viewport (smaller for mobile)
          rootMargin: '100px',
          threshold: 0.01, // Lower threshold for better mobile detection
        }
      );

      observer.observe(sentinel);
      observerRef.current = observer;

      // Check if we're already at the bottom (e.g., after navigation)
      // This handles the case where user navigates back and page is already scrolled
      const checkInitialPosition = () => {
        const scrollTop = scrollContainer 
          ? (scrollContainer as HTMLElement).scrollTop 
          : window.pageYOffset || document.documentElement.scrollTop;
        const clientHeight = scrollContainer 
          ? (scrollContainer as HTMLElement).clientHeight 
          : window.innerHeight || document.documentElement.clientHeight;
        const scrollHeight = scrollContainer 
          ? (scrollContainer as HTMLElement).scrollHeight 
          : document.documentElement.scrollHeight;
        
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 150;
        
        if (isAtBottom) {
          loadMore();
        }
      };

      // Check after a brief delay to ensure layout is complete
      setTimeout(checkInitialPosition, 200);
    };

    // Set up observer after a small delay to ensure DOM is ready
    const timeoutId = setTimeout(setupObserver, 50);

    return () => {
      clearTimeout(timeoutId);
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [logs.length, hasNextPage, isLoading, loadMoreTokenUsageLogs]);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="mx-auto px-3 sm:px-4 py-3 max-w-full sm:max-w-[800px]">
          <div className="flex items-center justify-between">
            {/* <h1 className="text-xl font-bold text-foreground">Token Usage Logs</h1> */}
            <div></div>
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
              <X className="h-4 w-4" />
              <span>Close</span>
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-full sm:max-w-[800px]">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">Detailed breakdown of your AI API usage</p>
        </div>

        <div className="border-0 bg-transparent md:border border-border rounded-lg overflow-hidden md:bg-card">
          {isLoading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <DesktopHeader />
              <div>
                {logs.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No usage data found.</p>
                  </div>
                ) : (
                  <>
                    {logs.map((item) => (
                      <div key={item.id} className="space-y-2 md:space-y-0">
                        <DesktopRow item={item} />
                        <MobileCard item={item} />
                      </div>
                    ))}
                  </>
                )}
              </div>
              {/* Sentinel element for intersection observer - always render when there are logs */}
              {logs.length > 0 && (
                <div 
                  ref={loadMoreRef} 
                  className="h-10 w-full flex items-center justify-center"
                  aria-hidden="true"
                >
                  {loadingMore && (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

