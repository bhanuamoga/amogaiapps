import { useEffect, useRef, useState } from "react";
import { BrainCog, Loader2, Wrench } from "lucide-react";
import Image from "next/image";
import { useMCPTools } from "@/hooks/langchin-agent/useMCPTools";
import { MCPToolsTooltip } from "./MCPToolsTooltip";

interface ModelConfigurationProps {
  provider: string;
  setProvider: (provider: string) => void;
  model: string;
  setModel: (model: string) => void;
  approveAllTools?: boolean;
  setApproveAllTools?: (approveAllTools: boolean) => void;
}

export const ModelConfiguration = ({
  provider,
  setProvider,
  model,
  setModel,
}: ModelConfigurationProps) => {
  const [showMCPTooltip, setShowMCPTooltip] = useState(false);
  const editContainerRef = useRef<HTMLDivElement | null>(null);
  const mcpTooltipRef = useRef<HTMLDivElement | null>(null);

  // Fetch MCP tools data
  const { data: mcpToolsData, isLoading: mcpToolsLoading } = useMCPTools();

  // Hide MCP tooltip when clicking outside
  useEffect(() => {
    if (!showMCPTooltip) return;
    function handler(e: MouseEvent) {
      if (
        showMCPTooltip &&
        mcpTooltipRef.current &&
        !mcpTooltipRef.current.contains(e.target as Node)
      ) {
        setShowMCPTooltip(false);
      }
    }
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [showMCPTooltip]);

  return (
    <div className="space-y-4" ref={editContainerRef}>
      {/* Provider Selection */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-muted-foreground">
          Provider
        </label>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded bg-muted">
            <Image
              src={`/${provider.toLowerCase()}.svg`}
              alt={provider}
              width={24}
              height={24}
              className="object-contain p-0.5"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <BrainCog className="h-4 w-4" />
          </span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
          >
            <option value="google">Google</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-muted-foreground">Model</label>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Enter model name"
          className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
        />
      </div>

      {/* MCP Tools Display */}
      {((mcpToolsData?.totalCount ?? 0) > 0 || mcpToolsLoading) && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-muted-foreground">
            MCP Tools
          </label>
          <div className="flex items-center gap-2">
            {mcpToolsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading tools...</span>
              </div>
            ) : (
              <div className="relative" ref={mcpTooltipRef}>
                <button
                  type="button"
                  onClick={() => setShowMCPTooltip(!showMCPTooltip)}
                  className="flex items-center gap-2 rounded border border-input px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                  aria-label={`${mcpToolsData?.totalCount ?? 0} MCP tools available`}
                >
                  <Wrench className="h-4 w-4 text-primary" />
                  <span className="text-foreground">
                    {mcpToolsData?.totalCount ?? 0} tools available
                  </span>
                </button>
                {mcpToolsData && (
                  <MCPToolsTooltip
                    data={mcpToolsData}
                    isVisible={showMCPTooltip}
                    className="bottom-full left-0 mb-2"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
