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

  // temp holder for assistant combined response
  const assistantBundleRef = useRef({
    chart: null as any,
    table: null as any,
    story: null as any,
  });

  // Save user message to DB
  const saveUserMessageApi = async (chatId: string, content: string) => {
    try {
      const res = await fetch("/api/chatwithpage/messages/saveUserMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, content }),
      });
      return await res.json();
    } catch (err) {
      console.error("saveUserMessageApi error:", err);
      return null;
    }
  };

  // Save assistant message bundle
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
      return await res.json();
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

    // FIX: No "messages" here
    body: {
      chatUuid, // required for token tracking
      chatId: chatUuid,
      settings: {
        model: aiApis[selectedModelIdx]?.model,
        site_url: apis[selectedApiIdx]?.site_url,
      },
    },

    onFinish: async (message: any) => {
      if (message.role === "assistant") {
        onNewMessage?.("assistant", message.content);

        const promptUuid =
          message.promptUuid ??
          message.prompt_uuid ??
          lastPromptUuidRef.current;

        assistantBundleRef.current.story = {
          type: "story",
          content:
            typeof message.content === "string"
              ? message.content
              : message.content?.text ?? "",
        };

        await saveAssistantMessageApi(
          chatUuid,
          promptUuid,
          assistantBundleRef.current
        );

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

    onToolCall: async (event: any) => {
      const { toolName, args } = event.toolCall;

      if (toolName === "createChart") {
        const msg = { type: "chart", data: args };
        assistantBundleRef.current.chart = msg;
        onNewMessage?.("assistant", msg);
      }

      if (toolName === "createTable") {
        const msg = { type: "table", data: args };
        assistantBundleRef.current.table = msg;
        onNewMessage?.("assistant", msg);
      }
    },
  });

  // mic input support
  useEffect(() => {
    if (transcript) {
      handleInputChange({ target: { value: transcript } } as any);
    }
  }, [transcript]);

  // load AI & APIs
  useEffect(() => {
    fetch("/api/chatwithpage/aiapis")
      .then(res => res.json())
      .then(data => setAiApis(Array.isArray(data) ? data : []));

    fetch("/api/chatwithpage/apis")
      .then(res => res.json())
      .then(data => setApis(Array.isArray(data) ? data : []));
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
          chatUuid,
          chatId: chatUuid,
          promptUuid: prompt_uuid,
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
          chatUuid,
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

  // auto grow textarea
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
            <div className="flex items-center gap-2">
              {/* Model Selector */}
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

              {/* API Selector */}
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
                className="h-9 w-9 rounded-lg"
                onClick={() =>
                  listening
                    ? SpeechRecognition.stopListening()
                    : SpeechRecognition.startListening({ continuous: true })
                }
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
