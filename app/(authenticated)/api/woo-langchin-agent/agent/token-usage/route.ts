import { NextRequest, NextResponse } from "next/server";
import { getTokenUsage, getAllTokenUsage } from "@/lib/langchin-agent/tokenUsage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (threadId) {
      // Get token usage for specific thread
      const tokenUsage = await getTokenUsage(threadId);
      if (!tokenUsage) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 });
      }
      return NextResponse.json({ threadId, tokenUsage });
    } else {
      // Get token usage for all threads
      const allTokenUsage = await getAllTokenUsage();
      return NextResponse.json({ tokenUsage: allTokenUsage });
    }
  } catch (error) {
    console.error("Error fetching token usage:", error);
    return NextResponse.json({ error: "Failed to fetch token usage" }, { status: 500 });
  }
}
