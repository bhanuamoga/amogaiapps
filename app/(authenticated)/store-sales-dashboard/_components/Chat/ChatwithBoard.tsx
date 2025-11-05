/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useRef } from "react";

import {
  ArrowUp,
  Bot,
  Copy,
  Edit,
  Eye,
  FileUp,
  Loader2,
  Mic,
  RefreshCw,
  Share2,
  Star,
  ThumbsDown,
  ThumbsUp,
  Volume2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  addFavorite,
  addFeedback,
  createChat,
  createMessage,
  fetchMessages,
} from "@/app/(authenticated)/files/lib/action";
import { v4 as uuidv4 } from "uuid";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getChatFavorites,
  getChatHistory,
} from "@/app/(authenticated)/aichat/lib/actions";
import { Chart } from "react-chartjs-2";
import "chart.js/auto";
import "chartjs-adapter-date-fns";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from "chart.js";
import HistoryBar from "./sidebar/History";
import MenuBar from "./sidebar/MenuBar";
import FavoritesBar from "./sidebar/FavoritesBar";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface PageProps {
  chatId?: string;
  openHistory: boolean;
  setOpenHistory: (open: boolean) => void;
  openFavorite: boolean;
  setOpenFavorite: (open: boolean) => void;
  openMenu: boolean;
  setOpenMenu: (open: boolean) => void;
  setUsage: React.Dispatch<
    React.SetStateAction<{
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }>
  >;
}

// --- helpers: sanitize any secrets from context sent to server ---
function stripSecrets(obj: any): any {
  if (obj == null || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(stripSecrets);
  }

  const forbiddenKeys = new Set([
    "key",
    "apiKey",
    "apikey",
    "secret",
    "token",
    "accessToken",
  ]);

  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (forbiddenKeys.has(k)) {
      // drop the secret
      continue;
    }
    out[k] = stripSecrets(v);
  }
  return out;
}

const ChatwithData = ({
  chatId: initialChatId,
  openHistory,
  setOpenHistory,
  openFavorite,
  setOpenFavorite,
  openMenu,
  setOpenMenu,
  setUsage,
}: PageProps) => {
  const [chatId, setChatId] = React.useState<string | undefined>(initialChatId);
  const [prompt, setPrompt] = React.useState("");
  const [messages, setMessages] = React.useState<any[]>([]);
  const [isResponseLoading, setIsResponseLoading] = React.useState(false);
  const [historyData, setHistoryData] = React.useState<any[]>([]);
  const [favoriteData, setFavoriteData] = React.useState<any[]>([]);
  const [contextData, setContextData] = React.useState<any>({});
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [isMessageAction, setIsMessageAction] = React.useState(false);

  const { data: session } = useSession();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const isMessageActionUpdate = useRef(false);
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  // fetch board context (no secrets should be returned by backend; still sanitize defensively)
  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        const response = await fetch("/api/store-sales-dashboard/sales-data", {
          method: "GET",
        });
        const result = await response.json();
        const safeData = stripSecrets(result?.data ?? {});
        setContextData(safeData);
        setSuggestions([]);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load board data");
      }
    };
    fetchSalesData();
  }, []);

  // adopt incoming prop chatId only once on mount / when it changes
  useEffect(() => {
    if (initialChatId) setChatId(initialChatId);
  }, [initialChatId]);

  // speech to text
  useEffect(() => {
    if (!listening && transcript) {
      setPrompt(transcript);
      resetTranscript();
    }
  }, [listening, transcript, resetTranscript]);

  // autoscroll
  useEffect(() => {
    if (
      scrollAreaRef.current &&
      isAtBottom &&
      !isMessageActionUpdate.current &&
      !isMessageAction
    ) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLDivElement | null;
      if (scrollContainer) {
        requestAnimationFrame(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        });
      }
    }
    isMessageActionUpdate.current = false;
  }, [messages, isAtBottom, suggestions, isMessageAction]);

  // history/favorites
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response: any = await getChatHistory("Chat with Store Board");
        setHistoryData(response);
      } catch (error) {
        toast.error("Error fetching history");
      }
    };
    fetchHistory();
  }, [openHistory]);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const response: any = await getChatFavorites("Chat with Store Board");
        setFavoriteData(response);
      } catch (error) {
        toast.error("Error fetching favorites");
      }
    };
    fetchFavorites();
  }, [openFavorite]);

  // load existing messages if opening an existing chat
  useEffect(() => {
    if (chatId) {
      const renderMessages = async () => {
        const response = await fetchMessages(chatId);

        if (!response) {
          toast("Failed to fetch messages");
          return;
        }
        const sortedData = response.sort((a: any, b: any) => {
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
        setMessages(
          sortedData.map((msg: any) => ({
            id: msg.id,
            chatId: msg.chatId,
            createdAt: msg.createdAt,
            bookmark: msg.bookmark,
            isLike: msg.isLike,
            favorite: msg.favorite,
            chartType: msg.chartType,
            chartData: msg.chartData,
            chartOptions: msg.chartOptions,
            text: msg.content,
            role: msg.role,
          }))
        );
      };
      renderMessages();
    }
  }, [chatId]);

  // ensure stable order if createdAt missing (rare)
  useEffect(() => {
    if (messages.length > 0) {
      const sortedMessages = [...messages].sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        }
        if (a.id && b.id) {
          return String(a.id).localeCompare(String(b.id));
        }
        return 0;
      });

      if (
        JSON.stringify(sortedMessages.map((m) => m.id)) !==
        JSON.stringify(messages.map((m) => m.id))
      ) {
        setMessages(sortedMessages);
      }
    }
  }, [messages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollContainer = e.currentTarget;
    const isBottom =
      scrollContainer.scrollHeight - scrollContainer.scrollTop <=
      scrollContainer.clientHeight + 10;
    setIsAtBottom(isBottom);
  };

   const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();

  const queryData = prompt.trim().replace(/"/g, "");
  if (!queryData) return;
  if (!session?.user?.user_catalog_id) {
    toast.error("You must be logged in to send messages.");
    return;
  }

  setIsResponseLoading(true);
  setIsMessageAction(false);

  try {
    const userId = session.user.user_catalog_id;
    const newChatUuid = uuidv4();
    const userMsgId = uuidv4();
    const assistantMsgId = uuidv4();
    const currentChatId = chatId || newChatUuid;
    const createdDate = new Date().toISOString();

    // ✅ Step 1: Ensure a chat exists — create if not already saved
    let chatCreated = false;
    if (!chatId) {
      const chatPayload = {
        id: currentChatId,
        user_id: userId,
        title: queryData,
        status: "active",
        chat_group: "Chat with Store Board",
        createdAt: createdDate,
      };

      const createChatData = await createChat(chatPayload);

      if (createChatData?.success) {
        chatCreated = true;
        setChatId(currentChatId);
      } else {
        console.error("❌ Chat not saved:", createChatData);
        toast.error("Failed to save chat record");
      }
    }

    // ✅ Step 2: Always update chat title (optional for clarity)
    if (chatId && !chatCreated) {
      await createChat({
        id: currentChatId,
        user_id: userId,
        title: queryData,
        status: "active",
        chat_group: "Chat with Store Board",
        createdAt: createdDate,
      });
    }

    // ✅ Step 3: Save user message
    const userMessage = {
      id: userMsgId,
      chatId: currentChatId,
      content: queryData,
      role: "user",
      createdAt: createdDate,
      user_id: userId,
      chat_group: "Chat with Store Board",
    };

    setMessages((prev) => [...prev, { ...userMessage, text: queryData }]);
    await createMessage(userMessage);

    // ✅ Step 4: Add a temporary “assistant is typing” message
    const assistantMsg = {
      id: assistantMsgId,
      chatId: currentChatId,
      content: "Generating...",
      role: "assistant",
      createdAt: createdDate,
      user_id: userId,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    // ✅ Step 5: Fetch AI response safely
    const safeContext = stripSecrets(contextData);
    const response = await fetch("/api/store-sales-dashboard/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contextData: safeContext, queryData }),
    });

    const result = await response.json();
    if (result?.usage) setUsage(result.usage);

    // ✅ Step 6: Parse AI response
    let aiResponse = "";
    let chartType = null;
    let chartData = null;
    let chartOptions = null;

    if (result?.text && typeof result.text === "object") {
      aiResponse = result.text.text || result.text.summary || "Response ready.";
      chartType = result.text.chartType ?? null;
      chartData = result.text.chartData ?? null;
      chartOptions = result.text.chartOptions ?? null;
    } else {
      aiResponse = result?.text || "No structured chart data found.";
    }

    // ✅ Step 7: Update assistant message in UI
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMsgId
          ? {
              ...msg,
              text: aiResponse,
              content: aiResponse,
              chartType,
              chartData,
              chartOptions,
            }
          : msg
      )
    );

    // ✅ Step 8: Save assistant message in DB
    await createMessage({
      id: assistantMsgId,
      chatId: currentChatId,
      content: aiResponse,
      role: "assistant",
      chat_group: "Chat with Store Board",
      createdAt: new Date().toISOString(),
      user_id: userId,
      chartType,
      chartData,
      chartOptions,
    });

    setPrompt("");
  } catch (error) {
    console.error("❌ Error in handleSubmit:", error);
    toast.error("Failed to process your message");
  } finally {
    setIsResponseLoading(false);
  }
};


  const handleFavorite = async (message: any) => {
    const newFavoriteStatus = !message.favorite;
    setIsMessageAction(true);

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === message.id ? { ...msg, favorite: newFavoriteStatus } : msg
      )
    );
    const favorite = await addFavorite(message.id);
    if (!favorite?.success) {
      toast.error("Error adding favorite");
    }
  };

  const handleLike = async (message: any, isLike: boolean) => {
    const newLikeStatus = message.isLike === isLike ? null : isLike;
    setIsMessageAction(true);

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === message.id ? { ...msg, isLike: newLikeStatus } : msg
      )
    );
    const feedback = await addFeedback(message.id, newLikeStatus);
    if (!feedback?.success) {
      toast.error("Error saving feedback");
    }
  };

  const handleSuggestedPromps = async (query: string) => {
    const queryData = query.replace(/"/g, "");
    if (!queryData) return;
    if (!session?.user?.user_catalog_id) {
      toast.error("You must be signed in to chat.");
      return;
    }

    setIsMessageAction(false);
    setIsResponseLoading(true);

    try {
      // existing or new chat
      let currentChatId = chatId;
      const createdDate = new Date().toISOString();

      if (!currentChatId) {
        currentChatId = uuidv4();
        const payload = {
          createdAt: createdDate,
          user_id: session.user.user_catalog_id,
          id: currentChatId,
          title: queryData,
          status: "active",
          chat_group: "Chat with Store Board",
        };
        const createChatData = await createChat(payload);
        if (!createChatData?.success) {
          toast.error("Error creating chat");
        }
        setChatId(currentChatId);
      }

      // add user message
      const userMsgId = uuidv4();
      const assistantMsgId = uuidv4();

      const userMessage = {
        id: userMsgId,
        chatId: currentChatId!,
        content: queryData,
        text: queryData,
        role: "user",
        createdAt: createdDate,
        user_id: session.user.user_catalog_id,
      };
      setMessages((prev) => [...prev, userMessage]);
      await createMessage(userMessage);

      // placeholder assistant
      const assistantMsg = {
        id: assistantMsgId,
        chatId: currentChatId!,
        content: "Generating...",
        text: "Generating...",
        role: "assistant",
        createdAt: createdDate,
        user_id: session.user.user_catalog_id,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // sanitize context before sending
      const safeContext = stripSecrets(contextData);

      const response = await fetch("/api/store-sales-dashboard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextData: safeContext, queryData }),
      });
      const result = await response.json();

      let aiResponse = "";
      let chartType: any = null;
      let chartData: any = null;
      let chartOptions: any = null;

      if (result?.text && typeof result.text === "object") {
        aiResponse = result.text.text || "Here's your chart.";
        chartType = result.text.chartType ?? null;
        chartData = result.text.chartData ?? null;
        chartOptions = result.text.chartOptions ?? null;
      } else {
        aiResponse = result?.text || "No structured chart data found.";
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                text: aiResponse,
                content: aiResponse,
                chartType,
                chartData,
                chartOptions,
              }
            : m
        )
      );

      await createMessage({
        id: assistantMsgId,
        chatId: currentChatId!,
        content: aiResponse,
        role: "assistant",
        createdAt: new Date().toISOString(),
        user_id: session.user.user_catalog_id,
        chartType,
        chartData,
        chartOptions,
      });

      setPrompt("");
    } catch (error) {
      console.error(error);
      toast.error("Failed fetching AI response");
    } finally {
      setIsResponseLoading(false);
    }
  };

  const handleMicClick = () => {
    if (!browserSupportsSpeechRecognition) {
      toast.error("Browser doesn't support speech recognition");
      return;
    }
    resetTranscript();
    SpeechRecognition.startListening({ continuous: false, language: "en_US" });
  };

  const speak = (text: string) => {
    if (typeof window !== "undefined" && typeof text === "string") {
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 1;
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices[1]) utterance.voice = voices[1];
      synth.speak(utterance);
    }
  };

  return (
    <div className="mt-5 flex w-full justify-center h-screen ">
      <div className="flex flex-col justify-center items-center w-full h-full">
        <HistoryBar
          open={openHistory}
          data={historyData}
          title="History"
          setOpen={setOpenHistory}
          fetchHistory={async () => {
            try {
              const response: any = await getChatHistory("Chat with Store Board");
              setHistoryData(response);
            } catch {
              toast.error("Error fetching history");
            }
          }}
        />
        <FavoritesBar
          open={openFavorite}
          data={favoriteData}
          title="Favorites"
          setOpen={setOpenFavorite}
          mode="AI-Chat"
        />
        <MenuBar open={openMenu} mode="AI-Chat" setOpen={setOpenMenu} />

        <div className="flex items-center w-full flex-wrap gap-4">
          {messages.length <= 1 &&
            suggestions &&
            suggestions?.length > 0 &&
            suggestions.map((item, index) => (
              <div key={index}>
                <Button
                  variant={"outline"}
                  onClick={() => handleSuggestedPromps(item)}
                  className="rounded-full"
                >
                  {item.replace(/"/g, "")}
                </Button>
              </div>
            ))}
        </div>

        <div className="flex-1 w-full h-[85%]">
          <ScrollArea
            ref={scrollAreaRef}
            onScroll={handleScroll}
            className="flex-1 w-full h-full"
          >
            <div className="flex mr-5 flex-col gap-4 w-full md:p-4 pb-8">
              {messages.map((message, index) => (
                <div
                  key={message.id ?? index}
                  className="flex items-center gap-2 w-full justify-start "
                >
                  <div className="flex bg-secondary rounded-full h-10 w-10 flex-col items-center justify-center">
                    {message.role === "user" ? (
                      <p className="flex flex-col items-center justify-center">
                        {session?.user?.user_name?.[0]?.toUpperCase() ?? "U"}
                      </p>
                    ) : (
                      <Bot className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex w-[680px] flex-col gap-2">
                    <div
                      className={`rounded-t-md break-words break-all overflow-y-auto rounded-l-lg p-3 ${
                        message.role === "user" ? "bg-muted" : "bg-muted"
                      }`}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {typeof message.text === "string"
                          ? message.text
                          : JSON.stringify(message.text ?? "Generating...")}
                      </ReactMarkdown>

                      {message.chartType && message.chartData && (
                        <div className="mt-4">
                          <Chart
                            className="max-w-full max-h-full min-h-72"
                            type={message.chartType}
                            data={message.chartData}
                            options={{
                              ...message.chartOptions,
                              maintainAspectRatio: false,
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {message.role === "assistant" && (
                      <div className="flex md:ml-3 items-center gap-5">
                        <div className="flex items-center gap-5">
                          <Eye className="w-5 h-5 cursor-pointer text-muted-foreground" />
                          <Star
                            className={`w-5 h-5 cursor-pointer text-muted-foreground ${
                              message.favorite ? "fill-primary text-primary" : ""
                            }`}
                            onClick={() => handleFavorite(message)}
                          />
                          <Copy
                            onClick={() => {
                              navigator.clipboard.writeText(
                                typeof message.text === "string"
                                  ? message.text
                                  : JSON.stringify(message.text ?? "")
                              );
                              toast.success("Copied to clipboard");
                            }}
                            className="w-5 h-5 cursor-pointer text-muted-foreground"
                          />
                          <RefreshCw className="w-5 h-5 cursor-pointer text-muted-foreground" />
                          <Share2 className="w-5 h-5 cursor-pointer text-muted-foreground" />
                          <Edit className="w-5 h-5 cursor-pointer text-muted-foreground" />
                          <Volume2
                            onClick={() =>
                              speak(
                                typeof message.text === "string"
                                  ? message.text
                                  : JSON.stringify(message.text ?? "")
                              )
                            }
                            className="w-5 h-5 cursor-pointer text-muted-foreground"
                          />
                        </div>
                        <div className="flex items-center gap-5 justify-end w-full">
                          <ThumbsUp
                            onClick={() => handleLike(message, true)}
                            className={`w-5 h-5 ${
                              message.isLike === true &&
                              "fill-primary text-primary"
                            } cursor-pointer text-muted-foreground`}
                          />
                          <ThumbsDown
                            onClick={() => handleLike(message, false)}
                            className={`w-5 h-5 ${
                              message.isLike === false &&
                              "fill-primary text-primary"
                            } cursor-pointer text-muted-foreground`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-4 sticky bottom-0 w-full p-4 bg-background"
        >
          <div className="rounded-full flex items-center p-2.5 border">
            <Input
              placeholder="Type your message here"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="border-0"
            />
            <div className="flex items-center gap-4">
              <FileUp className="w-5 h-5 cursor-not-allowed text-muted-foreground" />
              <Button
                disabled={isResponseLoading || !prompt.trim()}
                size={"icon"}
                className="rounded-full"
              >
                {isResponseLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowUp className="w-5 h-5 " />
                )}
              </Button>
              <Button
                onClick={handleMicClick}
                size={"icon"}
                disabled={listening}
                className="rounded-full"
              >
                {listening ? (
                  <Loader2 className="w-5 animate-spin h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const ChatwithBoard = React.memo(ChatwithData);
export default ChatwithBoard;
