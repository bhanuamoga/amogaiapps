import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { postgrest } from "@/lib/postgrest";

interface StandardApiConfig {
  id: string;
  apiName: string;
  appName: string;
  apiUrl: string;
  apiSecret: string;
  apiKey: string;
  status?: "active" | "inactive";
}

interface AiApiConfig {
  id: string;
  provider: string;
  model: string;
  apiKey: string;
  tokensUsed?: number;
  tokensLimit?: number;
  startDate?: string;
  endDate?: string;
  defaultModel: boolean;
  status: "active" | "inactive";
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.user_catalog_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch data from Postgres
    const { data, error } = await postgrest
      .from("user_catalog")
      .select("api_connection_json, aiapi_connection_json")
      .eq("user_catalog_id", session.user.user_catalog_id)
      .single();

    if (error) {
      console.error("PostgREST error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ✅ Map API configs
    const allApiConfigs: StandardApiConfig[] = Array.isArray(data?.api_connection_json)
      ? data.api_connection_json.map((c: any) => ({
          id: c.id,
          apiName: c.apiname,
          appName: c.App_name,
          apiUrl: c.site_url,
          apiSecret: c.consumer_secret,
          apiKey: c.consumer_key,
          status: c.status,
        }))
      : [];

    // ✅ Keep only active WooCommerce APIs
    const wooApiConfigs = allApiConfigs.filter(
      (c) => c.apiName?.toLowerCase() === "woocommerce" && c.status === "active"
    );

    // ✅ Map AI configs properly to expected structure
    const allAiConfigs: AiApiConfig[] = Array.isArray(data?.aiapi_connection_json)
      ? data.aiapi_connection_json.map((c: any) => ({
          id: c.id,
          provider: c.provider,
          model: c.model,
          apiKey: c.key, // ✅ maps 'key' → 'apiKey'
          tokensUsed: 0,
          tokensLimit: c.tokens_limit,
          startDate: c.start_date,
          endDate: c.end_date,
          defaultModel: c.default || false, // ✅ maps 'default' → 'defaultModel'
          status: c.status,
        }))
      : [];

    // ✅ Only active AI models
    const activeAiConfigs = allAiConfigs.filter((c) => c.status === "active");

    // ✅ Choose default model or first active
    const defaultAi = activeAiConfigs.find((c) => c.defaultModel) || activeAiConfigs[0] || null;
    const selectedModel = defaultAi ? defaultAi.model : null;
    const selectedApi = wooApiConfigs[0] || null;

    const missing = {
      ai: activeAiConfigs.length === 0,
      api: wooApiConfigs.length === 0,
    };

    return NextResponse.json({
      aiConfigs: activeAiConfigs,
      apiConfigs: wooApiConfigs,
      selectedModel,
      selectedApi,
      missing,
    });
  } catch (e: unknown) {
    console.error("Unexpected error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
