"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowUp,
  SlidersHorizontal,
  Wrench,
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

type ChatInputProps = {
  chatUuid: string;
};

export default function ChatInput({ chatUuid }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [aiApis, setAiApis] = useState<{ model: string }[]>([]);
  const [apis, setApis] = useState<{ site_url: string }[]>([]);

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

  return (
    <div
      className={cn(
         "w-full px-4 py-4",
        "sticky bottom-0  z-40"
      )}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-2xl rounded-2xl border shadow-sm bg-background p-2"
        )}
      >
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                <SlidersHorizontal className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Select AI Model</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {aiApis.map(({ model }, idx) => (
                <DropdownMenuItem key={idx}>{model}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 px-3 rounded-full flex items-center space-x-2"
              >
                <Wrench className="w-5 h-5" />
                <span className="hidden sm:inline">API</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Select API</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {apis.map(({ site_url }, idx) => (
                <DropdownMenuItem key={idx}>{site_url}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Input
            className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
            placeholder="Ask a follow-up..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />

          <Button
            size="icon"
            disabled={!value.trim()}
            aria-label="Send message"
            className="rounded-full bg-black text-white hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowUp className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
