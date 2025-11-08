"use client";
import React, { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from "next/navigation";

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
  mode?: string;
}

const MenuBar = ({ open, setOpen }: Props) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  // --- Close when clicking outside ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, setOpen]);

  if (!open) return null;

  const handleNewChat = () => {
    const newChatId = uuidv4();
    setOpen(false);
    router.push(`/StoreDashboard/chat/${newChatId}`);
  };


  return (
    <div className="relative w-full">
      {/* Dropdown card positioned below the menu icon */}
      <div
        ref={cardRef}
        className="absolute right-0 mt-2 z-50 animate-fade-in"
      >
        <Card className="w-[180px] rounded-lg border border-gray-200 bg-white shadow-md">
          <div className="flex flex-col text-[15px] font-medium text-gray-800">
            <button
              className="text-left px-4 py-2 hover:bg-gray-50 transition-colors"
              onClick={handleNewChat}

            >
              New
            </button>

            <div className="border-t border-gray-100" />

            <Link
              href="/StoreDashboard/Favorites"
              onClick={() => setOpen(false)}
              className="text-left px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              Favorites
            </Link>

            {/* ✅ Chat History opens full page */}
            <Link
              href="/StoreDashboard/History"
              onClick={() => setOpen(false)}
              className="text-left px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              Chat History
            </Link>

            <div className="border-t border-gray-100" />
            <button
              className="text-left px-4 py-2 hover:bg-gray-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              Prompt History
            </button>
            <button
              className="text-left px-4 py-2 hover:bg-gray-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              Woo Prompt List
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MenuBar;
