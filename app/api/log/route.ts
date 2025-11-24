// import { NextResponse } from "next/server";
// import { logEvent } from "@/lib/log";
// import { auth } from "@/auth";
// import { initializeLogsExporter } from "@/lib/logs-exporter";

// initializeLogsExporter();

// export async function POST(req: Request) {
//   const session = await auth();
//   const user = session?.user || null;
//   const userId = user?.user_catalog_id ?? null;

//   const { body, attributes } = await req.json();

//   // REWRITE BODY TO INCLUDE USER ID + SUMMARY TEXT
//   const finalBody = body === "Click event"
//     ? `Click event by user ${userId} on "${attributes?.text ?? "unknown"}"`
//     : body === "Page viewed"
//     ? `Page viewed by user ${userId} at path "${attributes?.path ?? ""}"`
//     : `${body} (user ${userId})`;

//   logEvent(finalBody, {
//     userId,
//     ...attributes,
//   });

//   return NextResponse.json({ ok: true });
// }
