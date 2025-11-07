import { NextRequest, NextResponse } from 'next/server';
import { createSuggestionService } from '@/services/langchin-agent/suggestionService';
import { auth } from '@/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.user_catalog_id ?? undefined;

    const { messages, threadId, aiConfig, wooCommerceConfig } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid messages array' },
        { status: 400 }
      );
    }

    if (!threadId || typeof threadId !== 'string') {
      return NextResponse.json(
        { error: 'threadId is required' },
        { status: 400 }
      );
    }

    // Instantiate per-request to avoid cross-request state
    const service = createSuggestionService();
    const context = await service.analyzeContext(messages);
    const suggestions = await service.generateSuggestions(context, { 
      threadId,
      model: aiConfig?.model,
      aiConfig,
      wooCommerceConfig,
      userId,
    });

    // Return only the per-request usage delta for front-end accumulation
    const last = service.getLastUsage ? service.getLastUsage() : null;

    return NextResponse.json({
      suggestions,
      context,
      tokenUsageDelta: last || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}

