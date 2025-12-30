"use server";

import { streamText, UIMessage, convertToCoreMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { auth } from "@/auth";
import { postgrest } from "@/lib/postgrest";
import { v4 as uuidv4 } from "uuid";
import {
  saveMessageTokenUsage,
  updateChatTotals,
  saveAssistantMessage,
  saveUserMessage    // ✅ ADD THIS
} from "@/app/(authenticated)/chatwithDBdata/actions";
import { createPostgresTools, PostgresAPI } from "@/lib/ai/dbMcp";



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
    const userEmail = session?.user?.user_email ?? undefined;

    const rawUserId = session?.user?.user_catalog_id;

if (!rawUserId) {
  return new Response("Unauthorized", { status: 401 });
}

// number → Supabase / PostgREST
const userCatalogId = rawUserId;

// string → SQL / PostgresAPI scope
const userId = String(rawUserId);
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
console.log({
  userCatalogId, // number
  userId,        // string
  userEmail,
});


  const { data, error } = await postgrest
  .from("user_catalog" as any)
  .select("aiapi_connection_json,db_connection_json")
  .eq("user_catalog_id", userCatalogId)
  .single();

// ✅ ADD THIS CHECK HERE
if (error || !data) {
  return new Response("Failed to load user configuration", { status: 500 });
}

// =====================================================
// DATABASE CONNECTION SETUP (SAFE NOW)
// =====================================================

interface DBSettings {
  status?: string;
  default?: boolean;
  db_connection_string?: string;
  user_scope?: boolean;
}

let dbSettings: DBSettings | null = null;

if (Array.isArray(data.db_connection_json)) {
  dbSettings =
    data.db_connection_json.find(
      (db: DBSettings) =>
        db.status === "active" && db.default === true
    ) ||
    data.db_connection_json.find(
      (db: DBSettings) => db.status === "active"
    ) ||
    null;
}

let dbAPI: PostgresAPI | null = null;

if (dbSettings?.db_connection_string) {
  dbAPI = new PostgresAPI(
  dbSettings.db_connection_string,
  {
    userScopeEnabled: dbSettings.user_scope === true,
    userEmail,
  }
);

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

   
    // 7. Select the AI model
    const model = await selectModel(aiSettings);

   
const systemPrompt = `You are the PostgreSQL Analytical Engine. You operate in a headless, tool-first environment.

══════════════════════════════════════
🔒 CORE OPERATING PRINCIPLES (STRICT)
══════════════════════════════════════
1. NO RAW TEXT: All responses MUST be produced via tools.
2. NO NUMBERS IN STORIES: Quantitative values are ONLY for visuals.
3. FIXED NARRATIVE: Stories MUST follow the architecture below.
4. READ-ONLY: You must NEVER modify data.
5. SCHEMA FIRST: You must always inspect schema before querying.

══════════════════════════════════════
🧠 AVAILABLE TOOLSET
══════════════════════════════════════
DB ACCESS
- listTables
- describeTable
- runQuery

VISUALS
- createCard (KPIs)
- createTable (Lists)
- createChart (Trends)

INSIGHTS
- createStory (MANDATORY)
- suggestActions (MANDATORY)

ANALYSIS
- codeInterpreter (Forecasting & math only)

══════════════════════════════════════
🧩 TOOL EXECUTION ORDER (MANDATORY)
══════════════════════════════════════
You MUST call tools in this exact order:

1. One or more of:
   - createCard
   - createTable
   - createChart

2. createStory (REQUIRED)

3. suggestActions (REQUIRED)

Calling suggestActions before createStory is INVALID.
Calling createStory before visuals is INVALID.

══════════════════════════════════════
🧮 DATABASE RULES (STRICT)
══════════════════════════════════════
- Always call describeTable before runQuery.
- Do not assume column casing or values.
- Query DISTINCT values before filtering.
- Block INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE.

══════════════════════════════════════
📊 createCard RULES (STRICT)
══════════════════════════════════════
When calling createCard:
- description is REQUIRED
- description must be a qualitative phrase (5–10 words)
- description must NOT contain numbers
- description must explain meaning, not quantity

INVALID:
- "Total revenue is 5000"
- "17 orders processed"

VALID:
- "Customer activity remains consistent"
- "Order volume shows stable behavior"

══════════════════════════════════════
📐 FIXED STORY ARCHITECTURE (STRICT)
══════════════════════════════════════
Every createStory call MUST contain EXACTLY 3 sentences.

Sentence 1 – Observation:
"The dataset demonstrates a [adjective] [trend/status] regarding [subject]."

Sentence 2 – Insight:
"This behavior indicates that [business factor] is [impacting/driving] the current system state."

Sentence 3 – Forecast:
"Based on existing velocity, the system expects [stable/shifting] performance in the upcoming cycle."

Rules:
- Do NOT include numbers
- Do NOT include percentages
- Do NOT reference raw data values

══════════════════════════════════════
🔮 PREDICTION RULES
══════════════════════════════════════
When a prediction or forecast is requested:
1. Fetch historical data using runQuery
2. Use codeInterpreter to calculate a simple trend line
3. Visualize using createChart
4. Describe direction ONLY using createStory

══════════════════════════════════════
🔘 suggestActions RULES (STRICT)
══════════════════════════════════════
You MUST always generate EXACTLY 4 actions.

Each action MUST:
- Be a natural-language question or instruction
- Be directly related to the visual or metric just created
- Be suitable for direct insertion into the chat input
- NOT be generic

INVALID ACTIONS:
- "Drill Down"
- "Comparative"
- "Predictive"

VALID ACTIONS:
- "Show order count grouped by customer"
- "Compare tax trends across recent periods"
- "Predict future order volume behavior"
- "Analyze revenue changes by product category"
══════════════════════════════════════
🚫 SAFETY & VALIDATION
══════════════════════════════════════
- Reject destructive queries via createStory.
- Reject responses with raw text.
- Reject stories containing numbers.
- Reject missing description in createCard.

Final Verification:
If ANY response contains:
- Raw text outside tools
- Numbers inside a story
- Missing createStory
- Missing suggestActions
- Incorrect tool order

→ THE RESPONSE IS INVALID.

DATABASE NAMING RULES (STRICT)
- Never pluralize table names.
- Always use exact table names returned by listTables.
- If a table name is a reserved keyword (e.g., order), it MUST be double-quoted.
- Always prefer schema-qualified names: public."order"
`
let aiBundle: {
      chart: any | null;
      table: any | null;
      card: any | null;
      map: any | null;
      story: any | null;
      actions: any | null;
    } = {
      chart: null,
      table: null,
      card: null,
      map: null,
      story: null,
      actions: null,
    };
    let streamError: string | null = null;
    // 9. Start streaming AI text with WooCommerce tool integration

    if (!dbAPI) {
  return new Response(
    JSON.stringify({
      error: "Database not configured. Please add a database connection in Settings.",
    }),
    { status: 400 }
  );
}

    const result = streamText({
      model,
      system: systemPrompt,
      messages: convertToCoreMessages(messages),
      tools: createPostgresTools(dbAPI) as any,

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
    // if (toolName === "createStory" || toolName === "story") {
    //   const content =
    //     res?.content ??
    //     res?.text ??
    //     (typeof res === "string" ? res : "");

    //   aiBundle.story = {
    //     type: "story",
    //     content,
    //   };
    // }


// -------------------------------------------------------
// STORY HANDLER (FIXED)
// -------------------------------------------------------
if (toolName === "createStory" || toolName === "story") {
  const content =
    res?.storyData?.text ??
    res?.text ??
    res?.content ??
    "";

  aiBundle.story = {
    type: "story",
    content,
  };
}




    // -------------------------------------------------------
// ACTIONS HANDLER
// -------------------------------------------------------
if (toolName === "suggestActions" || toolName === "actions") {
  const actions =
    res?.actions ??
    res?.data?.actions ??
    [];

  if (Array.isArray(actions) && actions.length) {
    aiBundle.actions = {
      type: "actions",
      data: actions,
    };
  }
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
    if (!aiBundle.story || !aiBundle.story.content?.trim()) {
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
if (aiBundle.actions?.data?.length) {
  finalOutput.actions = aiBundle.actions;
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
    aiBundle = { chart: null, table: null, story: null, card: null, map: null, actions: null};
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