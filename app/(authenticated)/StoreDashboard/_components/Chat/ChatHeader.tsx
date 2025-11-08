"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft, Bot, Info, Share2, Menu } from "lucide-react";
import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";
import BookmarkButton from "./sidebar/Bookmarks";

interface PageProps {
  chatId?: string;
  setOpenFavorite: (value: boolean) => void;
  setOpenMenu: (value: boolean) => void;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const ChatHeader = ({
  chatId,
  setOpenMenu,
  usage,
}: PageProps) => {
  return (
    <div className="flex items-center justify-between w-full">
      {/* Left Side */}
      <div className="flex items-center gap-4">
        <Bot className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold md:flex hidden">
          Chat with Sales Data
        </h1>
      </div>

      {/* Right Side */}
      <div className="flex gap-5 justify-end items-center">
        {/* Back */}
        <Link href="/StoreDashboard">
          <ArrowLeft className="w-5 h-5 text-muted-foreground cursor-pointer" />
        </Link>

        {/* Bookmark Button */}
        <BookmarkButton chatId={chatId} />

        {/* Info Tooltip (ℹ️ icon inside circle) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full h-8 w-8 flex items-center justify-center"
            >
              <Info className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-sm">
            <p>Prompt Tokens: {usage.promptTokens}</p>
            <p>Completion Tokens: {usage.completionTokens}</p>
            <p>Total Tokens: {usage.totalTokens}</p>
          </TooltipContent>
        </Tooltip>

        {/* Share Icon (dummy for now) */}
        <Button
          size="icon"
          variant="outline"
          className="rounded-full h-8 w-8 flex items-center justify-center"
        >
          <Share2 className="h-4 w-4" />
        </Button>

        {/* Menu Button */}
        <Menu
          onClick={() => setOpenMenu(true)}
          className="w-5 h-5 cursor-pointer text-muted-foreground"
        />
      </div>
    </div>
  );
};

export default ChatHeader;
