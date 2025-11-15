import { NextResponse } from "next/server";
import { updateMessageFields } from "@/app/(authenticated)/chatwithpage/actions";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { messageId, isLike, favorite, flag } = body;

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "messageId is required" },
        { status: 400 }
      );
    }

    // Call server action (role-based validation is inside it)
    const result = await updateMessageFields({
      messageId,
      isLike,
      favorite,
      flag,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });

  } catch (error: any) {
    console.error("API updateMessage error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
