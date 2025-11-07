import { NextRequest, NextResponse } from "next/server";
import { postgrest } from "@/lib/postgrest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { messageId, action, threadId, messageIndex } = body || {};
    
    if (!messageId || !action || !threadId || messageIndex === undefined) {
      return NextResponse.json({ error: "messageId, action, threadId, and messageIndex are required" }, { status: 400 });
    }

    if (!["like", "dislike", "favorite", "bookmark", "flag", "archive"].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Must be one of: like, dislike, favorite, bookmark, flag, archive" }, { status: 400 });
    }

    // Check if metadata record exis
    const { data: existingMetadata } = await postgrest
      .from("message_metadata")
      .select("*")
      .eq("thread_id", threadId)
      .eq("message_index", messageIndex)
      .single();

    let updateData: Record<string, unknown> = {
      thread_id: threadId,
      message_index: messageIndex,
      message_id: messageId,
      user_id: null, // You might want to get this from auth context
    };

    // If metadata exists, get current values
    if (existingMetadata) {
      updateData = {
        ...existingMetadata,
        message_id: messageId, // Ensure message_id is updated
      };
    }

    // Handle different actions
    switch (action) {
      case "like":
        // Toggle like, remove dislike if present
        updateData.is_liked = !existingMetadata?.is_liked;
        if (updateData.is_liked) {
          updateData.is_disliked = false;
        }
        break;
      case "dislike":
        // Toggle dislike, remove like if present
        updateData.is_disliked = !existingMetadata?.is_disliked;
        if (updateData.is_disliked) {
          updateData.is_liked = false;
        }
        break;
      case "favorite":
        updateData.is_favorited = !existingMetadata?.is_favorited;
        break;
      case "bookmark":
        updateData.is_bookmarked = !existingMetadata?.is_bookmarked;
        break;
      case "flag":
        updateData.is_flagged = !existingMetadata?.is_flagged;
        break;
      case "archive":
        updateData.is_archived = !existingMetadata?.is_archived;
        break;
    }

    // Upsert the metadata record
    const { data: updatedMetadata, error: upsertError } = await postgrest
      .from("message_metadata")
      .upsert(updateData, {
        onConflict: "thread_id,message_index"
      })
      .select()
      .single();

    if (upsertError) {
      console.error("Error updating message metadata:", upsertError);
      return NextResponse.json({ error: "Failed to update message metadata" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      messageId,
      action,
      messageIndex,
      data: {
        is_liked: updatedMetadata.is_liked || false,
        is_disliked: updatedMetadata.is_disliked || false,
        is_favorited: updatedMetadata.is_favorited || false,
        is_bookmarked: updatedMetadata.is_bookmarked || false,
        is_flagged: updatedMetadata.is_flagged || false,
        is_archived: updatedMetadata.is_archived || false,
      }
    }, { status: 200 });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Update failed";
    console.error("Message action error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
