"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  getConnectionSettings,
  saveConnectionSettings,
  testConnection,
  DataSourceConfig,
  PlatformSettingsPayload,
  saveAISettings,
  loadAISettings,
} from "./actions";

import { ShopifyForm } from "./_components/ShopifyForm";
// Fixed casing
import WooAISettings from "./_components/WooAIsettings";
import { BusinessSettingsForm } from "./_components/BusinessSettingsForm";
import AISettings from "./_components/AISettings";

type Platform = "woocommerce" | "shopify";

export default function ApiSettingsPage() {
  const [activeTab, setActiveTab] = useState<Platform | "business-settings" | "ai">(
    "business-settings"
  );
  const [configs, setConfigs] = useState<DataSourceConfig[] | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentRemarks, setCurrentRemarks] = useState("");

  const [isTesting, startTestTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  const [aiProvider, setAIProvider] = useState<string>("");
  const [aiApiKey, setAIApiKey] = useState<string>("");

  const activeConfig = configs?.find((c) => c.platform_type === activeTab);

  useEffect(() => {
    getConnectionSettings().then((result) => {
      if (result?.data) setConfigs(result.data);
      else if (result?.error)
        toast.error("Failed to load settings", { description: result.error });
      setInitialLoading(false);
    });
  }, []);

  useEffect(() => {
    async function fetchAI() {
      try {
        const aiSettings = await loadAISettings();
        if (aiSettings) {
          setAIProvider(aiSettings.provider);
          setAIApiKey(aiSettings.apiKey);
        }
      } catch (error) {
        toast.error("Failed to load AI settings", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    fetchAI();
  }, []);

  useEffect(() => {
    setCurrentRemarks(activeConfig?.remarks || "");
  }, [activeTab, activeConfig]);

  const handleSettingsChange = useCallback(
    (platform: Platform, newPlatformSettings: unknown) => {
      setConfigs((prev) => {
        const updated = [...(prev || [])];
        const index = updated.findIndex((c) => c.platform_type === platform);
        const newCredentials = { [platform]: newPlatformSettings };
        if (index > -1) updated[index] = { ...updated[index], credentials: newCredentials };
        else
          updated.push({
            platform_type: platform,
            status: "pending",
            credentials: newCredentials,
          } as DataSourceConfig);
        return updated;
      });
    },
    []
  );

  const handleRemarksChange = useCallback(
    (remarks: string) => {
      setCurrentRemarks(remarks);
      setConfigs((prev) => {
        const updated = [...(prev || [])];
        const index = updated.findIndex((c) => c.platform_type === activeTab);
        if (index > -1) {
          updated[index] = { ...updated[index], remarks };
          return updated;
        }
        return prev;
      });
    },
    [activeTab]
  );

  const handleTestConnection = () => {
    const creds = activeConfig?.credentials?.[activeTab as Platform];
    if (!creds) {
      toast.error("Missing configuration", {
        description: `Please fill in all required fields for ${activeTab}.`,
      });
      return;
    }
    const payload: PlatformSettingsPayload = {
      platform: activeTab as Platform,
      autoConfigured: true,
      settings: creds as any,
    };
    startTestTransition(async () => {
      toast.info(`Testing ${activeTab} connection...`);
      const result = await testConnection(payload);
      if (result.success)
        toast.success("Connection Test Successful", { description: result.message });
      else toast.error("Connection Test Failed", { description: result.message });
    });
  };

  const handleSave = () => {
    const creds = activeConfig?.credentials?.[activeTab as Platform];
    if (!creds) {
      toast.error("Missing configuration", {
        description: `Please fill in all required fields for ${activeTab} before saving.`,
      });
      return;
    }
    const payload: PlatformSettingsPayload = {
      platform: activeTab as Platform,
      autoConfigured: true,
      settings: creds as any,
    };
    startSaveTransition(async () => {
      toast.info(`Saving ${activeTab} settings...`);
      const result = await saveConnectionSettings(payload, currentRemarks);
      if (result.success && result.data) {
        toast.success("Settings Saved", { description: result.message });
        setConfigs(result.data);
      } else {
        toast.error("Failed to Save Settings", { description: result.message });
      }
    });
  };

  const handleAISave = () => {
    if (!aiProvider || !aiApiKey) {
      toast.error("Missing AI configuration", {
        description: "Please select a provider and enter an API key.",
      });
      return;
    }
    startSaveTransition(async () => {
      toast.info("Saving AI settings...");
      const result = await saveAISettings(aiProvider, aiApiKey);
      if (result.success) toast.success("AI settings saved successfully.");
      else toast.error("Failed to save AI settings", { description: result.message });
    });
  };

  if (initialLoading) {
    return (
      <div className="w-full max-w-[800px] mx-auto px-4 sm:px-6 py-8 sm:py-10 flex justify-center items-center h-48 sm:h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isActionInProgress = isTesting || isSaving;

  return (
    <div className="w-full max-w-[800px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <Card className="shadow-none border-0">
        <CardHeader className="pb-3 text-center">
          <CardTitle className="text-2xl sm:text-3xl font-semibold tracking-tight">
            API Connection Settings
          </CardTitle>
          <CardDescription className="mt-1 pb-2">
            Configure and manage connections to sync data with WooCommerce or Shopify.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 ">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full"
          >
            <div className="w-full flex justify-center">
              <TabsList
                className="
                  flex w-full max-w-[600px] items-center gap-1
                  bg-transparent p-1
                  rounded-full
                   dark:border-neutral-800
                "
              >
                <TabsTrigger
                  value="business-settings"
                  className="
                    flex-1 h-10 rounded-full
                    data-[state=active]:bg-black data-[state=active]:text-white
                    dark:data-[state=active]:bg-white dark:data-[state=active]:text-black
                  "
                >
                  Business
                </TabsTrigger>
                <TabsTrigger
                  value="woocommerce"
                  disabled={isActionInProgress}
                  className="
                    flex-1 h-10 rounded-full
                    data-[state=active]:bg-black data-[state=active]:text-white
                    dark:data-[state=active]:bg-white dark:data-[state=active]:text-black
                  "
                >
                  APIs
                </TabsTrigger>
                <TabsTrigger
                  value="ai"
                  disabled={isActionInProgress}
                  className="
                    flex-1 h-10 rounded-full
                    data-[state=active]:bg-black data-[state=active]:text-white
                    dark:data-[state=active]:bg-white dark:data-[state=active]:text-black
                  "
                >
                  AI APIs
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="h-0.5 w-full bg-black mt-5" />

            <TabsContent value="business-settings" className="mt-6">
              <div className="rounded-2xl ">
                <div className="p-4 sm:p-6">
                  <BusinessSettingsForm />
                </div>
              </div>
            </TabsContent>

            {/* Woo tab now uses the Woo list component */}
            <TabsContent value="woocommerce" className="mt-6">
              <div className="rounded-2xl ">
                <div className="p-4 sm:p-6">
                  <WooAISettings />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="shopify" className="mt-6">
              <div className="rounded-2xl ">
                <div className="p-4 sm:p-6">
                  <ShopifyForm
                    config={configs?.find((c) => c.platform_type === "shopify")}
                    onSettingsChange={(newSettings) => handleSettingsChange("shopify", newSettings)}
                    onRemarksChange={handleRemarksChange}
                    onTestConnection={handleTestConnection}
                    onSave={handleSave}
                    isTesting={isTesting}
                    isSaving={isSaving}
                    isDisabled={activeTab !== "shopify" && isActionInProgress}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Ensure AISettings component accepts these props; otherwise render <AISettings /> without props */}
            <TabsContent value="ai" className="mt-6">
              <div className="rounded-2xl ">
                <div className="p-4 sm:p-6">
                  <AISettings
                    provider={aiProvider}
                    apiKey={aiApiKey}
                    onProviderChange={setAIProvider}
                    onApiKeyChange={setAIApiKey}
                    onSave={handleAISave}
                    isSaving={isSaving}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="pt-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>Configure connections individually; credentials are stored securely after saving.</p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
