import { ChevronDown, ChevronUp, Settings } from "lucide-react";
import { ModelConfiguration } from "./ModelConfiguration";
import { useMCPTools } from "@/hooks/langchin-agent/useMCPTools";

interface SettingsPanelProps {
  isExpanded: boolean;
  onToggle: () => void;
  provider: string;
  setProvider: (provider: string) => void;
  model: string;
  setModel: (model: string) => void;
}

export const SettingsPanel = ({
  isExpanded,
  onToggle,
  provider,
  setProvider,
  model,
  setModel,
}: SettingsPanelProps) => {
  const { data: mcpToolsData } = useMCPTools();
  return (
    <div className="border-b border-border">
      {/* Settings Header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-muted"
        aria-expanded={isExpanded}
        aria-label="Toggle settings panel"
      >
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Settings className="h-4 w-4" />
          <span>Settings</span>
          {!isExpanded && (
            <>
              <span className="text-xs text-muted-foreground">
                {provider} / {model}
              </span>
              {(mcpToolsData?.totalCount ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground">
                  - {mcpToolsData?.totalCount ?? 0} tools available
                </span>
              )}
            </>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Settings Content */}
      {isExpanded && (
        <div className="animate-in slide-in-from-top-2 px-4 pb-3 duration-200">
          <div className="space-y-3">
            {/* Model Configuration */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                AI Model
              </label>
              <ModelConfiguration
                provider={provider}
                setProvider={setProvider}
                model={model}
                setModel={setModel}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
