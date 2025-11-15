import { NextResponse } from "next/server";
import { loadChat } from "@/app/(authenticated)/chatwithpage/actions"; // adjust path if needed

// ----------------------------------------------------
// ✅ GET — used by your ChatPage to load chat history
// ----------------------------------------------------
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chatUuid = searchParams.get("chatUuid");

    if (!chatUuid) {
      return NextResponse.json(
        { success: false, error: "chatUuid is required" },
        { status: 400 }
      );
    }

    const result = await loadChat(chatUuid);

    return NextResponse.json(
      {
        success: true,
        chat: result.chat,
        messages: result.messages,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("❌ LoadChat GET Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Failed to load chat",
      },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------
// ✅ POST — still supported (no change)
// ----------------------------------------------------
export async function POST(req: Request) {
  try {
    const { chatId } = await req.json();

    if (!chatId) {
      return NextResponse.json(
        { error: "chatId is required" },
        { status: 400 }
      );
    }

    const result = await loadChat(chatId);

    return NextResponse.json({
      success: true,
      chat: result.chat,
      messages: result.messages,
    });
  } catch (err: any) {
    console.error("❌ LoadChat POST Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Failed to load chat",
      },
      { status: 500 }
    );
  }
}
