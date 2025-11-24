import { getLogger } from "./logs-exporter";

export function logEvent(
  body: string,
  attributes: Record<string, any> = {}
) {
  console.log("🚀 logEvent called:", body, attributes);

  const logger = getLogger();

  if (!logger) {
    console.log("❌ Logger not initialized — skipping emit");
    return;
  }

  console.log("✅ Logger found — emitting event to OTEL exporter");

  try {
    logger.emit({
      body,
      attributes: {
        ts: Date.now(),
        ...attributes,
      },
    });

    console.log("📤 Event emitted successfully:", body);
  } catch (err) {
    console.error("❌ Error while emitting OTEL log:", err);
  }
}
