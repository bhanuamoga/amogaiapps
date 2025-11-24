import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

// ------------------------------
// GLOBAL LOGGER STORAGE
// ------------------------------
let _logger: any = null;

// THIS MUST BE EXPORTED
export function getLogger() {
  return _logger;
}

// ------------------------------
// INITIALIZE LOGGER
// ------------------------------
export function initializeLogsExporter() {
  // Skip in browser
  if (typeof window !== "undefined") return;

  // Skip in Edge Runtime
  if (process.env.NEXT_RUNTIME === "edge") return;

  // Skip during Next.js build stage
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Lazy import for Node only
  const { LoggerProvider, BatchLogRecordProcessor } = require("@opentelemetry/sdk-logs");
  const { OTLPLogExporter } = require("@opentelemetry/exporter-logs-otlp-http");

  const exporter = new OTLPLogExporter({
    url: process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
    headers: {
      Authorization: `Bearer ${process.env.SIGNOZ_INGESTION_KEY}`,
    },
  });

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]:
      process.env.OTEL_SERVICE_NAME || "next-app",
  });

  const loggerProvider = new LoggerProvider({
    resource,
    logRecordLimits: {
      attributeCountLimit: 128,
      attributeValueLengthLimit: 4096,
    },
  });

  loggerProvider.addLogRecordProcessor(
    new BatchLogRecordProcessor(exporter)
  );

  // CREATE LOGGER INSTANCE
  const logger = loggerProvider.getLogger("nextjs-logger");

  // STORE LOGGER FOR GLOBAL USE
  _logger = logger;

  // Emit startup log
  logger.emit({
    body: "OpenTelemetry logger initialized (No Debug)",
    attributes: { startup: true, ts: Date.now() },
  });

  return loggerProvider;
}
