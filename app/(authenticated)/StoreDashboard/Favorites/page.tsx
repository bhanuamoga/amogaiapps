/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { Search, Star, MessageSquare, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getChatFavorites } from "@/app/(authenticated)/aichat/lib/actions";
import { v4 as uuidv4 } from "uuid";

export default function FavoritesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // ✅ Fetch favorites
  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const res: any = await getChatFavorites("Chat with Store Board");
      setFavorites(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load favorites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  // ✅ Filter favorites by search term
  const filteredFavorites = favorites
    .filter((item) =>
      item.content?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  // ✅ Create new chat
  const handleNewChat = () => {
    const newChatId = uuidv4();
    router.push(`/StoreDashboard/chat/${newChatId}`);
  };

  return (
    <div className="flex flex-col p-6 w-full max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <Button variant="default" onClick={handleNewChat} className="gap-2">
          <MessageSquare className="h-4 w-4" />
          New Chat
        </Button>

        <Button variant="default" onClick={() => history.back()}>
          <X className="h-5 w-5 mr-1" />
          Close
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-2.5 h-4 w-4 opacity-60" />
        <Input
          placeholder="Search favorites..."
          className="pl-9 w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Favorites List */}
      <div className="min-h-[300px] flex flex-col gap-4 overflow-y-auto py-2">
        {loading ? (
          <div className="flex items-center justify-center h-[300px] opacity-70">
            Loading...
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] opacity-70">
            {searchTerm ? "No matching favorites found" : "No favorites yet."}
          </div>
        ) : (
          filteredFavorites.map((item: any) => (
            <Card
              key={item.id}
              className="p-4 rounded-xl hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                  <Star className="h-5 w-5 fill-primary text-primary" />
                </div>

                <div className="flex flex-col flex-1">
                  {/* Chat Content */}
                  <Link
                    href={`/StoreDashboard/chat/${item.chatId}`}
                    className="font-medium text-base hover:underline line-clamp-2"
                  >
                    {item.content || "Untitled Chat"}
                  </Link>

                  <p className="text-sm opacity-70 mt-1">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
