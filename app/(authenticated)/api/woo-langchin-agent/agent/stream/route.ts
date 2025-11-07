import { NextRequest } from "next/server";
import { streamResponse } from "@/services/langchin-agent/agentService";
import type { MessageResponse } from "@/types/langchin-agent/message";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SSE endpoint that streams incremental AI response chunks produced by the LangGraph React agent.
 * Query params:
 *  - content: user message text
 *  - threadId: (currently unused for history; placeholder for future multi-turn support)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.user_catalog_id ?? undefined;

  const { searchParams } = new URL(req.url);
  const userContent = searchParams.get("content") || "";
  const threadId = searchParams.get("threadId") || "unknown";
  const model = searchParams.get("model") || undefined;
  const provider = searchParams.get("provider") || undefined;
  const apiKey = searchParams.get("apiKey") || undefined;
  const allowTool = searchParams.get("allowTool") as "allow" | "deny" | null;
  const toolsParam = searchParams.get("tools") || "";
  const approveAllTools = searchParams.get("approveAllTools") === "true";
  const tools = toolsParam
    ? toolsParam
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  // WooCommerce credentials from request parameters
  const wooUrl = searchParams.get("woo_url");
  const wooConsumerKey = searchParams.get("woo_consumer_key");
  const wooConsumerSecret = searchParams.get("woo_consumer_secret");
  // Thread existence handled in service.

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: MessageResponse) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Initial comment to establish stream
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Run the agent streaming in the background
      (async () => {
        try {
          const iterable = await streamResponse({
            threadId,
            userText: userContent,
            userId,
            opts: {
              model,
              provider,
              apiKey,
              tools,
              allowTool: allowTool || undefined,
              approveAllTools,
              wooCommerceCredentials:
                wooUrl && wooConsumerKey && wooConsumerSecret
                  ? {
                      url: wooUrl,
                      consumerKey: wooConsumerKey,
                      consumerSecret: wooConsumerSecret,
                    }
                  : undefined,
            },
          });

          let tokenUsage = null;

          for await (const chunk of iterable) {
            // Handle token usage chunks
            if (chunk.type === "tokenUsage") {
              tokenUsage = chunk;
              continue;
            }

            // Only forward AI/tool chunks; ignore human/system
            if (chunk.type === "ai" || chunk.type === "tool") {
              send(chunk);
            }
          }

          // Send token usage update BEFORE done event
          if (tokenUsage) {
            controller.enqueue(encoder.encode("event: tokenUsage\n"));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(tokenUsage)}\n\n`));
          } else {
            console.log("No token usage data to send");
          }

          // Signal completion AFTER token usage
          controller.enqueue(encoder.encode("event: done\n"));
          controller.enqueue(encoder.encode("data: {}\n\n"));
        } catch (err: unknown) {
          // Emit an error event (client onerror will capture general network; providing data for diagnostics)
          controller.enqueue(encoder.encode("event: error\n"));
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ message: (err as Error)?.message || "Stream error", threadId })}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      })();
    },
    cancel() {
      // If client disconnects, nothing special yet (LangGraph stream will stop as iteration halts)
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
