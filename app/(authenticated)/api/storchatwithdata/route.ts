"use server";

import { streamText, UIMessage, convertToCoreMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createWooCommerceTools, WooCommerceAPI } from "@/lib/ai/woomcp";
import {buildTools} from "./tools";
import { auth } from "@/auth";
import { postgrest } from "@/lib/postgrest";
import { v4 as uuidv4 } from "uuid";
import {
  saveMessageTokenUsage,
  updateChatTotals,
  saveAssistantMessage,
  saveUserMessage    // ✅ ADD THIS
} from "@/app/(authenticated)/storchatwithdata/actions";

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
      return google(modelId || "gemini-2.5-flash");
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
    const userName = session?.user?.user_name  || null;
    console.log("✅ Authenticated user ID:", userName);
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
      .select("aiapi_connection_json, db_connection_json,cdb_table_scope")
      .eq("user_catalog_id", userId)
      .single();

    if (error || !data) {
      return new Response("Failed to load user configuration", { status: 500 });
    }
   const scope = data?.cdb_table_scope ?? {};

// Allowed tables (default empty array)
const allowedTables =
  scope?.allowed_tables && Array.isArray(scope.allowed_tables)
    ? scope.allowed_tables
    : [];

// Filter only user's own rows?
const userDataFilter = scope?.user_data_filter === true;
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
   // 5. Database connection setup (READ FROM db_connection_json)

interface DBSettings {
  id?: string;
  status?: string;
  default?: boolean;
  db_connection_string?: string;
}

let dbSettings: DBSettings = {};

const dbList = Array.isArray(data.db_connection_json)
  ? data.db_connection_json
  : [data.db_connection_json];

// pick default active first, then active, then first available
dbSettings =
  dbList.find((db: DBSettings) => db.default === true && db.status === "active") ||
  dbList.find((db: DBSettings) => db.status === "active") ||
  dbList[0] ||
  {};

const dbConnectionString = dbSettings?.db_connection_string;

if (!dbConnectionString) {
  console.error("❌ No db_connection_string found in db_connection_json");
  return new Response("Missing database connection configuration", { status: 500 });
}

    // 7. Select the AI model
    const model = await selectModel(aiSettings);

    // 8. System prompt setup for clear instructions
    
        const systemPrompt = `You are a helpful database assistant that query a PostgreSQL database and provide insights about the data.

    When the user asks a question:
    1. Determine if it requires querying the database
    2. If yes, generate an appropriate SQL query using the executeSql tool
    3. Analyze the results and provide insights
    4. If the user asks for a chart, use the generateChart tool to visualize the data
    5. Before finishing your response, always generate 3-5 relevant follow-up questions using the generateSuggestions tool

    Always ensure your SQL queries:
    - If the user asks for data from a table that is not in the allowed list, respond ONLY with: "You do not have access to this table."
    - Only access tables from the allowedTables list: [${allowedTables.join(", ")}]
    - If userDataFilter is enabled, always filter data by user_name = '${userName}'
    - Use proper SQL syntax
    - Avoid using subqueries
    - Limit results to a maximum of 100 rows
    - Always use explicit column names instead of SELECT *
    - Always order results by a relevant column when applicable
    - user may type the tables and couloumn worong so use the existing once
    - Use proper joins when needed
    - Include appropriate WHERE clauses
    - Add LIMIT clauses for safety (max 100 rows) When you want display all not combine or count ...
    - Use proper column names based on the schema
    - Dont ever return the query as message to the user, you need to exucite it with executeSql tool, also make sure the query data are avilable in database shema
    
    When generating charts:
    - Choose appropriate chart types (bar, line, pie) based on the data, if user ask for a chart type you need to use the type he asked for
    - Label both axes clearly
    - Use a variety of neon colors
    - Provide analysis of the trends or patterns shown
    - Use the data from the executeSql tool to generate the chart config then pass it to the createChart tool
    - If user ask for a chart, you need to use the createChart tool to visualize the data dont ask him again
    - You should always quert the database first then generate the chart config and pass it to the createChart tool
    Be helpful, concise, and focus on answering the user's question with data.`

  let aiBundle: {
      chart: any | null;
      table: any | null;
      story: any | null;
    } = {
      chart: null,
      table: null,
      story: null,
    };

    // 9. Start streaming AI text with WooCommerce tool integration
    const result = streamText({
      model,
      system: systemPrompt,
      messages: convertToCoreMessages(messages),
      tools: buildTools(dbConnectionString,allowedTables,userDataFilter,userName) ,
      // toolChoice: "auto", 
      experimental_generateMessageId: uuidv4,
      maxSteps: 25,
      maxRetries:2,
     onStepFinish: async (step: any) => {
      console.log("🟧 STEP FINISH:", JSON.stringify(step, null, 2));
  const results = step?.toolResults ?? [];

  for (const t of results) {
    console.log("🔧 TOOL USED:", t.toolName);
      console.log("📥 TOOL RESULT:", JSON.stringify(t.result, null, 2));
    const toolName = t?.toolName ?? t?.tool;
    const res = t?.result ?? t?.toolResult ?? t;

    if (!toolName || !res) continue;

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
   console.log("🟥 FINAL RESPONSE OBJECT:", JSON.stringify(response, null, 2));
  console.log(
  "🧠 LAST ASSISTANT RAW MESSAGE:",
  response?.messages?.filter((m: { role: string; content: any }) => m.role === "assistant")?.at(-1)
);

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

    // ALWAYS SAVE STORY
    finalOutput.story = {
      type: "story",
      content: aiBundle.story?.content ?? "",
    };

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
    aiBundle = { chart: null, table: null, story: null };
  }
}


    });


    // 10. Return streaming response with appropriate headers
  return result.toDataStreamResponse({
  headers: {
    "Content-Type": "application/json",
    'Content-Encoding': 'none',
  },
  getErrorMessage: () => "An internal server error occurred."

});

  } catch (err: any) {
    console.error("❌ Chat API Error:", err);
   return new Response(JSON.stringify({ error: "An unexpected server error occurred." }), {
  status: 500,
});

  }
}