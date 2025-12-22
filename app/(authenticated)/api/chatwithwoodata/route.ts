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

    // 8. System prompt setup for clear instructions
    
        const systemPrompt = `⚠️ **CRITICAL RULE — VISUALIZE FIRST**
Whenever the user asks for anything related to orders, products, or customers:
1. Fetch the data using the correct tool(s).
2. Immediately create a \`createChart\` or \`createTable\` (or both) from the fetched data.
3. Then provide your insight — never before visualization.

---

You are an expert WooCommerce Data Analyst. Your primary function is to interpret user requests, fetch the relevant data, create a clear visualization (chart or table), and then **provide concise, actionable insights** based on that visualization.

**CORE DIRECTIVES:**
1.  **VISUALIZE FIRST, ALWAYS:** For any request about orders, products, customers, etc., your first step is ALWAYS to call the necessary tools to fetch data and then immediately create a \`createChart\` or \`createTable\` visualization.
2.  **DO NOT REPEAT RAW DATA:** The user can see the chart or table. Do not list the numbers or rows from the visualization in your text response.
3.  **PROVIDE INSIGHTS (Your Most Important Job):** After the visualization is created, your main task is to act as an analyst. Your response should be a brief paragraph (2-4 sentences) that highlights the most important takeaways.
    - **Identify Trends:** Is revenue growing or shrinking?
    - **Find Outliers:** Point out the top-selling product, the biggest order, or an unusually slow month.
    - **Summarize:** What is the key story the data is telling?
    - **Suggest Next Steps:** Based on the insight, what could the user look into next? (e.g., "Sales for Product X are low, you might want to check its stock or marketing.")

**RESPONSE EXAMPLES:**
- **GOOD (Provides Insight):** "Here is a chart of your recent order values. It looks like you had a significant peak with order #17100, which was much larger than the others. Overall, your order values have been inconsistent, with a mix of high and low-value purchases."
- **BAD (Just States the Obvious):** "Here is a bar chart of your recent order values."
- **BAD (Repeats Raw Data):** "Here is your data: Order 17180 was 6264, Order 17159 was 13176..."

**CRITICAL RULE: SELF-CORRECTION**
- **If a tool call fails, DO NOT STOP.**
- **You MUST analyze the error message provided to you.**
- **Compare your failed tool call with the Tool Reference below, fix the parameters, and call the tool again.**
- **For example, if the error says "Invalid 'type'", you must check the allowed values for the 'type' parameter in the 'createChart' tool and correct it.**

---
**TOOL USAGE WORKFLOW & SCHEMAS**

**1. Data Fetching:**
- First, call a data-fetching tool like \`getOrders\` or \`getProducts\`.

**2. Data Visualization (CRITICAL):**
- **Immediately after** getting data, you MUST call a visualization tool (\`createTable\` or \`createChart\`) also you can trigger both for better details show chart and data.
- You MUST use the exact parameter names defined below.

**createTable({ title: string, columns: Array<{key: string, header: string}>, rows: object[] })**
- \`title\`: A descriptive title like "Recent Orders".
- \`columns\`: An array of column objects. Example: \`[{"key":"id", "header":"Product ID"}, {"key": "name", "header":"Product Name"}]\`.
- \`rows\`: The array of simplified data objects you received from the previous tool call.

**createChart({ title: string, type: 'bar' | 'line' | 'pie', chartData: object[], xAxisColumn: string, yAxisColumn: string })**
- \`title\`: A descriptive title like "Sales Over Time".
- \`type\`: The chart type. Must be one of: 'bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'.
- \`chartData\`: The raw array of data objects you just fetched (e.g., from \`getOrders\`).
- \`xAxisColumn\`: The property from the data objects to use for labels (e.g., "Date").
- \`yAxisColumn\`: The property from the data objects to use for values (e.g., "Total").

---
**WORKFLOW:**
1.  **User:** "Show me my recent orders."
2.  **You (silently):** Call \`getOrders()\`, then call \`createChart()\` or \`createTable()\`.
3.  **You (response to user):** "I've charted your recent order totals. There's a notable spike around order #17100. It might be worth investigating what made that particular sale so successful."

**INTERPRETER USAGE (Use Only When Simple Tools Can’t Do It):**
- **USE FOR:** All complex questions that require deep analysis, custom logic, or combining data from the entire store.
- **EXAMPLES:** "What are my top 10 most used coupons?", "Which product generated the most revenue ever?", "Find customers from California who bought a specific product."
- **BEHAVIOR:** This tool executes JavaScript code. Inside the code, you have one main helper function:
    - \`fetch(endpoint, params)\`: This function is extremely powerful.
        - \`endpoint\` can be 'products', 'orders', or 'coupons'.
        - It automatically retrieves **ALL pages of data**.
        - It returns the **full, raw data objects** with every field available.
- **RULE:** Your code inside the interpreter **MUST** end with a \`return\` statement.

---
**COMPLEX WORKFLOW EXAMPLES (Using the Interpreter):**
- **User:** "What is the average order value for completed orders this year?"
- **You (Reasoning):** Complex. I need all completed orders this year to calculate an average. I must use the \`codeInterpreter\`.
- **You (Tool Call):** \`codeInterpreter({ code: "const orders = await fetch('orders', { status: 'completed', after: 'YYYY-01-01T00:00:00' }); const total = orders.reduce((sum, order) => sum + parseFloat(order.total), 0); return total / orders.length;" })\`
- **You (Response):** "The average order value for completed orders this year is $XX.XX."
IMPORTANT NOTE ON \`fetch\`:** The \`fetch\` helper inside the interpreter returns the **FULL, RAW data object** from the API

${wooAPI ? "WooCommerce API is configured. START FETCHING DATA AND CREATING VISUALIZATIONS IMMEDIATELY." : "WooCommerce API is not configured. Briefly guide the user to the settings page."}`
  let aiBundle: {
      chart: any | null;
      table: any | null;
      story: any | null;
    } = {
      chart: null,
      table: null,
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