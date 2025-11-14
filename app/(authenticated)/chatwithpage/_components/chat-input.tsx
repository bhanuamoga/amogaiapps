"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowUp,
  SlidersHorizontal,
  Wrench,
  Mic,
  MicOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { useChat } from "@ai-sdk/react";

// -------------------------
// Types
// -------------------------
type AIModel = { model: string };
type APIEntry = { site_url: string };

type ChatInputProps = {
  chatUuid: string;
  onNewMessage?: (role: "user" | "assistant", content: any) => void;
  setIsLoading?: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function ChatInput({
  chatUuid,
  onNewMessage,
  setIsLoading,
}: ChatInputProps) {
  const [aiApis, setAiApis] = useState<AIModel[]>([]);
  const [apis, setApis] = useState<APIEntry[]>([]);
  const [selectedModelIdx, setSelectedModelIdx] = useState(0);
  const [selectedApiIdx, setSelectedApiIdx] = useState(0);

  const { transcript, listening, resetTranscript } = useSpeechRecognition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // -------------------------
  // useChat
  // -------------------------
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
  } = useChat({
    api: "/api/chatwithpage",

    body: {
      chatId: chatUuid,
      settings: {
        model: aiApis[selectedModelIdx]?.model,
        site_url: apis[selectedApiIdx]?.site_url,
      },
    },

    // when assistant finishes response
    onFinish(message) {
      if (message.role === "assistant") {
        onNewMessage?.("assistant", message.content);
      }
      setIsLoading?.(false);
    },

    onError(err) {
      console.error("❌ Chat error:", err);
      setIsLoading?.(false);
    },

    // TOOL CALLS HERE
    onToolCall(event) {
      const { toolName, args } = event.toolCall;

      if (toolName === "createChart") {
        onNewMessage?.("assistant", { type: "chart", data: args });
      }

      if (toolName === "createTable") {
        onNewMessage?.("assistant", { type: "table", data: args });
      }
    },
  });

  // -------------------------
  // When transcript updated
  // -------------------------
  useEffect(() => {
    if (transcript) {
      handleInputChange({
        target: { value: transcript },
      } as any);
    }
  }, [transcript]);

  // -------------------------
  // Fetch AI models + APIs
  // -------------------------
  useEffect(() => {
    fetch("/api/chatwithpage/aiapis")
      .then((res) => res.json())
      .then((data) => setAiApis(Array.isArray(data) ? data : []))
      .catch(() => setAiApis([]));

    fetch("/api/chatwithpage/apis")
      .then((res) => res.json())
      .then((data) => setApis(Array.isArray(data) ? data : []))
      .catch(() => setApis([]));
  }, []);

  // -------------------------
  // Send message
  // -------------------------
  const sendMessage = () => {
    if (!input.trim()) return;

    setIsLoading?.(true);
    resetTranscript();

    onNewMessage?.("user", input);

    handleSubmit(undefined, {
      body: {
        chatId: chatUuid,
        settings: {
          model: aiApis[selectedModelIdx]?.model,
          site_url: apis[selectedApiIdx]?.site_url,
        },
      },
    });
  };

  // -------------------------
  // Textarea auto-height
  // -------------------------
  useEffect(() => {
    const tx = textareaRef.current;
    if (!tx) return;

    tx.style.height = "auto";
    tx.style.height = `${Math.min(tx.scrollHeight, 96)}px`;
  }, [input]);

  return (
    <div className="w-full sticky bottom-0 z-40 py-6">
      <div className="mx-auto w-full max-w-2xl">
        <div
          className={cn(
            "rounded-2xl border shadow-sm p-3 sm:p-4 flex flex-col gap-3 sm:gap-4",
            "bg-background"
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInputChange(e)}
            placeholder="Ask a follow-up"
            className="flex w-full rounded-md border border-input bg-background px-3 py-3 text-base leading-relaxed resize-none overflow-y-auto"
            style={{ maxHeight: 96 }}
          />

          <div className="flex items-center justify-between gap-3">
            {/* Model & API Dropdowns */}
            <div className="flex items-center gap-2">
              {/* Model */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg">
                    <SlidersHorizontal className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Select Model</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {aiApis.map((m, i) => (
                    <DropdownMenuItem key={i} onClick={() => setSelectedModelIdx(i)}>
                      {m.model}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* API */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 px-3 rounded-lg flex items-center gap-2"
                  >
                    <Wrench className="w-5 h-5" /> API
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Select API</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {apis.map((a, i) => (
                    <DropdownMenuItem key={i} onClick={() => setSelectedApiIdx(i)}>
                      {a.site_url}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Voice + Send */}
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() =>
                  listening
                    ? SpeechRecognition.stopListening()
                    : SpeechRecognition.startListening({ continuous: true })
                }
                className="h-9 w-9 rounded-lg"
              >
                {listening ? <MicOff /> : <Mic />}
              </Button>

              <Button
                size="icon"
                variant="default"
                disabled={!input.trim() || isLoading}
                onClick={sendMessage}
                className="h-9 w-9 rounded-lg"
              >
                <ArrowUp />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
