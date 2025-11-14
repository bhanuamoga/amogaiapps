"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import ChatHeader from "@/app/(authenticated)/chatwithpage/_components/chat-header";
import ChatBody from "@/app/(authenticated)/chatwithpage/_components/chat-body";
import ChatInput from "@/app/(authenticated)/chatwithpage/_components/chat-input";

// ✅ Unified Message type (text, chart, table)
type Message = {
  role: "user" | "assistant";
  content:
    | string
    | {
        type: "chart" | "table";
        data: any;
      };
};

export default function ChatPage() {
  const params = useParams();
  const chatUuid = params.chatUuid as string;

  // ✅ Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ Append new messages (handles both streaming text + visuals)
  const handleNewMessage = (
    role: "user" | "assistant",
    content: string | { type: "chart" | "table"; data: any }
  ) => {
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];

      // 🧠 If assistant message is streaming (updating existing text)
      if (
        role === "assistant" &&
        typeof content === "string" &&
        lastMsg?.role === "assistant" &&
        typeof lastMsg.content === "string"
      ) {
        const updated = [...prev];
        updated[updated.length - 1].content = content;
        return updated;
      }

      // 🧩 Otherwise, append new message (either user text or visualization)
      return [...prev, { role, content }];
    });
  };

  return (
    <main className="flex flex-col min-h-screen bg-background">
      <div className="flex-1 w-full max-w-[800px] mx-auto">
        <ChatHeader chatUuid={chatUuid} />

        {/* ✅ ChatBody now supports text, chart, and table */}
        <ChatBody
          chatUuid={chatUuid}
          messages={messages}
          isLoading={isLoading}
        />
      </div>

      {/* ✅ ChatInput handles streaming + voice input + model selection */}
      <ChatInput
        chatUuid={chatUuid}
        onNewMessage={handleNewMessage}
        setIsLoading={setIsLoading}
      />
    </main>
  );
}
