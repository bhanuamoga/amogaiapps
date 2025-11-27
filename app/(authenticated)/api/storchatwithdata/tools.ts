import { z } from "zod";
import { Client } from "pg";

export function buildTools(dbConnectionString: string) {
  return {
    // ------------------------------------------------------
    // GET DATABASE SCHEMA
    // ------------------------------------------------------
    getDatabaseSchema: {
      description: "Load all tables + columns from public schema",
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
          return result.rows;
        } catch (err: any) {
          console.error("Schema Error:", err);
          return { error: String(err) };
        }
      },
    },

    // ------------------------------------------------------
    // EXECUTE SQL
    // ------------------------------------------------------
    executeSql: {
      description: "Execute SQL safely",
      parameters: z.object({
        sql: z.string(),
      }),
      execute: async ({ sql }: { sql: string }) => {
        try {
          const client = new Client({ connectionString: dbConnectionString });
          await client.connect();

          const result = await client.query(sql);
          await client.end();

          return result.rows;
        } catch (err: any) {
          console.error("SQL Error:", err);
          return { error: String(err), sql };
        }
      },
    },

    // ------------------------------------------------------
    // CREATE CHART
    // ------------------------------------------------------
    createChart: {
      description: "Generate Chart.js config",
      parameters: z.object({
        chartConfig: z.any(),
      }),
      execute: async ({ chartConfig }: { chartConfig: any }) => {
        return chartConfig; // EXACTLY what your onStepFinish expects
      },
    },

    // ------------------------------------------------------
    // CREATE TABLE
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
    // CREATE STORY
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
