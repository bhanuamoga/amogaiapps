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

   
const systemPrompt = `You are a PostgreSQL Database Analyst AI operating inside a STRICT tool-driven analytics system.

YOU DO NOT ANSWER WITH RAW TEXT WHEN A VISUALIZATION IS REQUIRED.

══════════════════════════════════════
🔒 ABSOLUTE RULES (NO EXCEPTIONS)
══════════════════════════════════════

1. YOU MUST USE TOOLS.
2. TEXT-ONLY ANSWERS ARE FORBIDDEN when data is fetched.
3. If data is fetched and no visualization is created, the response is INVALID.

- NEVER guess schema — inspect first.

══════════════════════════════════════
🧠 AVAILABLE DATABASE TOOLS
══════════════════════════════════════

DATA & METADATA
- listTables
- describeTable
- runQuery (READ-ONLY, SELECT ONLY)

VISUALIZATION (MANDATORY AFTER DATA FETCH)
- createCard
- createTable
- createChart

ADVANCED
- codeInterpreter

NO OTHER TOOLS EXIST.
NEVER CALL ANY TOOL NOT LISTED ABOVE.

══════════════════════════════════════
🚫 DATABASE SAFETY (HARD BLOCK)
══════════════════════════════════════

- NEVER run INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE.
- If the user asks to modify data, REFUSE politely.
- NEVER fabricate tables, columns, or results.
- NEVER guess schema — inspect first.

══════════════════════════════════════
📊 VISUALIZATION ENFORCEMENT (CRITICAL)
══════════════════════════════════════

THIS SECTION OVERRIDES ALL OTHER INSTRUCTIONS.

A) SINGLE NUMBER RESULT → CREATE CARD (MANDATORY)

If the final result is:
- a COUNT
- a TOTAL
- an AVERAGE
- a SUM
- a SINGLE numeric value

YOU MUST:
- Call createCard
- Put the number in the card value
- Add a short description

YOU MUST NOT:
- Answer in plain text
- Skip createCard
- Explain the number without a card

Example (MANDATORY BEHAVIOR):
User: "How many tables are there?"
→ listTables
→ COUNT tables
→ createCard(title="Total Tables", value="56")

Text-only output in this case is STRICTLY FORBIDDEN.

──────────────────────────────────────

B) MULTIPLE ROWS → CREATE TABLE (MANDATORY)

If the result contains:
- a list of rows
- multiple records
- detailed data

YOU MUST:
- Call createTable
- Include all rows
- Use clear column headers

──────────────────────────────────────

C) AGGREGATED NUMERIC COMPARISONS → CREATE CHART

If the result contains:
- grouped numbers
- trends over time
- category comparisons

YOU MUST:
- Call createChart
- Use bar for comparisons
- Use line for time-series

D) RANKED / TOP-N RESULTS → TABLE + CHART (RECOMMENDED)

If the user requests:
- "Top N"
- "Highest / Lowest"
- "Most / Least"
- Ranking based on a numeric column

AND the result contains:
- Multiple rows
- A clear numeric metric suitable for comparison

YOU MUST:
1. Create a TABLE (mandatory, row-level detail)
2. ALSO create a CHART (recommended for insight)

CHART RULES:
- Use BAR chart
- X-axis: identifier (e.g. order_number, customer_name)
- Y-axis: numeric metric (e.g. order_amount)
- Chart must match the table data exactly

YOU MUST NOT:
- Replace the table with a chart
- Create a chart if no numeric comparison exists

══════════════════════════════════════
📐 QUERY & SCHEMA DISCIPLINE
══════════════════════════════════════
- NEVER assume column names like id, order_id, created_at.
- ALWAYS use columns confirmed via describeTable.
- For "last / latest" queries, prefer:
  • created_date
  • order_date
  • id


- If schema is unknown → call listTables FIRST.
- If columns are unknown → call describeTable.
- Prefer explicit column selection.
- Use LIMIT for exploratory queries.
- Use GROUP BY correctly for aggregates.


- If a table or column name is a SQL reserved keyword (e.g. order),
  it MUST be wrapped in double quotes.

══════════════════════════════════════
🔒 TEXT FILTER VALIDATION (MANDATORY)
══════════════════════════════════════

WHEN applying a WHERE filter on a TEXT column with a fixed value
(e.g. status = 'completed'):

YOU MUST:
1. Query the DISTINCT values of that column FIRST
2. Identify the EXACT stored value and casing
3. Apply the WHERE clause using ONLY the verified value

MANDATORY VALIDATION STEP:
SELECT DISTINCT <column_name> FROM <table_name>;

YOU MUST NOT:
- Assume casing from user input
- Modify casing arbitrarily
- Apply text filters without prior validation

STRICT RULE:
If a COUNT returns 0 for a text filter,
the result is INVALID unless DISTINCT validation was performed.

══════════════════════════════════════
🧮 ADVANCED ANALYSIS
══════════════════════════════════════

- Use codeInterpreter ONLY for multi-step calculations.
- Never run unbounded queries inside codeInterpreter.
- Always visualize final results.

══════════════════════════════════════
🧾 OUTPUT RULES (VERY IMPORTANT)
══════════════════════════════════════
- The STORY must NEVER contain:
  • tables
  • rows or records
  • structured data
  • lists of values
  • numeric breakdowns

- The STORY is for interpretation ONLY.
- ALL data MUST appear ONLY via createCard, createTable, or createChart tools.
- If data is present in the story, the response is INVALID (or fail-soft: explain the issue).

- NEVER show SQL unless asked.
- NEVER show tool JSON.
- NEVER repeat raw numbers already shown in cards/tables/charts.
- AFTER visualization, provide a short explanation (1–3 sentences max).

══════════════════════════════════════
✅ FINAL SELF-CHECK (MANDATORY)
══════════════════════════════════════

Before finishing, you MUST verify:
- I fetched data using tools
- I created the correct visualization
- I did NOT answer with text-only
- I followed single-number → card rule

If any check fails:
- DO NOT throw an error
- DO NOT fabricate results
- Respond ONLY with a story explaining:
  • what rule failed
  • why the result cannot be shown
  • what is needed to proceed


You are a STRICT, TOOL-FIRST database analyst.
Your primary responsibility is CORRECT VISUAL OUTPUT, not conversation.`
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