import { 
  anthropicModels, 
  bedrockModels, 
  vertexModels, 
  geminiModels, 
  openAiNativeModels, 
  deepSeekModels, 
  internationalQwenModels, 
  mainlandQwenModels, 
  doubaoModels, 
  mistralModels, 
  askSageModels, 
  nebiusModels, 
  xaiModels, 
  sambanovaModels, 
  cerebrasModels, 
  groqModels, 
  sapAiCoreModels, 
  moonshotModels, 
  huaweiCloudMaasModels, 
  basetenModels,
  type ModelInfo 
} from "@/shared/api";
import { postgrest } from "../postgrest";

export interface TokenUsage {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  total_cost: number;
  model_costs: Record<string, number>;
  last_updated: string | null;
}

export interface TokenUsageUpdate {
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  model_name: string;
  cost_per_1k_tokens: number;
  source: 'llm' | 'suggestions' | 'automation' | 'tool';
}

/**
 * Update token usage for a thread using the PostgreSQL function
 */
export async function updateTokenUsage(
  threadId: string,
  usage: TokenUsageUpdate,
  userId?: number,
): Promise<TokenUsage | null> {
  try {
    const { data, error } = await postgrest.rpc("update_thread_token_usage", {
      thread_id: threadId,
      p_user_id: userId ?? 0,
      new_prompt_tokens: usage.prompt_tokens,
      new_completion_tokens: usage.completion_tokens,
      new_cached_tokens: usage.cached_tokens,
      model_name: usage.model_name,
      cost_per_1k_tokens: usage.cost_per_1k_tokens,
      source: usage.source,
    });

    if (error) {
      console.error("Error updating token usage:", error);
      return null;
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      console.error("Unexpected response when updating token usage:", data);
      return null;
    }

    // `data` is { [key: string]: Json | undefined; }, returned by Supabase from a JSONB function.
    // Coerce it through unknown before casting to TokenUsage, as suggested by TypeScript.
    return data as unknown as TokenUsage;
  } catch (error) {
    console.error("Error updating token usage:", error);
    return null;
  }
}

/**
 * Get token usage for a thread
 */
export async function getTokenUsage(threadId: string): Promise<TokenUsage | null> {
  try {
    const { data, error } = await postgrest
      .from("Thread")
      .select("token_usage")
      .eq("id", threadId)
      .single();

    if (error) {
      console.error("Error fetching token usage:", error);
      return null;
    }

    return data.token_usage as unknown as TokenUsage;
  } catch (error) {
    console.error("Error fetching token usage:", error);
    return null;
  }
}

/**
 * Get token usage for all threads
 */
export async function getAllTokenUsage(): Promise<Array<{ id: string; token_usage: TokenUsage }>> {
  try {
    const { data, error } = await postgrest
      .from("Thread")
      .select("id, token_usage")
      .order("updatedAt", { ascending: false });

    if (error) {
      console.error("Error fetching all token usage:", error);
      return [];
    }

    return data.map((thread) => ({
      id: thread.id,
      token_usage: thread.token_usage as unknown as TokenUsage,
    }));
  } catch (error) {
    console.error("Error fetching all token usage:", error);
    return [];
  }
}

/**
 * Get model info from the appropriate provider's model collection
 */
function getModelInfo(modelName: string, provider?: string): ModelInfo | null {
  // Try to find the model in the appropriate provider's model collection
  const modelCollections = [
    { models: anthropicModels, name: 'anthropic' },
    { models: bedrockModels, name: 'bedrock' },
    { models: vertexModels, name: 'vertex' },
    { models: geminiModels, name: 'gemini' },
    { models: openAiNativeModels, name: 'openai' },
    { models: deepSeekModels, name: 'deepseek' },
    { models: internationalQwenModels, name: 'qwen' },
    { models: mainlandQwenModels, name: 'qwen' },
    { models: doubaoModels, name: 'doubao' },
    { models: mistralModels, name: 'mistral' },
    { models: askSageModels, name: 'asksage' },
    { models: nebiusModels, name: 'nebius' },
    { models: xaiModels, name: 'xai' },
    { models: sambanovaModels, name: 'sambanova' },
    { models: cerebrasModels, name: 'cerebras' },
    { models: groqModels, name: 'groq' },
    { models: sapAiCoreModels, name: 'sapaicore' },
    { models: moonshotModels, name: 'moonshot' },
    { models: huaweiCloudMaasModels, name: 'huawei-cloud-maas' },
    { models: basetenModels, name: 'baseten' },
  ];

  // If provider is specified, prioritize that provider's models
  if (provider) {
    const providerCollection = modelCollections.find(c => c.name === provider);
    if (providerCollection && providerCollection.models[modelName as keyof typeof providerCollection.models]) {
      return providerCollection.models[modelName as keyof typeof providerCollection.models] as ModelInfo;
    }
  }

  // Search through all model collections
  for (const collection of modelCollections) {
    if (collection.models[modelName as keyof typeof collection.models]) {
      return collection.models[modelName as keyof typeof collection.models] as ModelInfo;
    }
  }

  return null;
}

/**
 * Calculate cost for a model based on token usage using pricing from shared/api.ts
 */
export function calculateModelCost(
  modelName: string,
  promptTokens: number,
  completionTokens: number,
  provider?: string,
): number {
  const modelInfo = getModelInfo(modelName, provider);
  
  if (!modelInfo) {
    console.warn(`No pricing information found for model: ${modelName}${provider ? ` (provider: ${provider})` : ''}`);
    return 0;
  }

  // Use inputPrice and outputPrice from ModelInfo (prices are per million tokens)
  const inputPrice = modelInfo.inputPrice || 0;
  const outputPrice = modelInfo.outputPrice || 0;

  // Convert from per million tokens to per thousand tokens
  const inputCost = (promptTokens / 1000) * (inputPrice / 1000);
  const outputCost = (completionTokens / 1000) * (outputPrice / 1000);

  return inputCost + outputCost;
}
