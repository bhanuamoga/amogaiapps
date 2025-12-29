import { tool, type Tool, type ToolExecutionOptions } from "ai"
import { z } from "zod"
import { Pool } from "pg"
import { createChartConfig } from "./chart-helper"
import { runUserCode } from "./sandbox-runner"

/* =========================================================
   1. GENERIC TOOL WRAPPER
========================================================= */

export function createInjectedAndLoggedTool(
  config: {
    name: string
    description: string
    parameters: z.ZodType<any, any, any>
    execute: (args: any, injected?: any) => Promise<any>
  },
  injectedParams?: any
): Tool<any, any> {
  const sdkCompatibleExecute = async (
    args: any,
    _options: ToolExecutionOptions
  ) => {
    console.log(`\n--- 🛠️ TOOL: ${config.name} ---`)
    console.log("Args:", JSON.stringify(args, null, 2))

    try {
      const result =
        injectedParams !== undefined
          ? await config.execute(args, injectedParams)
          : await config.execute(args)

      console.log("Result:", JSON.stringify(result, null, 2))
      return result
    } catch (err) {
      console.error(`❌ Tool ${config.name} failed`, err)
      throw err
    }
  }

  return tool({
    description: config.description,
    parameters: config.parameters,
    execute: sdkCompatibleExecute,
  })
}

/* =========================================================
   2. POSTGRES API
========================================================= */

export class PostgresAPI {
  private pool: Pool

  constructor(connectionUrl: string) {
    this.pool = new Pool({
      connectionString: connectionUrl,
      ssl: connectionUrl.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : undefined,
    })
  }

  async testConnection() {
    const client = await this.pool.connect()
    try {
      await client.query("SELECT 1")
      return true
    } finally {
      client.release()
    }
  }

  async query<T = any>(sql: string, params: any[] = []) {
    const result = await this.pool.query(sql, params)
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
    }
  }

  async listTables() {
    return this.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY table_schema, table_name
    `)
  }

  async describeTable(table: string) {
    return this.query(
      `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `,
      [table]
    )
  }
}

/* =========================================================
   3. POSTGRES CHAT TOOLS
========================================================= */

type TableRow = Record<string, any>
type ChartRow = Record<string, any>

export const createPostgresTools = (db: PostgresAPI | null) => ({
  /* ---------- CONNECTION ---------- */

  testDBConnection: createInjectedAndLoggedTool(
    {
      name: "testDBConnection",
      description: "Tests PostgreSQL connection",
      parameters: z.object({}),
      execute: async (_, db: PostgresAPI) => {
        if (!db) throw new Error("Database not configured")
        await db.testConnection()
        return { success: true }
      },
    },
    db
  ),

  /* ---------- METADATA ---------- */

  listTables: createInjectedAndLoggedTool(
    {
      name: "listTables",
      description: "Lists all database tables",
      parameters: z.object({}),
      execute: async (_, db: PostgresAPI) => {
        if (!db) throw new Error("Database not configured")
        const result = await db.listTables()
        return { success: true, tables: result.rows }
      },
    },
    db
  ),

  describeTable: createInjectedAndLoggedTool(
    {
      name: "describeTable",
      description: "Describes a table schema",
      parameters: z.object({
        table: z.string(),
      }),
      execute: async ({ table }, db: PostgresAPI) => {
        if (!db) throw new Error("Database not configured")
        const result = await db.describeTable(table)
        return { success: true, columns: result.rows }
      },
    },
    db
  ),

  /* ---------- SAFE SQL ---------- */

  runQuery: createInjectedAndLoggedTool(
  {
    name: "runQuery",
    description: `
Runs READ-ONLY SQL queries.
Allowed: SELECT
Blocked: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE
`,
    parameters: z.object({
      sql: z.string(),
      params: z.array(z.unknown()).default([]),
    }),
    execute: async ({ sql, params }, db: PostgresAPI) => {
      if (!db) throw new Error("Database not configured")

      const forbidden =
         /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i
      if (forbidden.test(sql)) {
        throw new Error("Only SELECT queries are allowed")
      }

      const result = await db.query(sql, params)
      return {
        success: true,
        rows: result.rows,
        rowCount: result.rowCount,
      }
    },
  },
  db
),


  /* =========================================================
     4. VISUALIZATION TOOLS (CARD + TABLE + CHART)
  ========================================================= */

  createCard: createInjectedAndLoggedTool({
    name: "createCard",
    description: "Creates a KPI card",
    parameters: z.object({
      title: z.string(),
      value: z.string(),
      prefix: z.string().optional(),
      suffix: z.string().optional(),
      description: z.string().optional(),
    }),
    execute: async (args) => ({
      success: true,
      displayType: "card",
      visualizationCreated: true,
      cardData: args,
    }),
  }),

  createTable: createInjectedAndLoggedTool({
    name: "createTable",
    description: "Creates a table visualization",
    parameters: z.object({
      title: z.string().optional(),
      columns: z.array(
        z.object({
          key: z.string(),
          header: z.string(),
        })
      ),
      rows: z.array(z.record(z.string(), z.any())),
      summary: z.string().optional(),
    }),
    execute: async ({ title, columns, rows, summary }) => ({
      success: true,
      displayType: "table",
      visualizationCreated: true,
      tableData: {
        title,
        columns,
        rows: rows as TableRow[],
        summary,
      },
    }),
  }),

  createChart: createInjectedAndLoggedTool({
    name: "createChart",
    description: "Creates a chart",
    parameters: z.object({
      title: z.string(),
      type: z.enum(["line", "bar", "pie", "doughnut"]),
      chartData: z.array(z.record(z.string(), z.any())),
      xAxisColumn: z.string(),
      yAxisColumn: z.string(),
      datasetLabel: z.string().optional(),
    }),
    execute: async ({
      title,
      type,
      chartData,
      xAxisColumn,
      yAxisColumn,
      datasetLabel,
    }) => {
      const labels = chartData.map(
        (r: ChartRow) => r[xAxisColumn]
      )

      const data = chartData.map(
        (r: ChartRow) => Number(r[yAxisColumn])
      )

      return {
        success: true,
        displayType: "chart",
        visualizationCreated: true,
        chartConfig: createChartConfig({
          type,
          title,
          data: {
            labels,
            datasets: [
              {
                label: datasetLabel || yAxisColumn,
                data,
              },
            ],
          },
        }),
      }
    },
  }),
  createStory: createInjectedAndLoggedTool({
  name: "createStory",
  description: "Creates a qualitative interpretation of the visualization (2–3 sentences, no data)",
  parameters: z.object({
    text: z
      .string()
      .min(50, "Story must be at least 2 sentences")
      .max(600, "Story must be concise"),
  }),
  execute: async ({ text }) => {
    // Hard guardrails (optional but recommended)
     // block standalone quantities, not years or labels
const hasForbiddenNumber =
  /\b\d+\b/.test(text) && !/\b(19|20)\d{2}\b/.test(text)

if (hasForbiddenNumber) {
  throw new Error("Story must not contain quantitative numbers")
}

  

    return {
      success: true,
      displayType: "story",
      storyData: {
        text,
      },
    }
  },
}),

  /* =========================================================
     5. ADVANCED CODE INTERPRETER
  ========================================================= */

  codeInterpreter: createInjectedAndLoggedTool(
    {
      name: "codeInterpreter",
      description: "Runs sandboxed JS for deep DB analysis",
      parameters: z.object({
        code: z.string(),
      }),
      execute: async ({ code }, db: PostgresAPI) => {
        if (!db) throw new Error("Database not configured")

        const helpers = {
          query: (sql: string, params?: any[]) =>
            db.query(sql, params),
        }

        return runUserCode(code, helpers)
      },
    },
    db
  ),
})

/* =========================================================
   6. USAGE
========================================================= */

// const db = new PostgresAPI(process.env.POSTGRES_URL!)
// const tools = createPostgresTools(db)
