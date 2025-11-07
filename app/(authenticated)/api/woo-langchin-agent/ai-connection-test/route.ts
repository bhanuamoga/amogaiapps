import { NextRequest, NextResponse } from 'next/server';
import { createChatModel } from '@/lib/langchin-agent/agent/util';

export async function POST(req: NextRequest) {
  try {
    const { provider, apiKey, model } = await req.json();

    if (!provider || !apiKey || !model) {
      return NextResponse.json(
        { success: false, error: 'Missing provider, API key, or model.' },
        { status: 400 }
      );
    }

    // Validate provider is supported
    const supportedProviders = ['openai', 'google', 'deepseek', 'grok', 'openrouter'];
    if (!supportedProviders.includes(provider)) {
      return NextResponse.json(
        { success: false, error: `Unsupported provider: ${provider}. Supported providers: ${supportedProviders.join(', ')}` },
        { status: 400 }
      );
    }

    // Create the chat model using LangChain
    const chatModel = createChatModel({
      provider,
      model,
      apiKey,
      temperature: 0.1, // Use low temperature for testing
    });

    // Send a simple test message
    const testMessage = "Hello! Please respond with 'Connection successful' to confirm the API is working.";
    
    const response = await chatModel.invoke(testMessage);
    
    // Check if we got a valid response
    if (!response || !response.content) {
      throw new Error('No response received from the AI model');
    }

    console.log("AI Connection Test Success:", {
      provider,
      model,
      responseLength: response.content.length
    });

    return NextResponse.json({
      success: true,
      message: 'AI connection successful!',
      response: response.content
    });

  } catch (error: unknown) {
    console.error("AI Connection Test Error:", error);

    let errorMessage = "Connection failed. Please check your credentials and model name.";
    
    if (error instanceof Error) {
      if (error.message?.includes('API key') || error.message?.includes('authentication')) {
        errorMessage = "Authentication failed. Please check your API Key.";
      } else if (error.message?.includes('quota') || error.message?.includes('billing')) {
        errorMessage = "Quota exceeded. Please check your plan and billing details.";
      } else if (error.message?.includes('not found') || error.message?.includes('model')) {
        errorMessage = "Model not found. Please check the model name is correct for the selected provider.";
      } else if (error.message?.includes('rate limit')) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (error.message?.includes('network') || error.message?.includes('timeout')) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error.message) {
        errorMessage = `Connection failed: ${error.message}`;
      }
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}
