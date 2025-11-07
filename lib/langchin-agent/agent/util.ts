import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatGroq } from "@langchain/groq";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export interface CreateChatModelOptions {
  provider?: string; // 'openai' | 'google' | 'deepseek' | 'grok' | 'openrouter'
  model: string;
  apiKey?: string; // API key for the provider
  temperature?: number;
}

/**
 * Central factory for creating a chat model based on provider + model name.
 */
export function createChatModel({
  provider = "google",
  model,
  apiKey,
  temperature = 1,
}: CreateChatModelOptions): BaseChatModel {

  // Only use the provided API key, no environment variable fallback
  const effectiveApiKey = apiKey;
  console.log("effectiveApiKey", effectiveApiKey)
  if (!effectiveApiKey) {
    throw new Error(`No API key provided for ${provider}. Please provide an API key in the request.`);
  }
  switch (provider) {
    case "openai":
      return new ChatOpenAI({
        model,
        temperature,
        openAIApiKey: effectiveApiKey,
        streaming: true,
        // callbacks: [
        //   {
        //     handleLLMNewToken(token) {
        //       // Ensure streaming is properly handled
        //     },
        //   },
        // ],
      });
    case "deepseek":
      return new ChatDeepSeek({
        model,
        temperature,
        apiKey: effectiveApiKey,
      });

    case "grok":
      return new ChatGroq({
        model,
        temperature,
        apiKey: effectiveApiKey,
      });

    case "openrouter":
      return new ChatOpenAI({
        model,
        temperature,
        openAIApiKey: effectiveApiKey,
        configuration: {
          baseURL: "https://openrouter.ai/api/v1",
        },
      });

    case "google":
    default:
      return new ChatGoogleGenerativeAI({
        model,
        temperature,
        apiKey: effectiveApiKey,
      });
  }
}
export interface AgentConfigOptions {
  model?: string;
  provider?: string; // 'google' | 'openai' | 'deepseek' | 'grok' | 'openrouter'
  apiKey?: string; // API key for the selected provider
  systemPrompt?: string; // system prompt override
  tools?: unknown[]; // tools from registry or direct tool objects
  approveAllTools?: boolean; // if true, skip tool approval prompts
  wooCommerceCredentials?: {
    url: string;
    consumerKey: string;
    consumerSecret: string;
  };
}

export const DEFAULT_MODEL_PROVIDER = "google";
export const DEFAULT_MODEL_NAME = "gemini-2.5-flash";
