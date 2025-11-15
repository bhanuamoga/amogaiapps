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

  const lastPromptUuidRef = useRef<string | null>(null);

  // store chart + table + story temporarily
  const assistantBundleRef = useRef({
    chart: null as any,
    table: null as any,
    story: null as any,
  });

  // save user message
  const saveUserMessageApi = async (chatId: string, content: string) => {
    try {
      const res = await fetch("/api/chatwithpage/messages/saveUserMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, content }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    } catch (err) {
      console.error("saveUserMessageApi error:", err);
      return null;
    }
  };

  // save assistant message
  const saveAssistantMessageApi = async (
    chatId: string,
    prompt_uuid: string | null,
    response_json: any
  ) => {
    try {
      const res = await fetch(
        "/api/chatwithpage/messages/saveAssistantMessage",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId,
            prompt_uuid,
            ref_prompt_uuid: prompt_uuid,
            response_json,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    } catch (err) {
      console.error("saveAssistantMessageApi error:", err);
      return null;
    }
  };

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

    // when assistant completes
    onFinish: async (message: any) => {
      if (message.role === "assistant") {
        onNewMessage?.("assistant", message.content);

        const promptUuidFromMessage =
          message.promptUuid ??
          message.prompt_uuid ??
          null;

        const promptUuid =
          promptUuidFromMessage ?? lastPromptUuidRef.current;

        // ✅ FIX: store ONLY clean assistant text
        assistantBundleRef.current.story = {
          type: "story",
          content:
            typeof message.content === "string"
              ? message.content
              : message.content?.text ?? "",
        };

        // save final bundle (chart, table, story)
        try {
          await saveAssistantMessageApi(
            chatUuid,
            promptUuid,
            assistantBundleRef.current
          );
        } catch (err) {
          console.error("Failed to save assistant message:", err);
        }

        // reset for next response set
        assistantBundleRef.current = {
          chart: null,
          table: null,
          story: null,
        };
      }

      setIsLoading?.(false);
    },

    onError(err) {
      console.error("❌ Chat error:", err);
      setIsLoading?.(false);
    },

    // tool calls
    onToolCall: async (event: any) => {
      const { toolName, args } = event.toolCall;

      if (toolName === "createChart") {
        const chartMsg = { type: "chart", data: args };
        onNewMessage?.("assistant", chartMsg);
        assistantBundleRef.current.chart = chartMsg;
      }

      if (toolName === "createTable") {
        const tableMsg = { type: "table", data: args };
        onNewMessage?.("assistant", tableMsg);
        assistantBundleRef.current.table = tableMsg;
      }
    },
  });

  useEffect(() => {
    if (transcript) {
      handleInputChange({ target: { value: transcript } } as any);
    }
  }, [transcript]);

  useEffect(() => {
    fetch("/api/chatwithpage/aiapis")
      .then(res => res.json())
      .then(data => setAiApis(Array.isArray(data) ? data : []))
      .catch(() => setAiApis([]));

    fetch("/api/chatwithpage/apis")
      .then(res => res.json())
      .then(data => setApis(Array.isArray(data) ? data : []))
      .catch(() => setApis([]));
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;

    setIsLoading?.(true);
    resetTranscript();

    onNewMessage?.("user", input);

    try {
      const saved = await saveUserMessageApi(chatUuid, input);
      const prompt_uuid = saved?.prompt_uuid ?? null;
      if (prompt_uuid) lastPromptUuidRef.current = prompt_uuid;

      handleSubmit(undefined, {
        body: {
          chatId: chatUuid,
          promptUuid: prompt_uuid ?? null,
          settings: {
            model: aiApis[selectedModelIdx]?.model,
            site_url: apis[selectedApiIdx]?.site_url,
          },
        },
      });
    } catch (err) {
      console.error("Error saving user message:", err);

      handleSubmit(undefined, {
        body: {
          chatId: chatUuid,
          promptUuid: null,
          settings: {
            model: aiApis[selectedModelIdx]?.model,
            site_url: apis[selectedApiIdx]?.site_url,
          },
        },
      });
    }
  };

  // auto textarea height
  useEffect(() => {
    const tx = textareaRef.current;
    if (!tx) return;
    tx.style.height = "auto";
    tx.style.height = `${Math.min(tx.scrollHeight, 96)}px`;
  }, [input]);

  return (
    <div className="w-full sticky bottom-0 z-40 py-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className={cn(
          "rounded-2xl border shadow-sm p-3 sm:p-4 flex flex-col gap-3 sm:gap-4",
          "bg-background"
        )}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInputChange(e)}
            placeholder="Ask a follow-up"
            className="flex w-full rounded-md border border-input bg-background px-3 py-3 text-base leading-relaxed resize-none overflow-y-auto"
            style={{ maxHeight: 96 }}
          />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
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
