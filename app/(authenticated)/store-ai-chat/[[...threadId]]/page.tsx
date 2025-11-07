"use client";

import { Thread } from "../_components/Thread";
import { MainLayout } from "../_components/MainLayout";
import { useParams, useRouter } from "next/navigation";
import { useThreads } from "@/hooks/langchin-agent/useThreads";
import { Loader2 } from "lucide-react";
import { MessageInput } from "../_components/MessageInput";
import { useState, useMemo } from "react";
import { MessageOptions } from "@/types/langchin-agent/message";
import { ThreadHeader } from "../_components/ThreadHeader";

export default function ThreadPage() {
  const params = useParams();
  const router = useRouter();
  
  // Memoize threadId extraction to prevent unnecessary re-renders
  const threadId = useMemo(() => {
    if (params.threadId) {
      if (Array.isArray(params.threadId)) {
        return params.threadId[0];
      } else {
        return params.threadId;
      }
    }
    return undefined;
  }, [params.threadId]);
  const { isLoadingThreads, createThread } = useThreads();
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<{ message: string, opts?: MessageOptions } | null>(null);

  // Show loading while threads are being fetched
  if (isLoadingThreads) {
    return (
      <MainLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading conversation...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Case 1: No threadId - show blank chat interface
  if (!threadId) {
    const handleFirstMessage = async (message: string, opts?: MessageOptions) => {
      if (isCreatingThread) return;

      setIsCreatingThread(true);
      try {
        const thread = await createThread();
        setCreatedThreadId(thread.id);
        setPendingMessage({ message, opts });
        // Update the URL without page reload
        // window.history.pushState({}, '', `/store-ai-chat/${thread.id}`);
        // Don't change URL here - let Thread component do it after first message streams
      } catch (error) {
        console.error('Error creating thread:', error);
        setIsCreatingThread(false);
      }
    };

    // If we just created a thread, show the Thread component
    if (createdThreadId) {
      return (
        <MainLayout>
          <Thread
            threadId={createdThreadId}
            pendingMessage={pendingMessage}
            onPendingMessageSent={() => setPendingMessage(null)}
            onFirstStreamStart={() => {
              // Update URL when first streaming message arrives using Next.js router
              // Use router.replace to avoid page rerender and preserve active streams
              console.log('[Page] Changing route to thread:', createdThreadId);
              router.replace(`/store-ai-chat/${createdThreadId}`);
            }}
            isNewThread={true}
          />
        </MainLayout>
      );
    }

    return (
      <MainLayout>
        <div className="flex flex-1 h-full items-center justify-center">
          <div className="w-full max-w-3xl px-4 h-full">
            <ThreadHeader welcome={true} />

            {/* <div className="mb-5 text-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Chat with your Agent
              </h1>
              <p className="text-muted-foreground mt-2">
                Start a new conversation by sending a message
              </p>
            </div> */}
            <MessageInput
              onSendMessage={handleFirstMessage}
              isLoading={isCreatingThread}
              welcome={true}
            />
          </div>
        </div>
      </MainLayout>
    );
  }

  // Case 2: Has threadId - show existing thread
  // Always show the Thread component - it will handle loading and validation
  return (
    <MainLayout>
      <Thread threadId={threadId} />
    </MainLayout>
  );
}
