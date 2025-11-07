"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Copy,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  Heart,
  Star,
  Share2,
  MessageSquare,
  Mail,
  Check,
  Flag,
  Archive,
} from "lucide-react";
import { getMessageId, getMessageContent } from "@/services/langchin-agent/messageUtils";
import { MessageResponse } from "@/types/langchin-agent/message";

interface MessageActionsProps {
  message: MessageResponse;
  messageType: "human" | "ai" | "tool" | "error";
  onLike?: (messageId: string) => void;
  onDislike?: (messageId: string) => void;
  onFavorite?: (messageId: string) => void;
  onBookmark?: (messageId: string) => void;
  onFlag?: (messageId: string) => void;
  onArchive?: (messageId: string) => void;
  isLiked?: boolean;
  isDisliked?: boolean;
  isFavorited?: boolean;
  isBookmarked?: boolean;
  isFlagged?: boolean;
  isArchived?: boolean;
  isLoading?: boolean;
}

export const MessageActions = ({
  message,
  messageType,
  onLike,
  onDislike,
  onFavorite,
  onBookmark,
  onFlag,
  onArchive,
  isLiked = false,
  isDisliked = false,
  isFavorited = false,
  isBookmarked = false,
  isFlagged = false,
  isArchived = false,
  isLoading = false,
}: MessageActionsProps) => {
  const [copied, setCopied] = useState(false);

  const messageId = getMessageId(message);
  const messageContent = getMessageContent(message);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy message:", error);
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(messageContent);
    const url = `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  };

  const handleShareTelegram = () => {
    const text = encodeURIComponent(messageContent);
    const url = `https://t.me/share/url?url=&text=${text}`;
    window.open(url, "_blank");
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent("Shared Message");
    const body = encodeURIComponent(messageContent);
    const url = `mailto:?subject=${subject}&body=${body}`;
    window.open(url);
  };

  return (
    <div className="flex items-center space-x-1 pt-2 px-2">
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6"
        onClick={copyMessage}
        disabled={isLoading}
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : (
          <Copy className="w-3 h-3 text-muted-foreground" />
        )}
      </Button>

      {/* Only show like/dislike for AI messages */}
      {messageType === "ai" && (
        <>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onLike?.(messageId)}
            disabled={isLoading}
          >
            <ThumbsUp className={`w-3 h-3 ${isLiked ? "text-green-500" : "text-muted-foreground"}`} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onDislike?.(messageId)}
            disabled={isLoading}
          >
            <ThumbsDown className={`w-3 h-3 ${isDisliked ? "text-red-500" : "text-muted-foreground"}`} />
          </Button>
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-6 w-6" disabled={isLoading}>
            <MoreHorizontal className="w-3 h-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-48">
          <DropdownMenuItem
            onClick={() => onFavorite?.(messageId)}
            className="flex items-center space-x-2"
            disabled={isLoading}
          >
            <Heart className={`w-4 h-4 ${isFavorited ? "text-red-500 fill-red-500" : ""}`} />
            <span>{isFavorited ? "Unfavorite" : "Favorite"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onBookmark?.(messageId)}
            className="flex items-center space-x-2"
            disabled={isLoading}
          >
            <Star className={`w-4 h-4 ${isBookmarked ? "text-yellow-500 fill-yellow-500" : ""}`} />
            <span>{isBookmarked ? "Unimportant" : "Important"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onFlag?.(messageId)}
            className="flex items-center space-x-2"
            disabled={isLoading}
          >
            <Flag className={`w-4 h-4 ${isFlagged ? "text-orange-500 fill-orange-500" : ""}`} />
            <span>{isFlagged ? "Unflag" : "Flag"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onArchive?.(messageId)}
            className="flex items-center space-x-2"
            disabled={isLoading}
          >
            <Archive className={`w-4 h-4 ${isArchived ? "text-blue-500 fill-blue-500" : ""}`} />
            <span>{isArchived ? "Unarchive" : "Archive"}</span>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center space-x-2">
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onClick={handleShareWhatsApp}
                className="flex items-center space-x-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleShareTelegram}
                className="flex items-center space-x-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Telegram</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleShareEmail}
                className="flex items-center space-x-2"
              >
                <Mail className="w-4 h-4" />
                <span>Email</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
