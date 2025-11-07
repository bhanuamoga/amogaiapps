import React from "react";
import type { TokenUsage } from "@/types/langchin-agent/message";

interface TokenUsageDisplayProps {
  tokenUsage: TokenUsage;
  compact?: boolean;
}

export function TokenUsageDisplay({ tokenUsage, compact = false }: TokenUsageDisplayProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  };

  if (compact) {
    return (
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Tokens: {formatNumber(tokenUsage.total_tokens)}</span>
          <span>Cost: {formatCost(tokenUsage.total_cost)}</span>
        </div>
        {tokenUsage.last_updated && (
          <div className="text-xs text-muted-foreground/70">
            Updated: {new Date(tokenUsage.last_updated).toLocaleString()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg bg-muted p-4">
      <h3 className="font-semibold text-foreground">Token Usage</h3>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground">Total Tokens</div>
          <div className="font-mono text-lg">{formatNumber(tokenUsage.total_tokens)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Total Cost</div>
          <div className="font-mono text-lg text-green-600">
            {formatCost(tokenUsage.total_cost)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground">Prompt</div>
          <div className="font-mono">{formatNumber(tokenUsage.prompt_tokens)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Completion</div>
          <div className="font-mono">{formatNumber(tokenUsage.completion_tokens)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Cached</div>
          <div className="font-mono">{formatNumber(tokenUsage.cached_tokens)}</div>
        </div>
      </div>

      {Object.keys(tokenUsage.model_costs).length > 0 && (
        <div>
          <div className="mb-2 text-sm text-muted-foreground">Cost by Model</div>
          <div className="space-y-1">
            {Object.entries(tokenUsage.model_costs).map(([model, cost]) => (
              <div key={model} className="flex justify-between text-sm">
                <span className="font-mono text-foreground/80">{model}</span>
                <span className="font-mono text-green-600">{formatCost(cost)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tokenUsage.last_updated && (
        <div className="border-t pt-2 text-xs text-muted-foreground">
          Last updated: {new Date(tokenUsage.last_updated).toLocaleString()}
        </div>
      )}
    </div>
  );
}
