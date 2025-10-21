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
import { useTranslations } from "next-intl";


type Platform = "woocommerce" | "shopify";
type AppTab = Platform | "business-settings" | "ai";

// Credential shapes expected by backend (mirror actions.ts)
type WooCredentials = {
  site_url: string;
  consumer_key: string;
  consumer_secret: string;
};

type ShopifyCredentials = {
  shop_subdomain: string;
  access_token: string;
  app_secret_key: string;
};

// The credentials object shape on DataSourceConfig
type CredentialsShape = {
  shopify?: ShopifyCredentials;
  woocommerce?: WooCredentials;
};

// Helper type guards
const isCommerceTab = (tab: AppTab): tab is Platform =>
  tab === "woocommerce" || tab === "shopify";

export default function ApiSettingsPage() {
  const [activeTab, setActiveTab] = useState<AppTab>("business-settings");
  const [configs, setConfigs] = useState<DataSourceConfig[] | null>(null); // State holds the array
  const [initialLoading, setInitialLoading] = useState(true);
  // Local state for remarks being edited, specific to the active tab
  const [currentRemarks, setCurrentRemarks] = useState("");

  // Separate transitions for each action type
  const [isTesting, startTestTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  // AI Settings Handlers
  const [aiProvider, setAIProvider] = useState<string>("");
  const [aiApiKey, setAIApiKey] = useState<string>("");

  // Derived state for the currently active configuration
  const activeConfig = configs?.find((c) => c.platform_type === activeTab);
  const t = useTranslations("Settings");
  // Fetch initial data
  useEffect(() => {
    getConnectionSettings().then((result) => {
      if (result?.data) {
        setConfigs(result.data);
      } else if (result?.error) {
        toast.error("Failed to load settings", { description: result.error });
      }
      setInitialLoading(false);
    });
  }, []);

  // Load AI settings on component mount
  useEffect(() => {
    async function fetchAISettings() {
      try {
        const aiSettings = await loadAISettings();
        console.log("Loaded AI settings:", aiSettings);
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

    fetchAISettings();
  }, []);

  // Update remarks state when tab changes
  useEffect(() => {
    setCurrentRemarks(activeConfig?.remarks || "");
  }, [activeTab, activeConfig]);

  // Generic handler to update credentials in state for the active tab
  const handleSettingsChange = useCallback(
    (platform: Platform, newPlatformSettings: WooCredentials | ShopifyCredentials) => {
      setConfigs((prevConfigs) => {
        const updatedConfigs = [...(prevConfigs || [])];
        const index = updatedConfigs.findIndex((c) => c.platform_type === platform);
        const currentConfig = index > -1 ? updatedConfigs[index] : undefined;

        // Build credentials object with correct type
        const newCredentials: CredentialsShape =
          platform === "woocommerce"
            ? { woocommerce: newPlatformSettings as WooCredentials }
            : { shopify: newPlatformSettings as ShopifyCredentials };

        if (index > -1) {
          updatedConfigs[index] = {
            ...currentConfig!,
            credentials: newCredentials,
          };
        } else {
          updatedConfigs.push({
            platform_type: platform,
            status: "pending", // Initial status
            credentials: newCredentials,
          } as DataSourceConfig);
        }
        return updatedConfigs;
      });
    },
    []
  );

  // Handler to update remarks in state for the active tab
  const handleRemarksChange = useCallback(
    (remarks: string) => {
      setCurrentRemarks(remarks);
      setConfigs((prevConfigs) => {
        const updatedConfigs = [...(prevConfigs || [])];
        const index = updatedConfigs.findIndex((c) => c.platform_type === activeTab);
        if (index > -1) {
          updatedConfigs[index] = {
            ...updatedConfigs[index],
            remarks: remarks,
          };
          return updatedConfigs;
        }
        return prevConfigs;
      });
    },
    [activeTab]
  );

  // --- Action Handlers (Specific to Active Tab) ---

  const handleTestConnection = () => {
    if (!isCommerceTab(activeTab)) {
      toast.error("Invalid tab", {
        description: "Please switch to a platform tab to test connection.",
      });
      return;
    }

    const credsObj = activeConfig?.credentials as CredentialsShape | undefined;
    const creds =
      activeTab === "woocommerce" ? credsObj?.woocommerce : credsObj?.shopify;

    if (!creds) {
      toast.error("Missing configuration", {
        description: `Please fill in all required fields for ${activeTab}.`,
      });
      return;
    }

    const payload: PlatformSettingsPayload =
      activeTab === "woocommerce"
        ? {
            platform: "woocommerce",
            autoConfigured: true,
            settings: creds as WooCredentials,
          }
        : {
            platform: "shopify",
            autoConfigured: true,
            settings: creds as ShopifyCredentials,
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
    if (!isCommerceTab(activeTab)) {
      toast.error("Invalid tab", {
        description: "Please switch to a platform tab to save settings.",
      });
      return;
    }

    const credsObj = activeConfig?.credentials as CredentialsShape | undefined;
    const creds =
      activeTab === "woocommerce" ? credsObj?.woocommerce : credsObj?.shopify;

    if (!creds) {
      toast.error("Missing configuration", {
        description: `Please fill in all required fields for ${activeTab} before saving.`,
      });
      return;
    }

    const payload: PlatformSettingsPayload =
      activeTab === "woocommerce"
        ? {
            platform: "woocommerce",
            autoConfigured: true,
            settings: creds as WooCredentials,
          }
        : {
            platform: "shopify",
            autoConfigured: true,
            settings: creds as ShopifyCredentials,
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

  // --- End Action Handlers ---

  if (initialLoading) {
    return (
      <div className="container mx-auto py-10 flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Determine if any action is in progress for the current tab
  const isActionInProgress = isTesting || isSaving;

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
          <CardDescription>
            {t("description")}
          </CardDescription>
          {/* Removed global status/sync date display - now shown per tab */}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              {/* Platform Selection Tabs */}
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as AppTab)}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="business-settings">Business</TabsTrigger>
                  <TabsTrigger
                    value="woocommerce"
                    disabled={isActionInProgress}
                  >
                    APIs
                  </TabsTrigger>
                  <TabsTrigger value="ai" disabled={isActionInProgress}>
                    AI APIs
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="business-settings" className="mt-4">
                  <BusinessSettingsForm />
                </TabsContent>

                {/* Woo tab now uses the Woo list component */}
                <TabsContent value="woocommerce" className="mt-4">
                  <WooAISettings />
                </TabsContent>

                {/* Shopify Tab (kept for completeness) */}
                <TabsContent value="shopify" className="mt-4">
                  <ShopifyForm
                    config={configs?.find((c) => c.platform_type === "shopify")}
                    onSettingsChange={(newSettings) =>
                      handleSettingsChange("shopify", newSettings as ShopifyCredentials)
                    }
                    onRemarksChange={handleRemarksChange}
                    onTestConnection={handleTestConnection}
                    onSave={handleSave}
                    isTesting={isTesting}
                    isSaving={isSaving}
                    isDisabled={activeTab !== "shopify" && isActionInProgress}
                  />
                </TabsContent>

                {/* AI APIs Tab Content */}
                <TabsContent value="ai" className="mt-4">
                  {/* If AISettings expects props, ensure it is typed in its own file.
                      If it does not accept props, replace with <AISettings /> */}
                  <AISettings
                    provider={aiProvider}
                    apiKey={aiApiKey}
                    onProviderChange={setAIProvider}
                    onApiKeyChange={setAIApiKey}
                    onSave={handleAISave}
                    isSaving={isSaving}
                  />
                </TabsContent>
              </Tabs>
            </div>
            {/* Removed global remarks section */}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-3 sm:justify-between items-center">
          {/* Keep general info footer */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              {t("footer")}
            </p>
          </div>
          {/* Removed global action buttons */}
        </CardFooter>
      </Card>
    </div>
  );
}
