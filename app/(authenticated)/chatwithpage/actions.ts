"use server";

import { auth } from "@/auth";
import { postgrest } from "@/lib/postgrest";

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