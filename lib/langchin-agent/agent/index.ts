import { SYSTEM_PROMPT } from "./prompt";
import { postgresCheckpointer } from "./memory";
import type { DynamicTool, StructuredToolInterface } from "@langchain/core/tools";
import {
  AgentConfigOptions,
  createChatModel,
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "./util";
import { getMCPTools } from "./mcp";
import { AgentBuilder } from "./builder";
import { createWooCommerceToolsWithCredentials } from "../tools/woocommerce";
import { createAnalyticsTools } from "../tools/analytics";
let setupPromise: Promise<void> | null = null;

/**
 * One-time initialization for the Postgres checkpointer.
 * Ensures the underlying table/extension are ready before any agent runs.
 * This is called automatically when creating an agent via `getAgent` or `ensureAgent`.
 */
async function setupOnce() {
  if (!setupPromise) {
    setupPromise = postgresCheckpointer.setup().catch((err: unknown) => {
      // Reset so a future call can retry if initial setup failed.
      setupPromise = null;
      console.error("Failed to setup postgres checkpointer:", err);
      throw err;
    });
  }
  await setupPromise;
}

/**
 * Create a new agent instance with the given configuration.
 * @param cfg Configuration options for the agent
 * @returns
 */
async function createAgent(cfg?: AgentConfigOptions) {
  // Resolve model/provider from cfg or defaults.
  const provider = cfg?.provider || DEFAULT_MODEL_PROVIDER;
  const modelName = cfg?.model || DEFAULT_MODEL_NAME;
  console.log("Creating agent with config:", { provider: cfg?.provider, model: cfg?.model, hasApiKey: !!cfg?.apiKey });
  const llm = createChatModel({ 
    provider, 
    model: modelName, 
    apiKey: cfg?.apiKey,
    temperature: 1 
  });

  // Load MCP tools
  const mcpTools = await getMCPTools();
  const configTools = (cfg?.tools || []) as StructuredToolInterface[];

  // Load WooCommerce tools if credentials are provided
  const wooCommerceTools = cfg?.wooCommerceCredentials
    ? createWooCommerceToolsWithCredentials(cfg.wooCommerceCredentials)
    : [];

  // Load Analytics tools for data visualization and insights
  const analyticsTools = createAnalyticsTools();

  const allTools = [...configTools, ...mcpTools, ...wooCommerceTools, ...analyticsTools] as DynamicTool[];

  const agent = new AgentBuilder({
    llm,
    tools: allTools,
    prompt: cfg?.systemPrompt || SYSTEM_PROMPT,
    checkpointer: postgresCheckpointer,
    approveAllTools: cfg?.approveAllTools || false,
  }).build();

  return agent;
}

// Public helper if explicit readiness is ever needed elsewhere.
export async function ensureAgent(cfg?: AgentConfigOptions) {
  // Ensure checkpointer is ready before returning an agent instance.
  console.log("Ensuring agent with config:", { provider: cfg?.provider, model: cfg?.model, hasApiKey: !!cfg?.apiKey });
  await setupOnce();
  return createAgent(cfg);
}

// Named export to explicitly fetch a configured agent.
export async function getAgent(cfg?: AgentConfigOptions) {
  return ensureAgent(cfg);
}

// Note: No default agent created at module load to ensure users provide their own API keys
