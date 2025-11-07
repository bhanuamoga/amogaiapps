import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

// Simple, flexible analytics tools for data visualization and insights

export const createAnalyticsTools = (): DynamicStructuredTool[] => {
  return [
    new DynamicStructuredTool({
      name: "createDataCards",
      description: "Create data cards for displaying key metrics and KPIs. Use this to show important business metrics in a clean, professional format.",
      schema: z.object({
        title: z.string().describe("Title for the data cards section"),
        cards: z.array(z.object({
          title: z.string().describe("Title of the metric"),
          value: z.string().describe("The metric value (e.g., '$12,450', '145', '8.2%')"),
          change: z.object({
            value: z.number().describe("Percentage change value"),
            period: z.string().describe("Time period for comparison (e.g., 'last month', 'last week')"),
            trend: z.enum(["up", "down"]).describe("Whether the trend is up or down")
          }).optional().describe("Change information with trend"),
          icon: z.enum(["dollar", "cart", "credit", "chart"]).optional().describe("Icon type for the metric")
        })).describe("Array of data cards to display")
      }),
      func: async (args) => {
        try {
          // Validate input data
          if (!args.title || args.title.trim() === '') {
            return JSON.stringify({
              success: false,
              error: "Title is required and cannot be empty"
            });
          }

          if (!args.cards || args.cards.length === 0) {
            return JSON.stringify({
              success: false,
              error: "At least one card is required"
            });
          }

          // Validate each card
          for (const card of args.cards) {
            if (!card.title || card.title.trim() === '') {
              return JSON.stringify({
                success: false,
                error: "Each card must have a title"
              });
            }
            if (!card.value || card.value.trim() === '') {
              return JSON.stringify({
                success: false,
                error: "Each card must have a value"
              });
            }
          }

          const analyticsData = {
            type: "data_cards",
            title: args.title.trim(),
            cards: args.cards
          };
          
          return JSON.stringify({
            success: true,
            message: `✅ Data cards with title "${args.title.trim()}" have been successfully displayed to the user. DO NOT call this tool again with the same data. The UI is now showing ${args.cards.length} metric card(s). You should now provide analytical insights in your text response.`,
            data: analyticsData
          });
        } catch (error: unknown) {
          return JSON.stringify({
            success: false,
            error: `Failed to create data cards: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }
    }),

    new DynamicStructuredTool({
      name: "createDataDisplay",
      description: "Create interactive charts and/or tables for data visualization. Provide chartConfig for charts, tableData for tables, or both. When showing only a table, set showChart=false and omit chartConfig entirely.",
      schema: z.object({
        title: z.string().describe("Title for the data display"),
        chartConfig: z.object({
          type: z.enum(["bar", "line", "pie", "doughnut"]).describe("Type of chart to display"),
          data: z.object({
            labels: z.array(z.string()).describe("Labels for the chart (e.g., months, categories)"),
            datasets: z.array(z.object({
              label: z.string().describe("Label for the dataset"),
              data: z.array(z.number()).describe("Data values for the dataset"),
              backgroundColor: z.string().optional().describe("Background color for the chart (hex color)"),
              borderColor: z.string().optional().describe("Border color for the chart (hex color)"),
              borderWidth: z.number().optional().describe("Border width for the chart")
            })).describe("Array of datasets for the chart")
          }).describe("Chart data configuration"),
          options: z.record(z.any()).optional().describe("Additional chart options")
        }).optional().describe("Chart configuration - omit entirely if showChart=false"),
        tableData: z.object({
          columns: z.array(z.string()).describe("Column headers for the table"),
          rows: z.array(z.array(z.string())).describe("Table rows as arrays of strings - each row MUST be an array with the EXACT SAME NUMBER of string values as there are columns. Example: if columns=['Name', 'Sales'], then rows must be [['Product1', '$100'], ['Product2', '$200']] - every row must have exactly 2 values matching the 2 columns.")
        }).optional().describe("Table data configuration - omit entirely if showTable=false"),
        showChart: z.boolean().optional().default(true).describe("Whether to show the chart"),
        showTable: z.boolean().optional().default(true).describe("Whether to show the table")
      }),
      func: async (args) => {
        try {
          // Validate input data
          if (!args.title || args.title.trim() === '') {
            return JSON.stringify({
              success: false,
              error: "Title is required and cannot be empty"
            });
          }

          // Validate chart configuration only if provided and chart is being shown
          if (args.chartConfig && args.showChart !== false) {
            if (!args.chartConfig.data || !args.chartConfig.data.labels || args.chartConfig.data.labels.length === 0) {
              return JSON.stringify({
                success: false,
                error: "Chart labels are required and cannot be empty"
              });
            }

            if (!args.chartConfig.data.datasets || args.chartConfig.data.datasets.length === 0) {
              return JSON.stringify({
                success: false,
                error: "At least one dataset is required for the chart"
              });
            }

            // Validate each dataset
            for (const dataset of args.chartConfig.data.datasets) {
              if (!dataset.label || dataset.label.trim() === '') {
                return JSON.stringify({
                  success: false,
                  error: "Each dataset must have a label"
                });
              }
              if (!dataset.data || dataset.data.length === 0) {
                return JSON.stringify({
                  success: false,
                  error: "Each dataset must have data values"
                });
              }
              if (dataset.data.length !== args.chartConfig.data.labels.length) {
                return JSON.stringify({
                  success: false,
                  error: "Dataset data length must match labels length"
                });
              }
            }
          }

          // Validate table data
          if (args.tableData) {
            if (!args.tableData.columns || args.tableData.columns.length === 0) {
              return JSON.stringify({
                success: false,
                error: "Table columns are required and cannot be empty"
              });
            }
            if (!args.tableData.rows || args.tableData.rows.length === 0) {
              return JSON.stringify({
                success: false,
                error: "Table rows are required and cannot be empty"
              });
            }

            // Validate row format - all rows should be arrays of strings
            for (const row of args.tableData.rows) {
              if (!Array.isArray(row)) {
                return JSON.stringify({
                  success: false,
                  error: "All table rows must be arrays"
                });
              }
              if (row.length !== args.tableData.columns.length) {
                return JSON.stringify({
                  success: false,
                  error: `Table row length (${row.length}) must match column count (${args.tableData.columns.length})`
                });
              }
              // Ensure all values are strings or can be converted to strings
              for (let i = 0; i < row.length; i++) {
                if (row[i] === null || row[i] === undefined) {
                  row[i] = ""; // Convert null/undefined to empty string
                } else {
                  row[i] = String(row[i]); // Convert to string
                }
              }
            }
          }

          // Ensure at least one display option is enabled
          if (args.showChart === false && args.showTable === false) {
            return JSON.stringify({
              success: false,
              error: "At least one display option (chart or table) must be enabled"
            });
          }

          // Ensure at least one data source is provided
          if (!args.chartConfig && !args.tableData) {
            return JSON.stringify({
              success: false,
              error: "At least one of chartConfig or tableData must be provided"
            });
          }

          const analyticsData = {
            type: "data_display",
            title: args.title.trim(),
            data: {
              chartConfig: args.chartConfig,
              tableData: args.tableData,
              showChart: args.showChart,
              showTable: args.showTable
            }
          };

          const displayInfo = [];
          if (args.showChart !== false && args.chartConfig) {
            displayInfo.push(`chart with ${args.chartConfig.data?.labels?.length || 0} data points`);
          }
          if (args.showTable !== false && args.tableData) {
            displayInfo.push(`table with ${args.tableData.rows?.length || 0} rows`);
          }
          
          return JSON.stringify({
            success: true,
            message: `✅ Data display with title "${args.title.trim()}" has been successfully displayed to the user showing ${displayInfo.join(' and ')}. DO NOT call createDataDisplay or createDataCards again with this same data. The visualization is now visible in the UI. You should now provide analytical insights and recommendations in your text response without repeating the data.`,
            data: analyticsData
          });
        } catch (error: unknown) {
          return JSON.stringify({
            success: false,
            error: `Failed to create data display: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }
    }),

  ];
};
