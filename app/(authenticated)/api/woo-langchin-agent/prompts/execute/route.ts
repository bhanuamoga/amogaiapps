import { NextRequest, NextResponse } from "next/server";
import { executeScheduledPrompt, processDuePromptsParallel } from "@/lib/langchin-agent/promptExecutor";
import type { PromptExecutionResult } from "@/types/prompts";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.WOO_PROMPT_EXECUTE_API_KEY) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const { promptId } = body;

    let results: PromptExecutionResult[] = [];

    if (promptId) {
      // Execute specific prompt
      console.log(`Executing specific prompt: ${promptId}`);
      const result = await executeScheduledPrompt(promptId);
      results = [result];
    } else {
      // Execute all due prompts through orchestrator
      console.log("Executing all due prompts via orchestrator");
      // results = await processDuePrompts();
      results = await processDuePromptsParallel();
    }

    const summary = {
      totalPrompts: results.length,
      totalSuccess: results.reduce((sum, r) => sum + r.successCount, 0),
      totalFailures: results.reduce((sum, r) => sum + r.failureCount, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      executedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      summary,
      results,
    });

  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          executedAt: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Unknown error",
        executedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

// Optional: GET endpoint to check due prompts without executing
export async function GET() {
  try {
    const { getDuePrompts } = await import("@/lib/langchin-agent/promptExecutor");
    const duePrompts = await getDuePrompts();

    return NextResponse.json({
      duePrompts: duePrompts.map(p => ({
        id: p.id,
        title: p.title,
        nextExecution: p.nextExecution,
        executionStatus: p.executionStatus,
      })),
      count: duePrompts.length,
      checkedAt: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Unknown error" },
      { status: 500 }
    );
  }
}


