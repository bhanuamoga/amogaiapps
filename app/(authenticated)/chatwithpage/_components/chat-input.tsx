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
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";

type ChatInputProps = {
  chatUuid: string;
};

export default function ChatInput({ chatUuid }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [aiApis, setAiApis] = useState<{ model: string }[]>([]);
  const [apis, setApis] = useState<{ site_url: string }[]>([]);
  const { transcript, listening, resetTranscript } = useSpeechRecognition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load available AI models and APIs
  useEffect(() => {
    fetch("/api/chatwithpage/aiapis")
      .then((res) => res.json())
      .then((data) => setAiApis(data || []))
      .catch(() => setAiApis([]));

    fetch("/api/chatwithpage/apis")
      .then((res) => res.json())
      .then((data) => setApis(data || []))
      .catch(() => setApis([]));
  }, []);

  // Update text when voice recognition is used
  useEffect(() => {
    if (transcript) setValue(transcript);
  }, [transcript]);

  // Voice toggle button
  const handleVoiceToggle = () => {
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      SpeechRecognition.startListening({ continuous: true, language: "en-US" });
    }
  };

  // Handle sending
  const handleSend = () => {
    if (!value.trim()) return;
    console.log("Send:", value);
    setValue("");
    resetTranscript();
  };

  // Auto-expand logic
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 96); // max 2 lines
      textarea.style.height = `${newHeight}px`;
      if (textarea.scrollHeight > 96) {
        textarea.scrollTop = textarea.scrollHeight; // keep bottom visible
      }
    }
  }, [value]);

  return (
    <div className="w-full sticky bottom-0 z-40  py-6">
      <div className="mx-auto w-full max-w-2xl">
        <div
          className={cn(
            "rounded-2xl border shadow-sm p-3 sm:p-4 flex flex-col gap-3 sm:gap-4",
            "bg-background"
          )}
        >
          {/* Textarea styled like Input */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask a follow-up"
            rows={1}
            className={cn(
              "flex w-full rounded-md border border-input bg-background px-3 py-3 text-base leading-relaxed",
              "placeholder:text-muted-foreground",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "resize-none overflow-y-auto sm:text-base text-sm",
              "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-thumb-rounded-md"
            )}
            style={{
              minHeight: "48px",
              maxHeight: "96px",
            }}
          />

          {/* Action Row */}
          <div className="flex items-center justify-between gap-3">
            {/* Left Section */}
            <div className="flex items-center gap-2">
              {/* Model Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-lg"
                  >
                    <SlidersHorizontal className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                >
                  <DropdownMenuLabel>Select AI Model</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {aiApis.length > 0 ? (
                    aiApis.map(({ model }, idx) => (
                      <DropdownMenuItem key={idx} className="truncate">
                        {model}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>No models found</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* API Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 px-3 rounded-lg flex items-center gap-2"
                  >
                    <Wrench className="w-5 h-5" />
                    <span className="hidden sm:inline text-sm">API</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                >
                  <DropdownMenuLabel>Select API</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {apis.length > 0 ? (
                    apis.map(({ site_url }, idx) => (
                      <DropdownMenuItem key={idx} className="truncate">
                        {site_url}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>No APIs available</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={handleVoiceToggle}
                aria-label="Voice input"
                className="rounded-lg h-9 w-9"
              >
                {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>

              <Button
                size="icon"
                variant="default"
                onClick={handleSend}
                disabled={!value.trim()}
                aria-label="Send message"
                className="rounded-lg h-9 w-9 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUp className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
