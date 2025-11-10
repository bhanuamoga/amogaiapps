import React from "react";
import ChatHeader from "@/app/(authenticated)/chatwithpage/_components/chat-header";
import ChatBody from "@/app/(authenticated)/chatwithpage/_components/chat-body";
import ChatInput from "@/app/(authenticated)/chatwithpage/_components/chat-input";

type PageProps = {
  params: Promise<{ chatUuid: string }>;
};

export default function ChatPage({ params }: PageProps) {
  const { chatUuid } = React.use(params);

  return (
   <main className="flex flex-col min-h-screen ">
  <div className="flex-1 w-full max-w-[800px] mx-auto px-4">
    <ChatHeader chatUuid={chatUuid} />
    <ChatBody chatUuid={chatUuid} />
  </div>
  <ChatInput chatUuid={chatUuid} />
</main>

  );
}
