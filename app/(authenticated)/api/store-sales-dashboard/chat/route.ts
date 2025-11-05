import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getApiKey } from "@/app/(authenticated)/store-sales-dashboard/actions";

export async function POST(req: Request) {
      try {
    const { contextData, queryData } = await req.json();

    // Validate request
    if (!contextData || !queryData) {
      return Response.json(
        { error: "Missing contextData or queryData." },
        { status: 400 }
      );
    }

    // Securely fetch AI API keys from DB
    const apiKeyData = await getApiKey();

    if (!apiKeyData || apiKeyData.length === 0) {
      return Response.json(
        { error: "No AI API keys found in database." },
        { status: 500 }
      );
    }

    const apiKeysArray = apiKeyData[0]?.aiapi_connection_json;

    if (!apiKeysArray || apiKeysArray.length === 0) {
      return Response.json(
        { error: "AI API keys missing in database." },
        { status: 500 }
      );
    }

    // Use the key marked as default
    const defaultKey = apiKeysArray.find((k: any) => k.default) || apiKeysArray[0];

    if (!defaultKey?.key) {
      return Response.json(
        { error: "Default AI API key missing key value." },
        { status: 500 }
      );
    }

    // Initialize model
    let modelProvider;
    if (defaultKey.provider === "google") {
      const google = createGoogleGenerativeAI({ apiKey: defaultKey.key });
      modelProvider = google(defaultKey.model || "gemini-2.5-flash");
    } else if (defaultKey.provider === "openai") {
      const openai = createOpenAI({ apiKey: defaultKey.key });
      modelProvider = openai(defaultKey.model || "gpt-4o-mini");
    } else {
      return Response.json(
        { error: `Unsupported AI provider: ${defaultKey.provider}` },
        { status: 400 }
      );
    }

    // Prepare the context data
    const data = JSON.stringify(contextData, null, 2);


    const result = await generateText({
      model: modelProvider,
      system: `
        You are an AI assistant. You must answer user queries strictly and only based on the provided context data (in JSON format). 
        If the answer cannot be found directly in the context data, respond with: {"error": "Insufficient data to answer the query."}
        Do not use any external knowledge or make assumptions beyond the context data. 
        The context data is provided to you as context for answering and the data has array of objects, and it has some objects which has data related to dates.
        So if a user asks for data related to a specific date, you must find the object that matches that date in the context data.
        If the user asks for data related to date intervals, you must check the relevant start and end date in the context data and return the relevant data.
        Also if user asks to generate a chart, based on context data, you must generate a chart data so that charts can be rendered, and generate chart data so that it can be used by chart.js to render charts.
        If the context data is improper, format it properly and understand the data properly, and if required, you can generate some calculations based on the context data to answer the query.
        Also when we user asks for data, add some relavant context to the data, and give with proper meaning.
        And sometimes, context data may not give proper and meaningful data like :
        EX: {
          "name": "18 Jun 25",
          "gross_sales": 5470.8,
          "refunds": 0,
          "coupons": 0,
          "net_revenue": 5470.8,
          "taxes": 0,
          "shipping": 0,
          "total_sales": 5470.8,
          "avg_order_value": 911.8000000000001,
          "orders_count": 6,
          "num_items_sold": 23,
          "coupons_count": 1,
          "segments": []
        }
        And user may ask any question on this like total sales, net revenue, gross sales, etc. 
        and these are like list of objects, and this may have many objects, so you must read the data properly and understand the user query and answer properly from this data, and note that only find and answer from this only when user asks for this data, and if user asks for any other data, then you must answer with the data provided in the contextData.
        Note that always try to give the data in text format, not in JSON format, so that non-technical users can understand the data properly.
        When creating a response that includes a chart, return a full JSON object like this so that it can be used to render a chart:

        {
          "text": "<summary of chart>",
          "chartType": "pie",
          "chartData": { ...valid Chart.js data... },
          "chartOptions": { ...valid Chart.js options... }
        }

        I will be using this fields for rendering the text and chart in the UI, so make sure to return these fields properly. 
        Send the response in a valid JSON format, and make sure to include the chartType, chartData, and chartOptions fields if you are generating a chart. Make sure you parse it properly and returna a valid JSON to rendercharts

        Your response must be a valid JSON object that directly addresses the query. ${data}`,
      prompt: queryData,
    });

    const { text, usage } = result;
    let cleanedText = text.trim();

    // Clean code fences (```json ... ```)
    cleanedText = cleanedText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/, "")
      .trim();

    // Parse JSON output safely
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(cleanedText);
    } catch (err) {
      console.error("Failed to parse AI response JSON:", cleanedText, err);
      return Response.json({ text: cleanedText }, { status: 200 });
    }

    // Validate shape of response
    if (typeof jsonResponse !== "object" || Array.isArray(jsonResponse)) {
      return Response.json(
        { text: cleanedText, warning: "AI response was not a valid object." },
        { status: 422 }
      );
    }

    // Ensure all required fields exist
    jsonResponse.text ??= "No summary provided.";
    jsonResponse.chartType ??= null;
    jsonResponse.chartData ??= null;
    jsonResponse.chartOptions ??= null;

    return Response.json({ text: jsonResponse, usage });
  } catch (error) {
    console.error("AI generation error:", error);
    return Response.json(
      { error: "Failed to generate AI response." },
      { status: 500 }
    );
  }
}