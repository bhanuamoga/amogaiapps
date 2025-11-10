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
