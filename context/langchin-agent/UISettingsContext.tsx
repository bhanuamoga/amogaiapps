"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface StandardApiConfig {
  id: string;
  apiName: string;
  appName: string;
  apiUrl: string;
  apiSecret: string;
  apiKey: string;
}

interface AiApiConfig {
  id: string;
  provider: string;
  model: string;
  apiKey: string;
  tokensUsed: number;
  tokensLimit: number;
  startDate: string;
  endDate: string;
  defaultModel: boolean;
  status: "active" | "inactive";
}

interface UISettingsContextType {
  hideToolMessages: boolean;
  toggleToolMessages: () => void;
  aiConfigs: AiApiConfig[];
  apiConfigs: StandardApiConfig[];
  selectedModel: string | null;
  selectedAiConfig: AiApiConfig | null;
  setSelectedModel: (model: string) => void;
  setSelectedAiConfig: (config: AiApiConfig | null) => void;
  selectedApi: StandardApiConfig | null;
  setSelectedApi: (api: StandardApiConfig | null) => void;
  loadingConfigs: boolean;
  missingAiOrApi: boolean;
  refreshConfigs: () => Promise<void>;
}

const UISettingsContext = createContext<UISettingsContextType | undefined>(undefined);

interface UISettingsProviderProps {
  children: ReactNode;
}

export const UISettingsProvider = ({ children }: UISettingsProviderProps) => {
  const [hideToolMessages, setHideToolMessages] = useState(true);
  const [aiConfigs, setAiConfigs] = useState<AiApiConfig[]>([]);
  const [apiConfigs, setApiConfigs] = useState<StandardApiConfig[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedAiConfig, setSelectedAiConfig] = useState<AiApiConfig | null>(null);
  const [selectedApi, setSelectedApi] = useState<StandardApiConfig | null>(null);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [missingAiOrApi, setMissingAiOrApi] = useState(false);

  const toggleToolMessages = () => {
    setHideToolMessages((prev) => !prev);
  };

  const refreshConfigs = async () => {
    setLoadingConfigs(true);
    try {
      const res = await fetch("/api/woo-langchin-agent/configs", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to load configs");
      }
      const json = await res.json();
      setAiConfigs(Array.isArray(json.aiConfigs) ? json.aiConfigs : []);
      setApiConfigs(Array.isArray(json.apiConfigs) ? json.apiConfigs : []);
      setSelectedModel(json.selectedModel ?? null);
      
      // Find the selected AI config by model name (for backward compatibility)
      const selectedAi = Array.isArray(json.aiConfigs) 
        ? json.aiConfigs.find((config: AiApiConfig) => config.model === json.selectedModel)
        : null;
      setSelectedAiConfig(selectedAi || null);
      
      setSelectedApi(json.selectedApi ?? null);
      setMissingAiOrApi(Boolean(json?.missing?.ai || json?.missing?.api));
    } catch (e) {
      setAiConfigs([]);
      setApiConfigs([]);
      setSelectedModel(null);
      setSelectedAiConfig(null);
      setSelectedApi(null);
      setMissingAiOrApi(true);
    } finally {
      setLoadingConfigs(false);
    }
  };

  useEffect(() => {
    refreshConfigs();
  }, []);

  return (
    <UISettingsContext.Provider
      value={{
        hideToolMessages,
        toggleToolMessages,
        aiConfigs,
        apiConfigs,
        selectedModel,
        selectedAiConfig,
        setSelectedModel,
        setSelectedAiConfig,
        selectedApi,
        setSelectedApi,
        loadingConfigs,
        missingAiOrApi,
        refreshConfigs,
      }}
    >
      {children}
    </UISettingsContext.Provider>
  );
};

export const useUISettings = () => {
  const context = useContext(UISettingsContext);
  if (context === undefined) {
    throw new Error("useUISettings must be used within a UISettingsProvider");
  }
  return context;
};
