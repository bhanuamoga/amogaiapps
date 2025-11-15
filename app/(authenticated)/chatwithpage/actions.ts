"use server";

import { auth } from "@/auth";
import { postgrest } from "@/lib/postgrest";
import { v4 as uuidv4 } from "uuid";

export async function getApiKey() {
  const session = await auth();
  try {
    const { data, error } = await postgrest
      .from("user_catalog" as any)
      .select("aiapi_connection_json")
      .eq("user_catalog_id", session?.user?.user_catalog_id);
    if (error) throw error;

    // Return only 'model' from each AI API entry within the JSON
    return data?.[0]?.aiapi_connection_json.map((item: any) => ({
      model: item.model,
    })) || [];
  } catch (error) {
    throw error;
  }
}


export async function getApis() {
  const session = await auth();
  try {
    const { data, error } = await postgrest
      .from("user_catalog" as any)
      .select("api_connection_json")
      .eq("user_catalog_id", session?.user?.user_catalog_id);
    if (error) throw error;

    // Return only 'site_url' from each API entry within the JSON
    return data?.[0]?.api_connection_json.map((item: any) => ({
      site_url: item.site_url,
    })) || [];
  } catch (error) {
    throw error;
  }
} 
export async function saveChatTitle(chatUuid: string, title: string,chat_share_url?: string) {
  const session = await auth();
  const userId = session?.user?.user_catalog_id;
  const userEmail = session?.user?.user_email;
  const businessname =session?.user?.business_name;
//   console.log("hellpo chat  : "+ chat_share_url)
  try {
    const { data, error } = await postgrest
      .from("chat" as any)
      .upsert([
        {
          id: chatUuid, // ✅ store frontend UUID here
          title,
          user_id: userId,
          user_email: userEmail,
          business_name:businessname,
          chat_group: "Chat With Page",
          status:"active",
          visibility:"yes",
          bookmark:"false",
          chat_share_url: chat_share_url ?? null, // ✅ store session user ID (string)
        },
      ])
      .select("*");

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error("Error saving chat:", err);
    return { success: false, error: (err as Error).message };
  }
}

/* ---------------------- UPDATE CHAT TITLE ---------------------- */
export async function updateChatTitle(chatUuid: string, title: string,chat_share_url?: string) {
  const session = await auth();
  const userId = session?.user?.user_catalog_id;
  
  if (!userId) throw new Error("Unauthorized: No valid session or user ID found.");
    const updateData: Record<string, any> = { title };
    if (chat_share_url) updateData.chat_share_url = chat_share_url;


  try {
    const { data, error } = await postgrest
      .from("chat" as any)
      .update(updateData)
      .eq("id", chatUuid) // ✅ compare by uuid column
      .eq("user_id", userId)
      .select("*");

    if (error) throw error;

    if (!data || data.length === 0)
      return { success: false, error: "Chat not found or not owned by user." };

    return { success: true, data };
  } catch (err) {
    console.error("Error updating chat title:", err);
    return { success: false, error: (err as Error).message };
  }
}


/* =======================================================
   SAVE MESSAGE TO message TABLE  (Chat With Page)
========================================================= */


export async function saveUserMessage(chatId: string, content: string) {
  const session = await auth();
  const userId = session?.user?.user_catalog_id;

  if (!userId) throw new Error("Unauthorized");

  const promptUuid = uuidv4(); // unique UUID per user prompt

  const { data, error } = await postgrest
    .from("message")
    .insert([
      {
        chatId: chatId,
        ref_chat_uuid: chatId,
        user_id: userId,
        role: "user",
        content,             // USER text only
        prompt_uuid: promptUuid,
        ref_prompt_uuid: promptUuid,
        response_json: null,
        prompt_tiitle: content // no assistant JSON
      },
    ])
    .select("*")
    .single();

  if (error) throw error;

  return { success: true, prompt_uuid: promptUuid, data };
}


/* =======================================================
   SAVE ASSISTANT MESSAGE
   - role: "assistant"
   - response_json saved fully
   - content = null (assistant text lives inside JSON)
======================================================= */
export async function saveAssistantMessage(
  chatId: string,
  promptUuid: string,
  responseJson: any
) {
  const session = await auth();
  const userId = session?.user?.user_catalog_id;

  if (!userId) throw new Error("Unauthorized");

  const { data, error } = await postgrest
    .from("message")
    .insert([
      {
        chatId: chatId,
        ref_chat_uuid: chatId,
        user_id: userId,
        role: "assistant",
        content: null,        // assistant text NOT saved here
        // prompt_uuid: promptUuid,
        response_json: responseJson,
        message_group: responseJson // full OpenAI result
      },
    ])
    .select("*")
    .single();

  if (error) throw error;

  return { success: true, data };
}

function mapDbMessageToUI(msg: any) {
  if (msg.role === "user") {
    return {
      role: "user",
      content: msg.content || "",
    };
  }

  if (msg.role === "assistant") {
    const r = msg.response_json;
    if (!r) return null;

    const results: any[] = [];

    // 1️⃣ Assistant chart
    if (r.chart) {
      results.push({
        role: "assistant",
        content: {
          type: "chart",
          data: r.chart.data,
        },
      });
    }

    // 2️⃣ Assistant table
    if (r.table) {
      results.push({
        role: "assistant",
        content: {
          type: "table",
          data: r.table.data,
        },
      });
    }

    // 3️⃣ Assistant story / explanation text
    if (r.story && typeof r.story.content === "string") {
      results.push({
        role: "assistant",
        content: r.story.content,
      });
    }

    // If nothing matched
    if (results.length === 0) return null;

    return results; // IMPORTANT: return ARRAY because 1 assistant message can contain chart + table + story
  }

  return null;
}

export async function loadChat(chatId: string) {
  const session = await auth();
  const userId = session?.user?.user_catalog_id;
  if (!userId) throw new Error("Unauthorized");

  const { data: chat, error: chatError } = await postgrest
    .from("chat")
    .select("*")
    .eq("id", chatId)
    .eq("user_id", userId)
    .eq("chat_group", "Chat With Page")
    .single();

  if (chatError || !chat) throw new Error("Chat not found or unauthorized.");

  const { data: rows, error: messageError } = await postgrest
    .from("message")
    .select("*")
    .eq("chatId", chatId)
    .order("created_at", { ascending: true });

  if (messageError) throw new Error("Could not load messages");

  const messages: any[] = [];

  for (const row of rows) {
    const mapped = mapDbMessageToUI(row);

    if (!mapped) continue;

    // If mapper returns multiple messages
    if (Array.isArray(mapped)) {
      messages.push(...mapped);
    } else {
      messages.push(mapped);
    }
  }

  return { chat, messages };
}
/* =======================================================
   UPDATE MESSAGE FIELDS (ROLE-BASED)
   user  → favorite, flag
   assistant → isLike, favorite, flag
======================================================= */

export async function updateMessageFields({
  messageId,
  isLike,
  favorite,
  flag,
}: {
  messageId: string;
  isLike?: boolean | null;   // assistant only
  favorite?: boolean;        // both
  flag?: boolean;            // both
}) {
  const session = await auth();
  const userId = session?.user?.user_catalog_id;

  if (!userId) throw new Error("Unauthorized");

  try {
    /* -------------------------------
       1️⃣ Fetch message with role + chatId
    --------------------------------*/
    const { data: msg, error: msgError } = await postgrest
      .from("message")
      .select("id, role, chatId")
      .eq("id", messageId)
      .single();

    if (msgError || !msg) throw new Error("Message not found");

    /* -------------------------------
       2️⃣ Validate chat ownership
    --------------------------------*/
    const { data: chat, error: chatError } = await postgrest
      .from("chat")
      .select("user_id")
      .eq("id", msg.chatId)
      .single();

    if (chatError || !chat) throw new Error("Chat not found");

    if (chat.user_id !== userId) {
      throw new Error("Unauthorized: You do not own this chat");
    }

    /* -------------------------------
       3️⃣ ROLE-BASED PERMISSION LOGIC
    --------------------------------*/
    const updateData: Record<string, any> = {};

    if (msg.role === "assistant") {
      // Allowed: like, dislike, favorite, flag
      if (typeof isLike !== "undefined") updateData.isLike = isLike;
      if (typeof favorite !== "undefined") updateData.favorite = favorite;
      if (typeof flag !== "undefined") updateData.flag = flag;
    }

    else if (msg.role === "user") {
      // Allowed: favorite, flag only
      if (typeof favorite !== "undefined") updateData.favorite = favorite;
      if (typeof flag !== "undefined") updateData.flag = flag;

      // ❌ Not allowed for user:
      if (typeof isLike !== "undefined") {
        throw new Error("User messages cannot be liked or disliked.");
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error("No valid fields provided for this message role.");
    }

    /* -------------------------------
       4️⃣ Perform update
    --------------------------------*/
    const { data, error } = await postgrest
      .from("message")
      .update(updateData)
      .eq("id", messageId)
      .select("*")
      .single();

    if (error) throw error;

    return { success: true, data };

  } catch (err) {
    console.error("updateMessageFields error:", err);
    return { success: false, error: (err as Error).message };
  }
}
