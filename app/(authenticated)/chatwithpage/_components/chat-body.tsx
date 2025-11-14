"use client";

import React, { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import {
  FileSearch,
  BarChart,
  ClipboardList,
  Lightbulb,
  Bot as BotIcon,
} from "lucide-react";

import DataDisplay, {
  ChartConfig,
  TableData,
} from "../_components/DataDisplay";

// ----------------------
// MESSAGE TYPES
// ----------------------
type Message = {
  role: "user" | "assistant" | "error";
  content:
    | string
    | {
        type: "chart" | "table";
        data: any;
      };
};

type ChatBodyProps = {
  chatUuid: string;
  messages: Message[];
  isLoading?: boolean;
  errorMessage?: string | null;
};

// ----------------------
// SUGGESTION CARDS
// ----------------------
const suggestions = [
  {
    title: "Analyze Documents",
    description: "Get insights from your files",
    icon: FileSearch,
  },
  {
    title: "Create Visualization",
    description: "Generate charts from your data",
    icon: BarChart,
  },
  {
    title: "Summarize Content",
    description: "Extract key information quickly",
    icon: ClipboardList,
  },
  {
    title: "Get Insights",
    description: "Receive smart recommendations",
    icon: Lightbulb,
  },
];

function SuggestionCard({ title, description, icon: Icon }: any) {
  return (
    <Card className="rounded-md w-full hover:bg-muted cursor-pointer transition-colors">
      <button className="flex items-start gap-3 w-full h-full p-6 bg-transparent rounded-md text-left">
        <Icon className="w-5 h-5 mt-1 text-muted-foreground" strokeWidth={1.8} />
        <span>
          <span className="block text-base font-semibold text-foreground">
            {title}
          </span>
          <span className="block text-[15px] text-muted-foreground">
            {description}
          </span>
        </span>
      </button>
    </Card>
  );
}

// ----------------------
// MAIN CHAT BODY
// ----------------------
export default function ChatBody({
  chatUuid,
  messages,
  isLoading = false,
  errorMessage = null,
}: ChatBodyProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 bg-background">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* -------------------------------------------------- */}
        {/* WELCOME SECTION WHEN NO MESSAGES */}
        {/* -------------------------------------------------- */}
        {messages.length === 0 && (
          <div className="py-10">
            <div className="max-w-2xl mx-auto flex flex-col items-center">
              <div className="w-16 h-16 mb-7 rounded-full bg-muted flex items-center justify-center">
                <BotIcon className="w-8 h-8 text-foreground" />
              </div>
              <h1 className="text-center font-bold text-3xl mb-2">
                Welcome to AI Chat
              </h1>
              <p className="text-center text-muted-foreground mb-10 text-[17px] font-normal">
                How can I help you today? Choose a suggestion below or start typing your own question.
              </p>
              <div className="grid gap-4 w-full grid-cols-1 sm:grid-cols-2 mb-4">
                {suggestions.map((s) => (
                  <SuggestionCard key={s.title} {...s} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------- */}
        {/* CHAT MESSAGES */}
        {/* -------------------------------------------------- */}
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          const isError = msg.role === "error";
          const isAssistant = msg.role === "assistant";

          // STRUCTURED OUTPUT (chart/table)
          if (isAssistant && typeof msg.content === "object") {
            const { type, data } = msg.content;

            // --- CHART ---
            if (type === "chart") {
              const rows = data.chartData ?? [];
              const xKey = data.xAxisColumn;
              const yKey = data.yAxisColumn;

              const chart: ChartConfig = {
                type: data.type || "bar",
                title: data.title || "Chart",
                data: {
                  labels: rows.map((r: any) => r[xKey]),
                  datasets: [
                    {
                      label: data.datasetLabel || "Data",
                      data: rows.map((r: any) => Number(r[yKey])),
                      backgroundColor: "#6366F1",
                      borderColor: "#6366F1",
                      borderWidth: 2,
                    },
                  ],
                },
              };

              return (
                <div key={`chart-${i}`} className="flex justify-start">
                  <DataDisplay
                    title={chart.title}
                    chartConfig={chart}
                    showChart
                    showTable={false}
                    className="w-full"
                  />
                </div>
              );
            }

            // --- TABLE ---
            if (type === "table") {
              const table: TableData = data.tableData ?? data;

              return (
                <div key={`table-${i}`} className="flex justify-start">
                  <DataDisplay
                    title={table.title || "Table"}
                    tableData={table}
                    showTable
                    showChart={false}
                    className="w-full"
                  />
                </div>
              );
            }
          }

          // DEFAULT TEXT BUBBLE
          return (
            <div
              key={`msg-${i}`}
              className={`flex ${
                isUser
                  ? "justify-end"
                  : isError
                  ? "justify-center"
                  : "justify-start"
              }`}
            >
              <div
                className={`rounded-2xl px-4 py-2 max-w-[75%] text-sm whitespace-pre-wrap break-words ${
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : isError
                    ? "bg-red-100 text-red-700 font-semibold"
                    : "bg-muted text-foreground"
                }`}
              >
                {typeof msg.content === "string"
                  ? msg.content
                  : msg.content?.data?.title || "Received structured data"}
              </div>
            </div>
          );
        })}

        {/* LOADING STATE */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2 max-w-[75%] text-sm bg-muted text-foreground opacity-80 animate-pulse">
              Thinking...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}   