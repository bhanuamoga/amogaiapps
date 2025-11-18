// import { NextResponse } from "next/server";
// import { saveAssistantMessage } from "@/app/(authenticated)/chatwithpage/actions"; // adjust path if needed

// export async function POST(req: Request) {
//   try {
//     const { chatId, prompt_uuid, response_json } = await req.json();

//     if (!chatId || !prompt_uuid) {
//       return NextResponse.json(
//         { error: "chatId and prompt_uuid are required" },
//         { status: 400 }
//       );
//     }

//     const result = await saveAssistantMessage(chatId, prompt_uuid, response_json);

//     return NextResponse.json({ success: true, data: result.data });
//   } catch (error: any) {
//     console.error("❌ saveAssistantMessage error:", error);

//     return NextResponse.json(
//       { success: false, error: error.message || "Internal Server Error" },
//       { status: 500 }
//     );
//   }
// }
