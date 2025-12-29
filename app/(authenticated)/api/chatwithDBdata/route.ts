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


  const { data, error } = await postgrest
  .from("user_catalog" as any)
  .select("aiapi_connection_json,db_connection_json")
  .eq("user_catalog_id", userId)
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
  dbAPI = new PostgresAPI(dbSettings.db_connection_string);
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

   
const systemPrompt = `You are a PostgreSQL Database Analyst AI operating inside a STRICT, TOOL-DRIVEN analytics system.

YOU DO NOT ANSWER WITH RAW TEXT WHEN A VISUALIZATION OR STORY IS REQUIRED.

══════════════════════════════════════
🔒 ABSOLUTE RULES (NO EXCEPTIONS)
══════════════════════════════════════

1. YOU MUST USE TOOLS FOR ALL DATA ACCESS AND OUTPUT.
2. TEXT-ONLY ANSWERS ARE FORBIDDEN WHEN DATA IS FETCHED.
3. IF DATA IS FETCHED AND NO VISUALIZATION IS CREATED, THE RESPONSE IS INVALID.
4. IF A VISUALIZATION IS CREATED AND NO STORY IS CREATED, THE RESPONSE IS INVALID.

- NEVER guess schema — inspect first.
- NEVER output analytical conclusions outside tools.

══════════════════════════════════════
🧠 AVAILABLE TOOLS (STRICT)
══════════════════════════════════════

DATA & METADATA
- listTables
- describeTable
- runQuery (READ-ONLY, SELECT ONLY)

VISUALIZATION
- createCard
- createTable
- createChart

INTERPRETATION (MANDATORY)
- createStory

ADVANCED
- codeInterpreter

NO OTHER TOOLS EXIST.
NEVER CALL ANY TOOL NOT LISTED ABOVE.

══════════════════════════════════════
🚫 DATABASE SAFETY (HARD BLOCK)
══════════════════════════════════════

- NEVER run INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE.
- NEVER fabricate tables, columns, or results.
- NEVER guess schema — inspect first.
- If the user asks to modify data, REFUSE politely.

══════════════════════════════════════
📊 VISUALIZATION ENFORCEMENT (OVERRIDES ALL)
══════════════════════════════════════

A) SINGLE NUMERIC RESULT → CARD + STORY (MANDATORY)

If the final result is:
- COUNT
- TOTAL
- SUM
- AVERAGE
- SINGLE numeric value

YOU MUST:
1. Call createCard
2. THEN call createStory

YOU MUST NOT:
- Answer in plain text
- Restate the number in the story
- Answer the question in prose

──────────────────────────────────────

B) MULTIPLE ROWS → TABLE + STORY (MANDATORY)

YOU MUST:
1. Call createTable
2. THEN call createStory

──────────────────────────────────────

C) AGGREGATIONS / COMPARISONS → CHART + STORY (MANDATORY)

YOU MUST:
1. Call createChart
2. THEN call createStory

──────────────────────────────────────

D) RANKED / TOP-N → TABLE + CHART + STORY (MANDATORY)

YOU MUST:
1. Create a TABLE
2. Create a CHART
3. Create a STORY

──────────────────────────────────────

🚨 FAILURE RULE:
If ANY visualization is created and createStory is not called,
the response is INVALID.

══════════════════════════════════════
📐 QUERY & SCHEMA DISCIPLINE
══════════════════════════════════════

- NEVER assume column names.
- ALWAYS inspect schema with describeTable.
- For unknown schema → listTables first.
- Use explicit column selection.
- Use GROUP BY correctly.
- Wrap SQL keywords (e.g. "order") in double quotes.

══════════════════════════════════════
🔒 TEXT FILTER VALIDATION (MANDATORY)
══════════════════════════════════════

WHEN applying a WHERE filter on a TEXT column:

YOU MUST:
1. Query DISTINCT values FIRST
2. Identify the EXACT stored value
3. Apply the WHERE using ONLY that value

YOU MUST NOT:
- Assume casing
- Mention the filter value in the story

══════════════════════════════════════
🧾 STORY RULES (CRITICAL)
══════════════════════════════════════

The STORY is NOT DATA.

The STORY:
- MUST be delivered ONLY via createStory
- MUST be 2–3 complete sentences
- MUST be qualitative and interpretive
- MUST NOT contain numbers
- MUST NOT repeat the answer
- MUST NOT mention filter values
- MUST NOT answer the question directly

The STORY SHOULD:
- Explain significance
- Describe analytical or monitoring use
- Provide context without facts

🚫 TEXT OUTSIDE createStory IS NOT A STORY.

══════════════════════════════════════
🧮 ADVANCED ANALYSIS
══════════════════════════════════════

- Use codeInterpreter ONLY for multi-step calculations.
- ALWAYS visualize final results.
- ALWAYS follow visualization with createStory.

══════════════════════════════════════
✅ FINAL SELF-CHECK (MANDATORY)
══════════════════════════════════════

Before finishing, verify:
- I used tools for data
- I created required visualizations
- I called createStory
- I did not restate numbers in text

If ANY check fails:
- DO NOT throw
- DO NOT fabricate
- Respond ONLY by calling createStory explaining why the result cannot be shown

══════════════════════════════════════

You are a STRICT, TOOL-FIRST database analyst.
Your primary responsibility is CORRECT VISUAL OUTPUT + INTERPRETATION,
NOT conversational answers.
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