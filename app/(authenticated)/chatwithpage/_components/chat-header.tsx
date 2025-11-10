"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Share2,
  Bell,
  Menu,
  X,
  Check,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { v4 as uuid } from "uuid";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type ThreadHeaderStickyProps = {
  chatUuid: string;
};

export default function ThreadHeaderSticky({ chatUuid }: ThreadHeaderStickyProps) {
  const [title, setTitle] = useState("Analytic Assistant");
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [copied, setCopied] = useState(false); // ✅ Track copy state
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  /* ---------------------- FETCH EXISTING TITLE ---------------------- */
  useEffect(() => {
    async function loadChatTitle() {
      try {
        const res = await fetch(`/api/chatwithpage/title?chatId=${chatUuid}`);
        const data = res.ok ? await res.json() : null;

        if (data?.title) {
          setTitle(data.title);
          setEditValue(data.title);
        } else {
          const defaultTitle = "Analytic Assistant";
          setTitle(defaultTitle);
          setEditValue(defaultTitle);

          await fetch("/api/chatwithpage/title", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId: chatUuid, title: defaultTitle }),
          });
        }
      } catch (err) {
        console.warn("Chat not found, creating new one:", err);
        const defaultTitle = "Analytic Assistant";
        setTitle(defaultTitle);
        setEditValue(defaultTitle);

        await fetch("/api/chatwithpage/title", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: chatUuid, title: defaultTitle }),
        });
      }
    }

    if (chatUuid) loadChatTitle();
  }, [chatUuid]);

  /* ---------------------- SAVE (UPDATE) CHAT TITLE ---------------------- */
  async function saveChatTitle(newTitle: string) {
    try {
      const res = await fetch("/api/chatwithpage/title", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatUuid, title: newTitle }),
      });

      if (res.ok) {
        toast.success("Title updated successfully 🎉");
      } else {
        toast.error("Failed to update title. Please try again.");
      }
    } catch (err) {
      console.error("Failed to save chat title:", err);
      toast.error("Error updating title. Please check your connection.");
    }
  }

  /* ---------------------- EDIT TITLE HANDLERS ---------------------- */
  function startEdit() {
    setEditValue(title);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  async function saveEdit() {
    const newTitle = editValue.trim() || "Untitled";
    setTitle(newTitle);
    setEditing(false);
    await saveChatTitle(newTitle);
  }

  function cancelEdit() {
    setEditValue(title);
    setEditing(false);
  }

  /* ---------------------- COPY LINK HANDLER ---------------------- */
  async function handleCopy() {
    try {
      const currentUrl = window.location.href;
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      toast.success("Link copied to clipboard! 📋");

      setTimeout(() => setCopied(false), 2000); // revert icon after 2s
    } catch (err) {
      console.error("Failed to copy link:", err);
      toast.error("Failed to copy link. Please try again.");
    }
  }

  /* ---------------------- CREATE NEW CHAT ---------------------- */
  function handleNewChat() {
    const newId = uuid();
    router.push(`/chatwithpage/${newId}`);
  }

  /* ---------------------- RENDER ---------------------- */
  return (
    <header
      className={cn(
        "sticky top-0 z-30 w-full",
        "mx-auto max-w-[800px] flex justify-between items-center px-3 py-3",
        "backdrop-blur-md"
      )}
      style={{
        transform: "translateZ(0)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-center min-h-[36px] flex-1">
        {!editing ? (
          <span
            className="font-medium text-[17px] text-foreground px-1 cursor-pointer flex items-center gap-1 group select-none truncate"
            onClick={startEdit}
            tabIndex={0}
            title="Edit title"
            onKeyDown={(e) =>
              (e.key === "Enter" || e.key === " ") && startEdit()
            }
          >
            {title}
            <Pencil className="w-4 h-4 opacity-0 group-hover:opacity-80 text-muted-foreground transition" />
          </span>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              className="font-medium text-[17px] outline-none border-b-2 border-black bg-transparent px-2 min-w-0 flex-1 rounded transition-all duration-150"
              autoFocus
              style={{ width: "100%" }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={saveEdit}
              aria-label="Save"
              className="h-8 w-8 text-green-600 flex-shrink-0"
            >
              <Check className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={cancelEdit}
              aria-label="Cancel"
              className="h-8 w-8 ml-0 text-muted-foreground flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 pl-2">
        {/* ✅ Copy button with tick animation */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleCopy}
          aria-label="Copy link"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600 transition-transform duration-300 scale-110" />
          ) : (
            <Copy className="w-4 h-4 transition-transform duration-300" />
          )}
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Share2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Menu className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleNewChat}>New</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Prompt History</DropdownMenuItem>
            <DropdownMenuItem>Chat History</DropdownMenuItem>
            <DropdownMenuItem>Woo Prompt List</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
