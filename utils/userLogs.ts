"use server";

import { postgrest } from "@/lib/postgrest";
import IpAddress from "./IPAddress";
import getCurrentBrowser from "./getCurrentBrowser";

export async function saveUserLogs(payload: any) {
  try {
    const payloadData = {
      ...payload,

      // System-generated log info
      user_ip_address: await IpAddress(),
      browser: getCurrentBrowser(),

      // If user details included by caller, they overwrite undefined fields
      user_id: payload.user_id ?? null,
      user_name: payload.user_name ?? null,
      user_email: payload.user_email ?? null,
      user_mobile: payload.user_mobile ?? null,
      for_business_name: payload.for_business_name ?? null,
      for_business_number: payload.for_business_number ?? null,
      session_id: payload.user_id ?? null,
    };

    const { data, error } = await postgrest
      .from("user_log")
      .insert(payloadData);

    if (error) {
      console.error("❌ Error saving log →", error);
      throw error;
    }

    console.log("✅ Log Saved:", data);
    return { data, success: true };
  } catch (error) {
    console.error("❌ saveUserLogs Failed:", error);
    return { success: false, error };
  }
}
