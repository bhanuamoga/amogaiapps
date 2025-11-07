import { NextRequest, NextResponse } from "next/server";
import { postgrest } from "@/lib/postgrest";
import { auth } from "@/auth";
import type { Notification } from "@/types/langchin-agent/notification";

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
    const { data: dbNotifications, error } = await postgrest
      .from("notifications")
      .select("*")
      .eq("user_id", session.user.user_catalog_id)
      .eq("notification_group", "AI_CHAT_NOTIFICATION")
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching notifications:", error);
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    const notifications: Notification[] = (dbNotifications || []).map((n) => ({
      id: n.id,
      notificationid: n.notificationid,
      notification_group: n.notification_group,
      ref_chatid: n.ref_chatid,
      ref_chat_url: n.ref_chat_url,
      role: n.role,
      content: n.content,
      content_json: n.content_json as Record<string, unknown> | null,
      createdAt: n.createdAt || n.created_at || new Date().toISOString(),
      favorite: n.favorite || false,
      islike: n.islike || false,
      bookmark: n.bookmark || false,
      custom_one: n.custom_one,
      custom_two: n.custom_two,
      user_id: n.user_id,
      user_name: n.user_name,
      user_email: n.user_email,
      status: n.status,
      mydoc_list_id: n.mydoc_list_id,
      mydoc_number: n.mydoc_number,
      response_data_json: n.response_data_json,
      response_file_url: n.response_file_url,
      columns: n.columns,
      chartconfig: n.chartconfig,
      plan_id: n.plan_id,
      plan_code: n.plan_code,
      task_id: n.task_id,
      task_code: n.task_code,
      msg_id: n.msg_id,
      msg_code: n.msg_code,
      prompt_json: n.prompt_json,
      chat_session: n.chat_session,
      response_story_json: n.response_story_json,
      response_narrative_json: n.response_narrative_json,
      response_file_json: n.response_file_json,
      response_text_json: n.response_text_json,
      custom_one_json: n.custom_one_json,
      custom_two_json: n.custom_two_json,
      remainder: n.remainder,
      important: n.important,
      progress_status: n.progress_status,
      created_user_id: n.created_user_id,
      created_user_name: n.created_user_name,
      ref_user_id: n.ref_user_id,
      ref_user_name: n.ref_user_name,
      created_date: n.created_date,
      updated_date: n.updated_date,
      data_source_name: n.data_source_name,
      chat_message_type: n.chat_message_type,
      soc_room_id: n.soc_room_id,
      sender_id: n.sender_id,
      sender_user_name: n.sender_user_name,
      receiver_user_id: n.receiver_user_id,
      receiver_user_name: n.receiver_user_name,
      receiver_group_id: n.receiver_group_id,
      ref_chat_message_json: n.ref_chat_message_json,
      ref_chat_message_id: n.ref_chat_message_id,
      chat_message: n.chat_message,
      from_chat_group_name: n.from_chat_group_name,
      to_chat_group_name: n.to_chat_group_name,
      from_agent_name: n.from_agent_name,
      to_agent_name: n.to_agent_name,
      from_json: n.from_json,
      to_json: n.to_json,
      from_business_number: n.from_business_number,
      from_business_name: n.from_business_name,
      to_business_number: n.to_business_number,
      to_business_name: n.to_business_name,
      for_business_number: n.for_business_number,
      for_business_name: n.for_business_name,
      ref_business_number: n.ref_business_number,
      ref_business_name: n.ref_business_name,
      receiver_display_name: n.receiver_display_name,
      chat_group_name: n.chat_group_name,
      chat_group_code: n.chat_group_code,
      chat_group_type: n.chat_group_type,
      chat_group_category: n.chat_group_category,
      room_type: n.room_type,
      room_group: n.room_group,
      room_name: n.room_name,
      room_code: n.room_code,
      progress_json: n.progress_json,
      status_log_json: n.status_log_json,
      user_log_json: n.user_log_json,
      business_log_json: n.business_log_json,
      agent_json: n.agent_json,
      response_json: n.response_json,
      timeline_json: n.timeline_json,
      file_upload_json: n.file_upload_json,
      share_json: n.share_json,
      message_loop_json: n.message_loop_json,
      message_content_json: n.message_content_json,
      message_card_json: n.message_card_json,
      replied_to_message_id: n.replied_to_message_id,
      related_to_message_id: n.related_to_message_id,
      forwarded_from_message_id: n.forwarded_from_message_id,
      seen_by_users: n.seen_by_users,
      reactions: n.reactions,
      sender_display_name: n.sender_display_name,
      attachment_url: n.attachment_url,
      attachment_name: n.attachment_name,
      chat_message_opened: n.chat_message_opened,
      attachment_type: n.attachment_type,
      is_forwarded: n.is_forwarded,
      selected_users: n.selected_users,
      forwared_message: n.forwared_message,
      forwarded_message_id: n.forwarded_message_id,
      forwared_by_user_id: n.forwared_by_user_id,
      forwared_date: n.forwared_date,
      forwared_by_user_name: n.forwared_by_user_name,
      chat_group: n.chat_group,
      email_id: n.email_id,
      doc_id: n.doc_id,
      toolinvocations: n.toolinvocations,
      parts: n.parts,
      usage: n.usage,
      business_name: n.business_name,
      business_number: n.business_number,
      charttype: n.charttype,
      chartdata: n.chartdata,
      chartoptions: n.chartoptions,
      text: n.text,
      story_json: n.story_json,
      db_connection_json: n.db_connection_json,
      selected_form_id: n.selected_form_id,
      table_columns: n.table_columns,
      chart: n.chart,
      api_connection_json: n.api_connection_json,
      story_api: n.story_api,
      read_status: n.read_status || false,
      archive_status: n.archive_status || false,
      cards: n.cards,
      created_at: n.created_at,
      updated_at: n.updated_at,
      deleted_at: n.deleted_at,
      group_id: n.group_id,
      toolinvocations2: n.toolinvocations2,
      analysisprompt: n.analysisprompt,
      suggestions: n.suggestions,
      initialmsg: n.initialmsg,
      jsondata: n.jsondata,
      assistantid: n.assistantid,
      attachments_json: n.attachments_json,
      prompt_tokens: n.prompt_tokens,
      completion_tokens: n.completion_tokens,
      total_tokens: n.total_tokens,
      prompt_uuid: n.prompt_uuid,
    }));

    return NextResponse.json(notifications, { status: 200 });
  } catch (e: unknown) {
    console.error("Error in GET notifications:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.user_catalog_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, favorite, archive_status, read_status } = body || {};

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (favorite !== undefined) updateData.favorite = favorite;
    if (archive_status !== undefined) updateData.archive_status = archive_status;
    if (read_status !== undefined) updateData.read_status = read_status;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: updated, error } = await postgrest
      .from("notifications")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", session.user.user_catalog_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating notification:", error);
      return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: updated.id,
        favorite: updated.favorite || false,
        archive_status: updated.archive_status || false,
        read_status: updated.read_status || false,
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

