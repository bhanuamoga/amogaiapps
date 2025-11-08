"use client";

import React, { useState, useEffect } from "react";
import { Bookmark } from "lucide-react"; // ✅ use Bookmark icon
import { toast } from "sonner";
import { toggleBookmark, getChatHistory } from "@/app/(authenticated)/aichat/lib/actions";

interface BookmarkProps {
  chatId?: string;
}

const BookmarkButton = ({ chatId }: BookmarkProps) => {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  // 🧠 Load bookmark status for this chat
  useEffect(() => {
    const fetchBookmarkStatus = async () => {
      if (!chatId) return;
      try {
        const res: any = await getChatHistory("Chat with Store Board");
        const chat = res?.find((c: any) => c.id === chatId);
        if (chat) setIsBookmarked(chat.bookmark === true);
      } catch (error) {
        console.error("Failed to load bookmark:", error);
      }
    };
    fetchBookmarkStatus();
  }, [chatId]);

  // ⭐ Toggle bookmark
  const handleToggleBookmark = async () => {
    if (!chatId) {
      toast.error("Create a chat first before bookmarking.");
      return;
    }

    try {
      setLoading(true);
      const newStatus = !isBookmarked;
      setIsBookmarked(newStatus);

      const res = await toggleBookmark(chatId, newStatus);
      if (!res.success) {
        toast.error("Failed to update bookmark");
        setIsBookmarked(!newStatus); // revert if failed
      } else {
        toast.success(newStatus ? "Chat bookmarked" : "Bookmark removed");
      }
    } catch (error) {
      console.error("Bookmark toggle error:", error);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ⏳ Don’t show bookmark icon until chat is created
  if (!chatId) return null;

  return (
    <div className="relative flex items-center">
      <Bookmark
        onClick={handleToggleBookmark}
        className={`w-5 h-5 cursor-pointer transition ${
          isBookmarked
            ? "fill-yellow-500 text-yellow-500"
            : "text-gray-400 hover:text-yellow-500"
        } ${loading ? "opacity-50 pointer-events-none" : ""}`}
      />
    </div>
  );
};

export default BookmarkButton;
