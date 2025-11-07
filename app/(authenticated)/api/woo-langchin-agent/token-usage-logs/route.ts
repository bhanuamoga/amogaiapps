import { NextRequest, NextResponse } from "next/server";
import { postgrest } from "@/lib/postgrest";
import { auth } from "@/auth";

export interface TokenUsageLogEntry {
  id: string;
  thread_id: string | null;
  user_id: number | null;
  source: string;
  api_id: string | null;
  model_name: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cached_tokens: number | null;
  total_tokens: number | null;
  cost: number | null;
  cost_per_1k_tokens: number | null;
  createdAt: string | null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.user_catalog_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "0", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = page * limit;

  try {
    const { data: dbLogs, error } = await postgrest
      .from("TokenUsageLog")
      .select("*")
      .eq("user_id", session.user.user_catalog_id)
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching token usage logs:", error);
      return NextResponse.json({ error: "Failed to fetch token usage logs" }, { status: 500 });
    }

    const logs: TokenUsageLogEntry[] = (dbLogs || []).map((log) => ({
      id: log.id,
      thread_id: log.thread_id,
      user_id: log.user_id,
      source: log.source,
      api_id: log.api_id,
      model_name: log.model_name,
      prompt_tokens: log.prompt_tokens,
      completion_tokens: log.completion_tokens,
      cached_tokens: log.cached_tokens,
      total_tokens: log.total_tokens,
      cost: log.cost,
      cost_per_1k_tokens: log.cost_per_1k_tokens,
      createdAt: log.createdAt || null,
    }));

    return NextResponse.json(logs, { status: 200 });
  } catch (e: unknown) {
    console.error("Error in GET token usage logs:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch token usage logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

