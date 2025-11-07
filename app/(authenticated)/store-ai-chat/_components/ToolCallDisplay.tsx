import React, { useState } from "react";
import { ChevronDown, ChevronRight, Settings2Icon, Check, X } from "lucide-react";
import type { ToolCall, FunctionCall, ToolApprovalCallbacks } from "@/types/langchin-agent/message";

interface ToolCallDisplayProps {
  toolCalls?: ToolCall[];
  functionCalls?: FunctionCall[];
  approvalCallbacks?: ToolApprovalCallbacks;
  showApprovalButtons?: boolean;
}

const formatArgs = (args: Record<string, unknown> | string) => {
  const argsToFormat = typeof args === "string" ? JSON.parse(args) : args;
  return (
    <pre className="overflow-x-auto rounded bg-muted p-2 text-sm">
      {JSON.stringify(argsToFormat, null, 2)}
    </pre>
  );
};

const ToolCallItem: React.FC<{
  name: string;
  args: Record<string, unknown>;
  id?: string;
  approvalCallbacks?: ToolApprovalCallbacks;
  showApprovalButtons?: boolean;
}> = ({ name, args, id, approvalCallbacks, showApprovalButtons }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if this is an analytics tool
  const isAnalyticsTool = ['createDataCards', 'createDataDisplay'].includes(name);

  // For analytics tools, we don't show the tool call interface
  if (isAnalyticsTool) {
    return null;
  }

  return (
    <div className="rounded-r border-l-4 border-border bg-muted p-3">
      <button
        className="-m-1 flex w-full cursor-pointer items-center gap-2 rounded p-1 text-left hover:bg-muted/80"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}
        <Settings2Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="font-medium text-foreground">{name}</span>
      </button>

      {isExpanded && (
        <div className="mt-2 ml-6">
          <div className="mb-1 text-sm font-medium text-muted-foreground">Arguments:</div>
          {formatArgs(args)}
        </div>
      )}

      {showApprovalButtons && id && approvalCallbacks && (
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={() => approvalCallbacks.onDeny(id)}
            className="flex items-center gap-1 rounded border border-destructive/30 px-3 py-1 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <X className="h-3 w-3" />
            Deny
          </button>
          <button
            onClick={() => approvalCallbacks.onApprove(id)}
            className="flex items-center gap-1 rounded border border-green-300 px-3 py-1 text-sm font-medium text-green-700 transition-colors hover:bg-green-100"
          >
            <Check className="h-3 w-3" />
            Allow
          </button>
        </div>
      )}
    </div>
  );
};

export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({
  toolCalls = [],
  functionCalls = [],
  approvalCallbacks,
  showApprovalButtons = false,
}) => {
  // Filter out analytics tools - they should be handled directly
  const analyticsTools = ['createDataCards', 'createDataDisplay'];
  const filteredToolCalls = toolCalls.filter(toolCall => !analyticsTools.includes(toolCall.name));
  const filteredFunctionCalls = functionCalls.filter(functionCall => !analyticsTools.includes(functionCall.name));

  const hasToolCalls = filteredToolCalls.length > 0;
  const hasFunctionCalls = filteredFunctionCalls.length > 0;

  if (!hasToolCalls && !hasFunctionCalls) {
    return null;
  }

  return (
    <div className="space-y-2">
      {hasToolCalls && (
        <div className="space-y-2">
          {filteredToolCalls.map((toolCall, index) => (
            <ToolCallItem
              key={toolCall.id || index}
              name={toolCall.name}
              args={toolCall.args}
              id={toolCall.id}
              approvalCallbacks={approvalCallbacks}
              showApprovalButtons={showApprovalButtons}
            />
          ))}
        </div>
      )}

      {hasFunctionCalls && (
        <div className="space-y-2">
          {filteredFunctionCalls.map((functionCall, index) => (
            <ToolCallItem
              key={index}
              name={functionCall.name}
              args={functionCall.args}
              approvalCallbacks={approvalCallbacks}
              showApprovalButtons={showApprovalButtons}
            />
          ))}
        </div>
      )}
    </div>
  );
};
