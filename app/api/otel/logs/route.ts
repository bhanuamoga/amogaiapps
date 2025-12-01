// import { NextResponse } from "next/server";
// import { logsDB } from "../supabase-logs";

// import { auth } from "@/auth";

// export async function POST(req: Request) {
//   try {
//     const json = await req.json();

//     const session = await auth();
//     const user = session?.user;

//     for (const rl of json.resourceLogs ?? []) {
//       for (const scope of rl.scopeLogs ?? []) {
//         for (const log of scope.logRecords ?? []) {
//           const { error } = await logsDB.from("logs").insert({
//             app_id: process.env.APP_ID,
//             app_code: process.env.APP_CODE,

//             session_id: log.attributes?.session_id?.stringValue ?? null,
//             page: log.attributes?.page?.stringValue ?? null,

//             user_id: user?.user_catalog_id ?? null,
//             user_name: user?.user_name ?? null,

//             severity: log.severityText,
//             message: log.body?.stringValue ?? "",
//             code: log.attributes?.code?.stringValue ?? null,
//             attributes: log.attributes ?? {},

//             trace_id: log.traceId ?? null,
//             span_id: log.spanId ?? null,

//             timestamp: new Date(Number(log.timeUnixNano) / 1e6)
//           });

//           if (error) console.error("Insert error:", error);
//         }
//       }
//     }

//     return NextResponse.json({ ok: true });

//   } catch (e) {
//     console.error("OTEL Logs Error:", e);
//     return NextResponse.json({ ok: false }, { status: 500 });
//   }
// }
