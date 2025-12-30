"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowUp,
  SlidersHorizontal,
  Database,
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
import { ca } from "date-fns/locale";
import { Card } from "@/components/ui/card";

type AIModel = { model: string };
type APIEntry = { db_name: string };


type ChatInputProps = {
  chatUuid: string;
  onNewMessage?: (role: "user" | "assistant", content: any) => void;
  setIsLoading?: React.Dispatch<React.SetStateAction<boolean>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  onSetInput?: (setter: (text: string) => void) => void;

};

export default function ChatInput({
  chatUuid,
  onNewMessage,
  setIsLoading,
  setErrorMessage,
   onSetInput,
}: ChatInputProps) {
  const [aiApis, setAiApis] = useState<AIModel[]>([]);
  const [apis, setApis] = useState<APIEntry[]>([]);
  const [selectedModelIdx, setSelectedModelIdx] = useState(0);
  const [selectedApiIdx, setSelectedApiIdx] = useState(0);

  const { transcript, listening, resetTranscript } = useSpeechRecognition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const assistantBundleRef = useRef({
    chart: null as any,
    table: null as any,
    card:null as any,
    map: null as any,
    story: null as any,
    actions: null as any,
  });

  // ❌ REMOVED - CAUSES DUPLICATE USER MESSAGES
  // saveUserMessageApi()

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
  } = useChat({
    api: "/api/chatwithDBdata",

    body: {
      chatUuid,
      chatId: chatUuid,
      settings: {
        model: aiApis[selectedModelIdx]?.model,
        db_name: apis[selectedApiIdx]?.db_name,
      },
    },
     
    onFinish: async (message: any) => {
      if (message.role === "assistant") {
        onNewMessage?.("assistant", message.content);

        assistantBundleRef.current.story = {
          type: "story",
          content:
            typeof message.content === "string"
              ? message.content
              : message.content?.text ?? "",
        };

        assistantBundleRef.current = {
          chart: null,
          table: null,
          card: null,
          map: null,
          story: null,
          actions: null,
        };
      }

      setIsLoading?.(false);
    },

    onError(err) {
      console.error("❌ Chat error:", err);
      setErrorMessage(err?.message || "Something went wrong.");
      setIsLoading?.(false);
    },

   onToolCall: async (event: any) => {
  const { toolName, args } = event.toolCall;

  if (toolName === "createChart") {
    onNewMessage?.("assistant", {
      type: "chart",
      data: args,
    });
  }

  if (toolName === "createTable") {
    onNewMessage?.("assistant", {
      type: "table",
      data: args,
    });
  }

  if (toolName === "createCard") {
    onNewMessage?.("assistant", {
      type: "card",
      data: args,
    });
  }

  if (toolName === "createMap") {
    onNewMessage?.("assistant", {
      type: "map",
      data: {
        title: args.title,
        points: args.points,
      },
    });
  }

  // ✅ THIS IS WHAT YOU KEEP BREAKING
  if (toolName === "suggestActions") {
    onNewMessage?.("assistant", {
      type: "actions",
      data: args.actions,
    });
  }
}
  });
// ✅ expose input setter to parent (ONCE)
useEffect(() => {
  if (!onSetInput) return;

  onSetInput((text: string) => {
    handleInputChange({ target: { value: text } } as any);
  });
}, [onSetInput, handleInputChange]);

  // mic input support
  useEffect(() => {
    
    if (transcript) {
      handleInputChange({ target: { value: transcript } } as any);
    }
  }, [transcript]);

  // load model/API options
  useEffect(() => {
    fetch("/api/chatwithDBdata/aiapis")
      .then((res) => res.json())
      .then((data) => setAiApis(Array.isArray(data) ? data : []));

    fetch("/api/chatwithDBdata/apis")
      .then((res) => res.json())
      
 .then((data) => {
      console.log("🔥 APIs response:", data);
      setApis(Array.isArray(data) ? data : []);
    });      
  }, []);

  // ✔ FIXED sendMessage (NO DB INSERT HERE)
  const sendMessage = async () => {
    if (!input.trim()) return;

    setIsLoading?.(true);
    resetTranscript();

    // UI update
    onNewMessage?.("user", input);

    try {
      handleSubmit(undefined, {
        body: {
          chatUuid,
          chatId: chatUuid,
          promptUuid: null,
          settings: {
            model: aiApis[selectedModelIdx]?.model,
            db_name: apis[selectedApiIdx]?.db_name,
          },
        },
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  // auto-grow textarea
  useEffect(() => {
    const tx = textareaRef.current;
    if (!tx) return;
    tx.style.height = "auto";
    tx.style.height = `${Math.min(tx.scrollHeight, 96)}px`;
  }, [input]);

  return (
    <div className="w-full sticky bottom-0 z-40 py-1">
      <div className="mx-auto w-full max-w-[800px]">
        <div
          className={cn(
            "rounded-xl border shadow-sm p-3 sm:p-4 flex flex-col gap-3 sm:gap-4",
            "bg-background"
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInputChange(e)}
            placeholder="Ask a follow-up"
            className="flex w-full rounded-sm border border-input bg-background px-3 py-3 text-base leading-relaxed resize-none overflow-y-auto"
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
                    <Database className="w-5 h-5" /> DB
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Select DB</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {apis.map((a, i) => (
                    <DropdownMenuItem key={i} onClick={() => setSelectedApiIdx(i)}>
                      {a.db_name}
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
