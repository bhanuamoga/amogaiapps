"use client";
import React from "react";
import ChatHeader from "@/app/(authenticated)/chatwithpage/_components/chat-header";
import ChatBody from "@/app/(authenticated)/chatwithpage/_components/chat-body";
import ChatInput from "@/app/(authenticated)/chatwithpage/_components/chat-input";

// Next.js 13.4+ with React use()
export default function ChatPage({ params }: { params: Promise<{ chatUuid: string }> }) {
  const { chatUuid } = React.use(params);

  return (
    <main className="flex justify-center items-start min-h-screen ">
      <div className="w-full max-w-[800px] my-1">
        <ChatHeader chatUuid={chatUuid} />
        <ChatBody chatUuid={chatUuid} />
        <ChatInput chatUuid={chatUuid} />
      </div>
    </main>
  );
}
