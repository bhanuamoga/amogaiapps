"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThreadProvider } from "@/context/langchin-agent/ThreadContext";
import { UISettingsProvider } from "@/context/langchin-agent/UISettingsContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
    },
  },
});

export default function WooLangchinAgentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <QueryClientProvider client={queryClient}>
      <UISettingsProvider>
        <ThreadProvider>{children}</ThreadProvider>
      </UISettingsProvider>
    </QueryClientProvider>
  );
}
