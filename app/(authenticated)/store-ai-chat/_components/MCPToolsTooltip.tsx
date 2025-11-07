import { MCPToolsData } from "@/types/langchin-agent/mcp";

interface MCPToolsTooltipProps {
  data: MCPToolsData;
  isVisible: boolean;
  className?: string;
}

export function MCPToolsTooltip({ data, isVisible, className = "" }: MCPToolsTooltipProps) {
  if (!isVisible || data.totalCount === 0) return null;

  // Flatten all tools from all servers into a single list
  const allTools: string[] = [];
  Object.keys(data.serverGroups).forEach((serverName) => {
    data.serverGroups[serverName].tools.forEach((tool) => {
      allTools.push(`${serverName}__${tool.name}`);
    });
  });

  return (
    <div
      className={`absolute z-50 w-64 rounded-lg border border-border bg-background p-3 shadow-lg ${className}`}
    >
      <div className="mb-2">
        <h4 className="text-sm font-medium text-foreground">
          Available MCP Tools ({data.totalCount})
        </h4>
      </div>

      <div className="max-h-48 space-y-1 overflow-y-auto">
        {allTools.map((toolName, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground"></span>
            <span className="font-mono text-xs text-muted-foreground">{toolName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
