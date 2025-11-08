// app/api/aichat/history/route.ts
import { NextResponse } from "next/server";
import { getChatHistory } from "@/app/(authenticated)/aichat/lib/actions";

export async function GET(req: Request) {
  try {
    const data = await getChatHistory("Chat with Store Board");
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
