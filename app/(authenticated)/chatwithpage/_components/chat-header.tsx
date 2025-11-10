"use client";

import { useState, useRef } from "react";
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
type ThreadHeaderStickyProps = {
  chatUuid: string;
};

export default function ThreadHeaderSticky({ chatUuid }: ThreadHeaderStickyProps) {
  const [title, setTitle] = useState("Analytic Assistant");
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
 const router = useRouter();
  function startEdit() {
    setEditValue(title);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 80);
  }
  function saveEdit() {
    setTitle(editValue.trim() || "Untitled");
    setEditing(false);
  }
  function cancelEdit() {
    setEditValue(title);
    setEditing(false);
  }
  function handleNewChat() {
    const newId = uuid();
    router.push(`/chatwithpage/${newId}`);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-30  w-full",
        "mx-auto max-w-[800px] flex justify-between items-center px-3 py-3", // px-3 for small screens
        "will-change-transform",
          " backdrop-blur-md will-change-transform"
      )}
      style={{
        transform: "translateZ(0)",
       
    WebkitBackdropFilter: "blur(8px)", // For Safari compatibility
  
      }}
    >
      <div className="flex items-center min-h-[36px] flex-1">
        {!editing ? (
          <span
            className="font-medium text-[17px] text-foreground px-1 cursor-pointer flex items-center gap-1 group select-none truncate"
            onClick={startEdit}
            tabIndex={0}
            title="Edit title"
            onKeyDown={e =>
              (e.key === "Enter" || e.key === " ") && startEdit()
            }
            style={{ maxWidth: "100%" }}
          >
            {title}
            <Pencil className="w-4 h-4 opacity-0 group-hover:opacity-80 text-muted-foreground transition" />
          </span>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              className="font-medium text-[17px] outline-none border-b-2 border-black bg-transparent px-2 min-w-0 flex-1 rounded transition-all duration-150"
              autoFocus
              style={{ width: "100%" }} // ensures input fully fills row on mobile
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
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Copy className="w-4 h-4" />
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
