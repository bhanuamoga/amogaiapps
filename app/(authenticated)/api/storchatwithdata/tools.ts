import { z } from "zod";
import { Client } from "pg";

export function buildTools(
  dbConnectionString: string,
  allowedTables: string[],
  userDataFilter: boolean,
  userName: string | null
) {
  // -----------------------------
  // Extract table names used in SQL
  // -----------------------------
  function extractTables(sql: string): string[] {
    const fromMatches = sql.match(/from\s+([a-zA-Z0-9_]+)/gi) || [];
    const joinMatches = sql.match(/join\s+([a-zA-Z0-9_]+)/gi) || [];

    return [...fromMatches, ...joinMatches].map((m) =>
      m.replace(/from|join/i, "").trim().toLowerCase()
    );
  }

  // -----------------------------
  // Auto-inject + VERIFY user_name
  // -----------------------------
  function injectUserFilter(sql: string): string {
    if (!userDataFilter || !userName) return sql;

    const cleanName = userName.replace(/'/g, "''");

    // 🔥 BLOCK USERS FROM ACCESSING OTHER user_name
    const match = sql.match(/user_name\s*=\s*'([^']+)'/i);
    if (match) {
      const requestedName = match[1];
      if (requestedName !== cleanName) {
        return "❌ You cannot access another user's data.";
      }
    }

    // 👍 Auto-inject correct user_name filter
    const condition = `user_name = '${cleanName}'`;

    if (/where\s+/i.test(sql)) {
      return sql.replace(/where\s+/i, (m) => `${m} ${condition} AND `);
    }

    return sql.replace(/;?$/, ` WHERE ${condition}`);
  }

  return {
    // ------------------------------------------------------
    getDatabaseSchema: {
      description: "Load ONLY allowed tables from public schema",
      parameters: z.object({}),
      execute: async () => {
        try {
          const client = new Client({ connectionString: dbConnectionString });
          await client.connect();

          const result = await client.query(`
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
          `);

          await client.end();

          return result.rows.filter((row: any) =>
            allowedTables.includes(row.table_name)
          );
        } catch (err: any) {
          console.error("Schema Error:", err);
          return { error: String(err) };
        }
      },
    },

    // ------------------------------------------------------
    executeSql: {
      description: "Execute SQL safely with table-scope enforcement",
      parameters: z.object({
        sql: z.string(),
      }),

      execute: async ({ sql }: { sql: string }) => {
        try {
          let sanitizedSql = sql.trim();

          const usedTables = extractTables(sanitizedSql);

          for (const table of usedTables) {
            if (!allowedTables.includes(table)) {
              return {
                error: ` Access denied: Table "${table}" is not allowed.`,
              };
            }
          }

          // 🔥 Apply user_name verification & filter
          sanitizedSql = injectUserFilter(sanitizedSql);

          // If filtering was blocked
          if (sanitizedSql.startsWith("❌")) {
            return { error: sanitizedSql };
          }

          if (!/limit\s+\d+/i.test(sanitizedSql)) {
            sanitizedSql = sanitizedSql.replace(/;?$/, " LIMIT 100;");
          }

          const client = new Client({ connectionString: dbConnectionString });
          await client.connect();
          const result = await client.query(sanitizedSql);
          await client.end();

          return result.rows;
        } catch (err: any) {
          console.error("SQL Error:", err);
          return { error: String(err) };
        }
      },
    },

    // ------------------------------------------------------
    createChart: {
      description: "Generate Chart.js config",
      parameters: z.object({
        chartConfig: z.any(),
      }),
      execute: async ({ chartConfig }: { chartConfig: any }) => {
        return chartConfig;
      },
    },

    // ------------------------------------------------------
    createTable: {
      description: "Generate formatted table",
      parameters: z.object({
        title: z.string(),
        columns: z.array(
          z.object({
            key: z.string(),
            header: z.string(),
          })
        ),
        rows: z.array(z.record(z.any())),
      }),

      execute: async ({
        title,
        columns,
        rows,
      }: {
        title: string;
        columns: { key: string; header: string }[];
        rows: Record<string, any>[];
      }) => {
        return {
          title,
          columns,
          rows,
          summary: title,
        };
      },
    },

    // ------------------------------------------------------
    createStory: {
      description: "Generate summary/story content",
      parameters: z.object({
        content: z.string(),
      }),
      execute: async ({ content }: { content: string }) => {
        return { content };
      },
    },
  };
}
