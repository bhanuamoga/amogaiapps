import { Metadata } from "next";
import { TokenUsageClient } from "./_components/TokenUsageClient";

export const metadata: Metadata = {
  title: "Token Usage Logs",
  description: "Detailed breakdown of your AI API usage",
};

export default function TokenUsagePage() {
  return <TokenUsageClient />;
}
