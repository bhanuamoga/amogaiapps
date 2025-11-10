import { NextRequest, NextResponse } from "next/server";
import type { Thread } from "@/types/langchin-agent/message";
import { postgrest } from "@/lib/postgrest";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.user_catalog_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: dbThreads, error } = await postgrest
    .from("Thread" as any)
    .select("*")
    .eq("user_id", session.user.user_catalog_id)
    .order("updatedAt", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching threads:", error);
    return NextResponse.json({ error: "Failed to fetch threads" }, { status: 500 });
  }

  const threads = (dbThreads || []).map((t) => ({
    id: t.id,
    title: t.title,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    bookmarked: t.bookmarked || false,
    archived: t.archived || false,
    tokenUsage: t.token_usage || {
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      cached_tokens: 0,
      total_cost: 0.0,
      model_costs: {},
      last_updated: null,
    },
  } as Thread));

  return NextResponse.json(threads, { status: 200 });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.user_catalog_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: created, error } = await postgrest
    .from("Thread" as any)
    .insert({ title: "New thread", user_id: session.user.user_catalog_id })
    .select()
    .single();

  if (error) {
    console.error("Error creating thread:", error);
    return NextResponse.json({ error: "Failed to create thread" }, { status: 500 });
  }

  const thread: Thread = {
    id: created.id,
    title: created.title,
    createdAt: created.createdAt || "",
    updatedAt: created.updatedAt || "",
  };
  return NextResponse.json(thread, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, bookmarked, archived } = body || {};
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (bookmarked !== undefined) updateData.bookmarked = bookmarked;
    if (archived !== undefined) updateData.archived = archived;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: updated, error } = await postgrest
      .from("Thread" as any)
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating thread:", error);
      return NextResponse.json({ error: "Failed to update thread" }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: updated.id,
        title: updated.title,
        bookmarked: updated.bookmarked || false,
        archived: updated.archived || false,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
      { status: 200 },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body || {};
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Thread id required" }, { status: 400 });
    }

    // First check if thread exists
    const { data: thread, error: fetchError } = await postgrest
      .from("Thread" as any)
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Delete the thread from Supabase (metadata)
    const { error: deleteError } = await postgrest.from("Thread" as any).delete().eq("id", id);

    if (deleteError) {
      console.error("Error deleting thread:", deleteError);
      return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 });
    }

    // Note: LangGraph checkpoint data will become orphaned but won't affect functionality
    // The checkpointer will simply not find any thread metadata for this thread_id
    // Future versions could implement direct checkpoint deletion via SQL if needed

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
