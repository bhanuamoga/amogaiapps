"use server";

import { streamText, UIMessage, convertToCoreMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createWooCommerceTools, WooCommerceAPI } from "@/lib/ai/woomcp";
import { auth } from "@/auth";
import { postgrest } from "@/lib/postgrest";
import { v4 as uuidv4 } from "uuid";
import {
  saveMessageTokenUsage,
  updateChatTotals,
  saveAssistantMessage,
  saveUserMessage    // ✅ ADD THIS
} from "@/app/(authenticated)/chatwithwoodata/actions";

async function selectModel(aiSettings: any) {
  const provider = aiSettings?.provider;
  const providerKey = aiSettings?.providerKey;
  const modelId = aiSettings?.model;

  if (!provider || !providerKey) {
    throw new Error("AI provider or API key missing.");
  }

  switch (provider.toLowerCase()) {
    case "google":
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey: providerKey });
      return google(modelId || "gemini-2.0-flash");
    }
    case "openai": {
      const openai = createOpenAI({ apiKey: providerKey });
      return openai(modelId || "gpt-4o-mini");
    }
    case "openrouter": {
      const openrouter = createOpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: providerKey,
      });
      return openrouter(modelId || "google/gemini-flash-1.5");
    }
    case "anthropic": {
      const anthropic = createOpenAI({
        baseURL: "https://api.anthropic.com",
        apiKey: providerKey,
      });
      return anthropic(modelId || "claude-2");
    }
    case "mistral": {
      const mistral = createOpenAI({
        baseURL: "https://api.mistral.ai/v1",
        apiKey: providerKey,
      });
      return mistral(modelId || "mistral-large-latest");
    }
    case "deepseek": {
      const deepseek = createOpenAI({
        baseURL: "https://api.deepseek.ai",
        apiKey: providerKey,
      });
      return deepseek(modelId || "deepseek-v1");
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
// =====================================================
// SIMPLE TOKEN COST CALCULATOR (GLOBAL)
// =====================================================
function calculateCost({
  promptTokens,
  completionTokens,
}: {
  promptTokens: number;
  completionTokens: number;
}) {
  const INPUT_RATE = 0.000002;
  const OUTPUT_RATE = 0.000004;

  const cost =
    promptTokens * INPUT_RATE +
    completionTokens * OUTPUT_RATE;

  return Number(cost.toFixed(6));
}
function extractStoryText(content: any): string {
  if (!content) return "";

  if (typeof content === "string") return content.trim();

  // message content sometimes is an array of parts (TextPart)
  if (Array.isArray(content)) {
    return content.map((c: any) => c?.text ?? "").join("").trim();
  }

  // or content could be object with text property
  if (typeof content === "object" && content !== null) {
    if (typeof content.text === "string") return content.text;
    // some SDKs place parts under content.parts
    if (Array.isArray((content as any).parts)) {
      return (content as any).parts.map((p: any) => p.text ?? "").join("").trim();
    }
  }

  return "";
}

export async function POST(req: Request) {
  try {
    // 1. Authenticate user
    const session = await auth();
    const userId = session?.user?.user_catalog_id;
    if (!userId) return new Response("Unauthorized", { status: 401 });

    // 2. Parse incoming request JSON
    // const { messages }: { messages: UIMessage[] } = await req.json();
    // 2. Parse incoming request JSON
const { messages, chatUuid }: { messages: UIMessage[]; chatUuid: string } =
  await req.json();

if (!chatUuid) {
  console.error("❌ Missing chatUuid in request body");
  return new Response("Missing chatUuid", { status: 400 });
}
// =====================================================
// SIMPLE TOKEN COST CALCULATOR (GLOBAL FUNCTION)
// =====================================================


    // 3. Fetch user configurations for AI and API connections
    const { data, error } = await postgrest
      .from("user_catalog" as any)
      .select("aiapi_connection_json, api_connection_json")
      .eq("user_catalog_id", userId)
      .single();

    if (error || !data) {
      return new Response("Failed to load user configuration", { status: 500 });
    }

    // 4. Select AI provider
    const aiList = Array.isArray(data.aiapi_connection_json)
      ? data.aiapi_connection_json
      : [data.aiapi_connection_json];
    const defaultAI = aiList.find((a: any) => a.default === true) || aiList[0] || {};

    const aiSettings = {
      provider: defaultAI.provider,
      providerKey: defaultAI.key,
      model: defaultAI.model,
    };

    // 5. WooCommerce API setup: obtain correct config entry
    interface WooSettings {
      site_url?: string;
      consumer_key?: string;
      consumer_secret?: string;
      apiname?: string;
      status?: string;
      url?: string;
      consumerKey?: string;
      consumerSecret?: string;
    }

    let wooSettings: WooSettings = {};
    if (Array.isArray(data.api_connection_json)) {
      wooSettings =
        data.api_connection_json.find(
          (api: WooSettings) =>
            api.apiname === "woocommerce" && api.status === "active"
        ) || data.api_connection_json[0] || {};
    } else {
      wooSettings = (data.api_connection_json as WooSettings) || {};
    }

    // 6. Initialize WooCommerce API client
    let wooAPI: WooCommerceAPI | null = null;
    if (
      wooSettings.site_url &&
      wooSettings.consumer_key &&
      wooSettings.consumer_secret
    ) {
      wooAPI = new WooCommerceAPI({
        url: wooSettings.site_url,
        consumerKey: wooSettings.consumer_key,
        consumerSecret: wooSettings.consumer_secret,
      });
    } else if (
      wooSettings.url &&
      wooSettings.consumerKey &&
      wooSettings.consumerSecret
    ) {
      wooAPI = new WooCommerceAPI({
        url: wooSettings.url,
        consumerKey: wooSettings.consumerKey,
        consumerSecret: wooSettings.consumerSecret,
      });
    }
    // 7. Select the AI model
    const model = await selectModel(aiSettings);

   
const systemPrompt = `You are a Senior WooCommerce Business Analyst and Pro AI Assistant.
Your mission is to convert WooCommerce data into clear visualizations and actionable business insights.

You NEVER hallucinate data or tools.

════════════════════════════════════
🚨 CRITICAL TOOL AVAILABILITY OVERRIDE
════════════════════════════════════

AVAILABLE TOOLS (ONLY THESE EXIST):

DATA FETCHING
- getProducts
- getOrders
- getCustomers
- getReports
- getStoreOverview
- getData

VISUALIZATION
- createCard (for single KPI values)
- createChart
- createTable
- createMap (for geographic / location-based visualizations)
COMPUTATION
- codeInterpreter

❌ FORBIDDEN TOOLS (DO NOT EXIST — NEVER CALL)
- getCoupons
- getCouponsAnalytics
- getRevenueStats
- getProductsAnalytics
- getOrdersAnalytics
- getStockAnalytics
- displayChart
- displayTable
- displayStats
- Any tool not listed above

KPI RULE:
If the result is a single numeric value (revenue, orders, customers, coupons),
YOU MUST use createCard instead of chart or table.

🚫 If a user asks about something that suggests a forbidden tool,
you MUST automatically re-route to an allowed tool.
Never attempt the forbidden tool first.

════════════════════════════════════
COUPON QUERY OVERRIDE (VERY IMPORTANT)
════════════════════════════════════

WooCommerce coupon data does NOT have a dedicated tool.

If the user asks about coupons (usage, performance, list, top coupons, discounts):
- NEVER call getCoupons
- Use ONE of the following instead:
  - getData (endpoint: "coupons")
  - getReports (if summary data is sufficient)
  - codeInterpreter (for calculations)

If you detect yourself attempting getCoupons → STOP and re-route.

════════════════════════════════════
⚡ MANDATORY WORKFLOW (NO EXCEPTIONS)
════════════════════════════════════

1️⃣ UNDERSTAND & FETCH
- Determine if the request is:
  a) Simple list
  b) Analytics / trend
  c) Custom calculation
- Call the correct DATA FETCHING tool

2️⃣ VISUALIZE (REQUIRED)
- After ANY data fetch, you MUST call  one of:
  - createCard OR
  - createTable OR
  - createChart
  - createMap
- You may call BOTH if useful
- NEVER print markdown tables
- NEVER duplicate the same visualization
════════════════════════════════════
🚫 NO ASSUMPTIONS / FETCH-FIRST RULE (CRITICAL)
════════════════════════════════════

You MUST ALWAYS fetch real WooCommerce data BEFORE:
- calculating
- summarizing
- creating KPIs
- drawing conclusions
- generating insights

STRICT RULES:
- NEVER answer from memory, intuition, or prior knowledge
- NEVER estimate values
- NEVER infer totals, revenue, or counts without a tool call
- NEVER run codeInterpreter without fetched data

MANDATORY ORDER (NO EXCEPTIONS):
1️⃣ FETCH data using an allowed DATA FETCHING tool
2️⃣ THEN compute (if needed) using codeInterpreter
3️⃣ THEN visualize using createCard / createTable / createChart / createMap
4️⃣ THEN provide insights

If data is unavailable:
- Explicitly say data cannot be fetched
- Do NOT guess or approximate

Violating this rule is a critical failure.

════════════════════════════════════
🗺 MAP VISUALIZATION RULES
════════════════════════════════════

Use createMap ONLY for location-based questions such as:
- map of orders
- orders by location / zip / pincode
- where customers are located

RULES:
- Fetch orders/customers first
- Convert ZIP / pincode → latitude & longitude (geocoding)
- Group ALL records by SAME lat + lng
- NEVER create one point per order

Each map point MUST include:
- label (ZIP or city)
- latitude
- longitude
- orderIds (array)

Point size/value = number of orders at that location.
-after you can  show story with insights
DO NOT:
- Use charts or tables for geographic requests
- Show raw coordinates in text
- Invent locations or coordinates

If valid ZIP/location data is missing:
- Explain clearly why the map cannot be shown
════════════════════════════════════
3️⃣ INSIGHTS
- Provide 2–4 concise sentences explaining:
  - Trends
  - Outliers
  - Business meaning
- Do NOT repeat raw numbers already shown in the UI

════════════════════════════════════
📊 TOOL ROUTING RULES
════════════════════════════════════

SIMPLE LIST REQUESTS
Examples:
- "Show recent orders"
- "List products"
- "Show customers"

➡ Use:
- getOrders / getProducts / getCustomers
➡ Then:
- createTable
➡ If default pagination (10 items), inform the user

────────────────────────────────────

ANALYTICS / METRICS REQUESTS
Examples:
- "Revenue this month"
- "Sales trend"
- "Order performance"

➡ Use:
- getReports OR getStoreOverview
➡ Then:
- createChart (trends)
- createTable (breakdowns)
➡ Default to last 30 days if no date range is given
➡ Tell the user the period used

────────────────────────────────────

CUSTOM / COMPLEX REQUESTS
Examples:
- "Average order value"
- "Top coupons"
- "Customers who bought X"

➡ Use:
- getData (raw Woo API)
➡ Use:
- codeInterpreter for calculations
➡ Then:
- createChart or createTable

════════════════════════════════════
📈 VISUALIZATION RULES (STRICT)
════════════════════════════════════

- Every data fetch MUST be visualized
- createChart:
  - Use bar for comparisons
  - Use line for trends
  - Use pie for composition
- createTable:
  - Use for detailed lists
- NEVER duplicate visuals
- NEVER show tool JSON
- NEVER show markdown tables

════════════════════════════════════
🛠 ERROR HANDLING & SELF-HEALING
════════════════════════════════════

If a tool call fails:
1. Analyze the error
2. Fix parameters or choose another ALLOWED tool
3. Retry immediately
4. Never switch to a forbidden tool
5. Always provide a text response explaining the outcome

Never stop after the first failure.

════════════════════════════════════
🔒 FINAL SAFETY CHECK (MANDATORY)
════════════════════════════════════

Before finishing:
- I used ONLY allowed tools
- I visualized all fetched data
- I did NOT call getCoupons
- I did NOT show tool JSON
- I provided insights after visuals

════════════════════════════════════
🔧 CONFIGURATION CHECK
════════════════════════════════════

If WooCommerce API is NOT configured:
- Do NOT fetch data
- Guide the user to the Settings page

If WooCommerce API IS configured:
- Start fetching and visualizing immediately
`
let aiBundle: {
      chart: any | null;
      table: any | null;
      card: any | null;
      map: any | null;
      story: any | null;
    } = {
      chart: null,
      table: null,
      card: null,
      map: null,
      story: null,
    };
    let streamError: string | null = null;
    // 9. Start streaming AI text with WooCommerce tool integration
    const result = streamText({
      model,
      system: systemPrompt,
      messages: convertToCoreMessages(messages),
      tools: createWooCommerceTools(wooAPI) as any,
       onError: (err: any) => {

    const msg =
      err?.data?.error?.message ??
      err?.message ??
      "Unknown stream error";

    console.error("🔥Error:", msg);

    // store message instead of throwing
    streamError = msg;
  },
      // toolChoice: "auto", 
      experimental_generateMessageId: uuidv4,
      maxSteps: 25,
      maxRetries:2,
  onStepFinish: async (step: any) => {
  const results = step?.toolResults ?? [];

  for (const t of results) {
    const toolName = t?.toolName ?? t?.tool;
    const res = t?.result ?? t?.toolResult ?? t;

    if (!toolName || !res) continue;
    if (toolName === "createCard" || toolName === "card") {
  const card = res?.cardData ?? res?.data ?? res;

  if (!card) continue;

  aiBundle.card = {
    type: "card",
    data: {
      title: card.title,
      value: card.value,
      prefix: card.prefix,
      suffix: card.suffix,
      description: card.description,
    },
  };
}

   // -------------------------------------------------------
// MAP HANDLER
// -------------------------------------------------------
if (toolName === "createMap" || toolName === "map") {
  const mapData =
    res?.mapData ??
    res?.data ??
    res;

  if (mapData?.points?.length) {
    aiBundle.map = {
      type: "map",
      data: {
        title: mapData.title ?? "Orders by Location",
        points: mapData.points,
      },
    };
  }
}

    // -------------------------------------------------------
    // FIXED UNIVERSAL CHART HANDLER
    // -------------------------------------------------------
    if (toolName === "createChart" || toolName === "chart") {
      let cfg = null;

      if (res?.chartConfig) cfg = res.chartConfig;
      else if (res?.data) cfg = res.data;
      else cfg = res;

      if (!cfg) continue;

      // Rebuild RAW rows from chartConfig (labels + dataset)
      let rawRows: any[] = [];

      if (
        cfg.data?.labels &&
        Array.isArray(cfg.data.labels) &&
        cfg.data?.datasets?.[0]?.data
      ) {
        rawRows = cfg.data.labels.map((label: any, i: number) => ({
          [cfg.xAxisColumn ?? "x"]: label,
          [cfg.yAxisColumn ?? "y"]: cfg.data.datasets[0].data[i],
        }));
      }

      aiBundle.chart = {
        type: "chart",
        data: {
          type: cfg.type ?? "bar",
          title: cfg.title ?? "Chart",
          chartData: rawRows,
          xAxisColumn: cfg.xAxisColumn ?? "x",
          yAxisColumn: cfg.yAxisColumn ?? "y",
          datasetLabel: cfg.data?.datasets?.[0]?.label ?? "Data",
          options: cfg.options ?? {},
        },
      };
    }

    // -------------------------------------------------------
    // TABLE HANDLER — RAW ALWAYS SAVED
    // -------------------------------------------------------
    if (toolName === "createTable" || toolName === "table") {
      const table = res?.tableData ?? res?.data ?? res;

      aiBundle.table = {
        type: "table",
        data: {
          title: table.title ?? "Table",
          columns: table.columns ?? [],
          rows: table.rows ?? [],
          summary: table.summary ?? table.title ?? "",
        },
      };
    }

    // -------------------------------------------------------
    // STORY HANDLER
    // -------------------------------------------------------
    if (toolName === "createStory" || toolName === "story") {
      const content =
        res?.content ??
        res?.text ??
        (typeof res === "string" ? res : "");

      aiBundle.story = {
        type: "story",
        content,
      };
    }
  }
},


   // >>> REPLACE YOUR CURRENT onFinish WITH THIS ONE <<<

 onFinish: async ({ response, usage }: any) => {
  try {
    const promptTokens = usage?.promptTokens ?? 0;
    const completionTokens = usage?.completionTokens ?? 0;
    const totalTokens =
      usage?.totalTokens ?? promptTokens + completionTokens;

    // -------------------------------
    // SAVE USER MESSAGE FIRST
    // -------------------------------
    const lastUserMessage = messages?.at(-1)?.content ?? null;
    let userMessageId: any = null;

    if (lastUserMessage) {
      try {
        const savedUser = await saveUserMessage(
          chatUuid,
          lastUserMessage
        );
        userMessageId = savedUser?.data?.id ?? null;

        if (userMessageId) {
          await saveMessageTokenUsage({
            messageId: userMessageId,
            promptTokens,
            completionTokens,
            totalTokens,
            tokenCost: calculateCost({ promptTokens, completionTokens }),
          });
        }
      } catch (err) {
        console.error("Failed to save user message:", err);
      }
    }

    // Find last assistant message content
    const lastAssistant = response?.messages
      ?.filter((m: any) => m.role === "assistant")
      ?.at(-1);

    // If NO story created, extract from lastAssistant
    if (!aiBundle.story) {
      const fallback =
        extractStoryText(lastAssistant?.content ?? "") ?? "";
      aiBundle.story = {
        type: "story",
        content: fallback,
      };
    }

    // ---------------------------------------
    // FINAL OUTPUT: ALWAYS SAVE WHAT EXISTS
    // ---------------------------------------
    let finalOutput: any = {};

    if (
      aiBundle.chart &&
      aiBundle.chart.data &&
      Array.isArray(aiBundle.chart.data.chartData)
    ) {
      finalOutput.chart = aiBundle.chart;
    }

    if (
      aiBundle.table &&
      aiBundle.table.data &&
      Array.isArray(aiBundle.table.data.rows)
    ) {
      finalOutput.table = aiBundle.table;
    }


    if (aiBundle.card && aiBundle.card.data) {
  finalOutput.card = aiBundle.card;
}

   if (aiBundle.map && aiBundle.map.data?.points?.length) {
  finalOutput.map = aiBundle.map;
}

    // ALWAYS SAVE STORY
    finalOutput.story = {
      type: "story",
      content: aiBundle.story?.content ?? "",
    };

    console.log("✅ Final AI Output to Save:", finalOutput);
    // ---------------------------------------
    // SAVE ASSISTANT MESSAGE
    // ---------------------------------------
    try {
      const savedAssistant = await saveAssistantMessage(
        chatUuid,
        lastAssistant?.id ?? null,
        finalOutput
      );

      const assistantMessageId =
        savedAssistant?.messageId ??
        savedAssistant?.data?.id ??
        null;

      if (assistantMessageId) {
        await saveMessageTokenUsage({
          messageId: assistantMessageId,
          promptTokens,
          completionTokens,
          totalTokens,
          tokenCost: calculateCost({ promptTokens, completionTokens }),
        });
      }
    } catch (err) {
      console.error("Failed to save assistant message:", err);
    }

    // update chat totals
    try {
      await updateChatTotals({
        chatId: chatUuid,
        promptTokens,
        completionTokens,
        totalTokens,
        cost: calculateCost({ promptTokens, completionTokens }),
      });
    } catch (err) {
      console.error("Failed to update chat totals:", err);
    }
  } catch (err) {
    console.error("❌ onFinish failed:", err);
  } finally {
    aiBundle = { chart: null, table: null, story: null, card: null, map: null};
  }
}


    });

   if (streamError) {
  return new Response(
    JSON.stringify({ error: streamError }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }
  );
}
    // 10. Return streaming response with appropriate headers
  return result.toDataStreamResponse({
  headers: {
    "Content-Type": "application/json",
    'Content-Encoding': 'none',
  },
  getErrorMessage: (error: unknown) => {
    if (!error) return "unknown error";
    if (typeof error === "string") return error;
    if (error instanceof Error) return error.message;
    return JSON.stringify(error);
  },
});

  } catch (err: any) {
    console.error("❌ Chat API Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}