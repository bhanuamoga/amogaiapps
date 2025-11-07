import type { MessageResponse, ToolApprovalCallbacks } from "@/types/langchin-agent/message";
import { Bot, Check } from "lucide-react";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";
import { getMessageContent, hasToolCalls, getToolCalls } from "@/services/langchin-agent/messageUtils";
import { ToolCallDisplay } from "./ToolCallDisplay";
import { useUISettings } from "@/context/langchin-agent/UISettingsContext";
import { AnalyticsMessage } from "./AnalyticsMessage";
import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, Loader2 } from "lucide-react";
import MDEditor from "@uiw/react-md-editor";
import { formatToolName } from "@/lib/langchin-agent/utils/toolNameFormatter";

interface AIMessageProps {
  message: MessageResponse;
  approvalCallbacks?: ToolApprovalCallbacks;
  showApprovalButtons?: boolean;
}

// Component for loading animation and popover
const ToolLoadingItem = ({ toolCall, isLoading }: { toolCall: { id?: string; name: string; args: unknown }, isLoading: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const showExpand = false;
  const formatArgs = (args: unknown) => {
    if (typeof args === 'string') {
      try {
        return JSON.parse(args);
      } catch {
        return args;
      }
    }
    return args;
  };

  const formattedArgs = formatArgs(toolCall.args);

  const toolDisplayName = formatToolName(toolCall.name);

  return (
    <div className="bg-transparent backdrop-blur-sm rounded-xl p-3 mb-2 border border-border/20">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center space-x-3">
          {isLoading ? (
            <div className="h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="h-3.5 w-3.5 text-green-600" />
            </div>
          ) : (
            <div className="h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
            </div>
          )}
          <span className="font-medium text-foreground text-sm">{toolDisplayName}</span>
        </div>
        {showExpand && (
          isExpanded ? (
            <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
          )
        )}
      </button>

      {showExpand && isExpanded && (
        <div className="mt-3 pt-3 border-t border-border/20">
          <div className="text-xs text-muted-foreground mb-2">Arguments:</div>
          <pre className="bg-muted/30 p-2 rounded-lg text-xs overflow-x-auto">
            {JSON.stringify(formattedArgs, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export const AIMessage = ({
  message,
  approvalCallbacks,
  showApprovalButtons = false,
}: AIMessageProps) => {
  const messageContent = getMessageContent(message);
  const hasTools = hasToolCalls(message);
  const toolCalls = getToolCalls(message);
  const { hideToolMessages } = useUISettings();

  // Check for analytics tools in tool calls
  const analyticsTools = ['createDataCards', 'createDataDisplay'];
  const hasAnalyticsTools = toolCalls.some(toolCall => analyticsTools.includes(toolCall.name));

  // Get non-analytics tools for loading display
  const nonAnalyticsTools = toolCalls.filter(toolCall => !analyticsTools.includes(toolCall.name));
  const hasNonAnalyticsTools = nonAnalyticsTools.length > 0;

  // If tool messages are hidden and there's no text content, don't render anything
  const shouldShowTools = hasTools && !hideToolMessages;
  const hasVisibleContent = messageContent || shouldShowTools || hasAnalyticsTools || (hasNonAnalyticsTools && !shouldShowTools);

  if (!hasVisibleContent) {
    return null;
  }

  return (
    <div className="flex gap-3">
      <div className="bg-primary/10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
        <Bot className="text-primary h-5 w-5" />
      </div>
      <div className="max-w-[80%] space-y-3 flex-1">
        {messageContent && (
          <div
            className={cn(
              "rounded-2xl px-4 py-2 pl-1",
              // "bg-muted text-foreground",
              // "backdrop-blur-sm supports-[backdrop-filter]:bg-muted",
            )}
          >
            <div
              data-color-mode="light"
              className="[&_hr]:!my-1 [&_hr]:h-px [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-gray-300 [&_li]:my-1 [&_ol]:ml-6 [&_ol]:list-decimal [&_ul]:ml-6 [&_ul]:list-disc [&_table]:w-full [&_table]:border-collapse [&_table]:border-gray-300 [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-gray-100 [&_th]:text-left [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_td]:break-words [&_table]:overflow-x-auto [&_table]:block [&_table]:whitespace-nowrap [&_table]:min-w-full"
            >
              <MDEditor.Markdown
                source={messageContent}
                style={{
                  backgroundColor: "transparent",
                  color: "inherit",
                  padding: 0,
                  fontSize: "1rem",
                }}
                rehypePlugins={[rehypeKatex]}
              />
            </div>
          </div>
        )}

        {hasAnalyticsTools && (
          <div className="space-y-4 w-full">
            {toolCalls
              .filter(toolCall => analyticsTools.includes(toolCall.name))
              .map((toolCall, index) => {
                // Parse the tool call arguments to create analytics data
                try {
                  const args = typeof toolCall.args === 'string' ? JSON.parse(toolCall.args) : toolCall.args;
                  const analyticsData = {
                    type: toolCall.name === 'createDataCards' ? 'data_cards' : 'data_display',
                    ...args
                  };
                  return <AnalyticsMessage key={index} data={analyticsData} className="w-full" />;
                } catch (error) {
                  console.warn('Failed to parse analytics tool call:', error);
                  return null;
                }
              })}
          </div>
        )}

        {hasNonAnalyticsTools && !shouldShowTools && (
          <div className="space-y-2">
            {nonAnalyticsTools.map((toolCall, index) => (
              <ToolLoadingItem key={toolCall.id || index} toolCall={toolCall} isLoading={!showApprovalButtons} />
            ))}
          </div>
        )}

        {shouldShowTools && (
          <div className="space-y-2">
            <ToolCallDisplay
              toolCalls={toolCalls}
              approvalCallbacks={approvalCallbacks}
              showApprovalButtons={showApprovalButtons}
            />
          </div>
        )}
      </div>
    </div>
  );
};
