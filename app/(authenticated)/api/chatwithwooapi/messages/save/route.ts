// // app/api/chatwithpage/messages/save/route.ts
// "use server";

// import { NextResponse } from "next/server";
// import { saveChatMessage } from "@/app/(authenticated)/chatwithpage//actions";

// /**
//  * Save chat message (user or assistant)
//  * POST /api/chatwithpage/messages/save
//  */
// export async function POST(req: Request) {
//   try {
//     const body = await req.json();

//     const { chatId, role, content } = body;

//     if (!chatId) {
//       return NextResponse.json(
//         { error: "chatId is required" },
//         { status: 400 }
//       );
//     }

//     if (!role) {
//       return NextResponse.json(
//         { error: "role is required" },
//         { status: 400 }
//       );
//     }

//     if (content === undefined || content === null) {
//       return NextResponse.json(
//         { error: "content cannot be empty" },
//         { status: 400 }
//       );
//     }

//     console.log("💾 Saving message:", { chatId, role, content });

//     // CALL DATABASE SAVE FUNCTION
//     const result = await saveChatMessage(chatId, role, content);

//     if (!result.success) {
//       return NextResponse.json(
//         { error: result.error },
//         { status: 500 }
//       );
//     }

//     return NextResponse.json({
//       success: true,
//       message: "Message saved successfully",
//       data: result.data,
//     });
//   } catch (error) {
//     console.error("❌ Error saving message:", error);
//     return NextResponse.json(
//       { error: "Something went wrong while saving message" },
//       { status: 500 }
//     );
//   }
// }
