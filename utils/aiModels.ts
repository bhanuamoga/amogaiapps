import {
  anthropicDefaultModelId,
  anthropicModels,
  geminiDefaultModelId,
  geminiModels,
  openAiNativeDefaultModelId,
  openAiNativeModels,
  mistralModels,
  mistralDefaultModelId,
  deepSeekDefaultModelId,
  deepSeekModels,
  groqDefaultModelId,
  groqModels

} from "@/data/models";

export const PROVIDER_MODELS: Record<
  string,
  { models: Record<string, any>; default: string }
> = {
  google: { models: geminiModels, default: geminiDefaultModelId },
  openai: { models: openAiNativeModels, default: openAiNativeDefaultModelId },
  anthropic: { models: anthropicModels, default: anthropicDefaultModelId },
  mistral: { models: mistralModels, default: mistralDefaultModelId },
  deepseek: { models: deepSeekModels, default: deepSeekDefaultModelId },
  grok: { models: groqModels, default: groqDefaultModelId },
};
