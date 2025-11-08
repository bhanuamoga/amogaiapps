import { getApiKey } from "@/app/(authenticated)/store-sales-dashboard/actions";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";

/**
 * POST /api/store-sales-dashboard/chat
 *
 * Body:
 * {
 *   "contextData": <array or object>,
 *   "queryData": <string>
 * }
 */
export async function POST(req: Request) {
  try {
    const { contextData, queryData } = await req.json();

    if (!contextData || !queryData) {
      return Response.json(
        { error: "Missing contextData or queryData." },
        { status: 400 }
      );
    }

    // 🔐 Get keys from DB
    const apiKeyData = await getApiKey();
    const apiKeysArray = apiKeyData?.[0]?.aiapi_connection_json;

    if (!apiKeysArray?.length) {
      return Response.json(
        { error: "No AI API keys found in database." },
        { status: 500 }
      );
    }

    // Pick default or first key
    const defaultKey =
      apiKeysArray.find((k: any) => k.default) || apiKeysArray[0];

    if (!defaultKey?.key) {
      return Response.json(
        { error: "Default AI API key missing key value." },
        { status: 500 }
      );
    }

    const provider = defaultKey.provider?.toLowerCase();

    // 🧠 Initialize LangChain model
    let model: any;
    if (provider === "openai") {
      model = new ChatOpenAI({
        apiKey: defaultKey.key,
        modelName: defaultKey.model || "gpt-4o-mini",
        temperature: 0.3,
      });
    } else if (provider === "google") {
      model = new ChatGoogleGenerativeAI({
        apiKey: defaultKey.key,
        model: defaultKey.model || "gemini-2.0-pro",
        temperature: 0.3,
      });
    } else {
      return Response.json(
        { error: `Unsupported AI provider: ${defaultKey.provider}` },
        { status: 400 }
      );
    }

    // 🧩 LangChain prompt template — returns text, chart, and table
                const prompt = ChatPromptTemplate.fromTemplate(`
            You are an AI assistant. Answer user queries strictly using ONLY the provided contextData (JSON array).

            If the answer cannot be found in the contextData, reply with:
            {{"error": "Insufficient data to answer the query."}}

            ALWAYS use this output schema for all answers:
            {{
            "text": "<human-readable summary>",
            "chartType": "<bar|line|pie|null>",
            "chartData": <valid Chart.js data or null>,
            "chartOptions": <valid Chart.js options or null>,
            "table": <table object with columns and data arrays or null>
            }}

            Instructions:
            1. For simple queries like totals, output only "text".
            2. For "top N" queries (like top 5 products or customers):
                - Locate the right leaderboard in contextData by id.
                - Sort descending by relevant numeric metric.
                - Output top N items (default 5).
                - Return:
                    - "text" summary,
                    - "chartType" = "bar",
                    - valid "chartData" for Chart.js,
                    - "chartOptions" with title,
                    - "table" (with columns & data for top N).
            3. Don't hallucinate or use data not in contextData.

            Example chartData:
            {{
            "labels": ["A", "B"],
            "datasets": [{{ "label": "Net Sales", "data": [1000, 800] }}]
            }}

            Example table:
            {{
            "columns": ["Name", "Net Sales"],
            "data": [["A", 1000], ["B", 800]]
            }}

            User question:
            {queryData}

            Context data:
            {contextData}
        `);

    // 🧩 JSON output parser
    const parser = new JsonOutputParser();

    // 🔗 Chain prompt → model → parser
    const chain = prompt.pipe(model).pipe(parser);

    // 🚀 Invoke the chain
    const result = await chain.invoke({
      contextData: JSON.stringify(contextData, null, 2),
      queryData,
    });
      console.log('LangChain result:', result);

    // 🧾 Safe structured output (returns table always)
    const safeResponse = {
      text: result.text || "No summary provided.",
      chartType: result.chartType || null,
      chartData: result.chartData || null,
      chartOptions: result.chartOptions || null,
      table: result.table || null,           // <-- TABLE is returned!
    };

    return Response.json(safeResponse);
  } catch (error) {
    console.error("LangChain AI error:", error);
    return Response.json(
      { error: "Failed to generate AI response.", details: String(error) },
      { status: 500 }
    );
  }
}
