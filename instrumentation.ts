// // instrumentation.ts
// import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
// import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
// import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
// import { Resource } from "@opentelemetry/resources";
// import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
// import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
// import { registerInstrumentations } from "@opentelemetry/instrumentation";

// import { initializeLogsExporter } from "./lib/logs-exporter";

// // logs
// initializeLogsExporter();

// if (typeof window === "undefined" && process.env.NEXT_RUNTIME !== "edge") {
//   const provider = new NodeTracerProvider({
//     resource: new Resource({
//       [SemanticResourceAttributes.SERVICE_NAME]:
//         process.env.OTEL_SERVICE_NAME || "next-app",
//     }),
//   });

//   provider.addSpanProcessor(
//     new BatchSpanProcessor(
//       new OTLPTraceExporter({
//         url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
//         headers: {
//           Authorization: `Bearer ${process.env.SIGNOZ_INGESTION_KEY}`,
//         },
//       })
//     )
//   );

//   provider.register();

//   // MAIN FIX — set http.route manually
//   const httpInstrumentation = new HttpInstrumentation({
//     applyCustomAttributesOnSpan(
//       span,
//       request: { url?: string } | any
//     ) {
//       try {
//         const rawUrl = request?.url || "";
//         if (!rawUrl) return;

//         // 1. Extract pathname only
//         const path = rawUrl.split("?")[0];

//         // 2. Remove Next.js internal paths
//         if (path.startsWith("/_next")) return;
//         if (path.startsWith("/__nextjs")) return;

//         // 3. Set http.route attribute
//         span.setAttribute("http.route", path);
//       } catch (err) {
//         console.log("Route hook error:", err);
//       }
//     },
//   });

//   registerInstrumentations({
//     instrumentations: [httpInstrumentation],
//   });

//   console.log("🔥 Tracing fully initialized (http.route FIXED).");
// }
