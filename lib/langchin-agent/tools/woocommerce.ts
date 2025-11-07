import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/* ---------------------------------------------
    1. Core Type Definitions
---------------------------------------------- */

interface WooCommerceConfig {
    url: string;
    consumerKey: string;
    consumerSecret: string;
    version?: string;
    timeout?: number;
    debug?: boolean;
}

interface APIResponse<T> {
    data: T[];
    total: number;
    totalPages: number;
    currentPage: number;
    perPage: number;
}

interface WooCommerceOrder {
    id: number;
    total: string;
    billing?: {
        email?: string;
        first_name?: string;
        last_name?: string;
    };
    line_items?: Array<{
        name: string;
        quantity: number;
    }>;
}


interface WooCommerceCustomer {
    date_registered?: string;
    date_created?: string;
    date_created_gmt?: string;
    date_modified?: string;
}

/* ---------------------------------------------
    2. WooCommerceAPI Class
---------------------------------------------- */

class WooCommerceAPI {
    private baseUrl: string;
    private timeout: number;
    public debug: boolean;

    constructor(private config: WooCommerceConfig) {
        this.baseUrl = `${config.url.replace(/\/$/, "")}/wp-json/wc/${config.version || "v3"}`;
        this.timeout = config.timeout || 30000; // Increased timeout for potentially long requests
        this.debug = config.debug || false;
    }

    /**
     * Unified handler for all HTTP requests to the WooCommerce API.
     * It manages authentication, parameters, timeouts, and error handling.
     */
    async makeRequest<T>(
        endpoint: string,
        params: Record<string, unknown> = {},
        method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
        body?: Record<string, unknown>
    ): Promise<APIResponse<T>> {
        if (method !== "GET") {
            throw new Error("Only GET requests are allowed");
        }

        const urlParams = new URLSearchParams({
            ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null)),
            consumer_key: this.config.consumerKey,
            consumer_secret: this.config.consumerSecret,
        });

        const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}?${urlParams.toString()}`;
        if (this.debug) console.log(`[WooCommerceAPI] → ${method} ${url}`, body ? `\n   Body: ${JSON.stringify(body)}` : "");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", "User-Agent": "WooCommerce-MCP-Tools/1.0" },
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok && !response.headers.get('content-type')?.includes('application/json')) {
                return { data: [], total: 0, totalPages: 1, currentPage: 1, perPage: 0 };
            }

            if (response.status === 204) {
                return { data: [], total: 0, totalPages: 1, currentPage: 1, perPage: 0 };
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(`WooCommerce API Error (${response.status} on ${method} ${endpoint}): ${JSON.stringify(data)}`);
            }

            return {
                data: Array.isArray(data) ? data : [data],
                total: parseInt(response.headers.get("x-wp-total") || `${Array.isArray(data) ? data.length : 1}`),
                totalPages: parseInt(response.headers.get("x-wp-totalpages") || "1"),
                currentPage: Number(params.page || 1),
                perPage: Number(params.per_page || 100),
            };
        } catch (error) {
            clearTimeout(timeoutId);
            if (this.debug) console.error(`[WooCommerceAPI] 🔴 Error during request to ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Automatically handles pagination to fetch all items from an endpoint.
     */
    async fetchAllPages<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T[]> {
        const perPage = Math.min(Number(params.per_page) || 100, 100);
        let page = 1;
        let allItems: T[] = [];
        let totalPages = 1;

        if (this.debug) console.log(`[WooCommerceAPI] 🔄 Starting fetchAllPages for ${endpoint}`);

        do {
            if (page > 1000) break;
            const response = await this.makeRequest<T>(endpoint, { ...params, per_page: perPage, page });
            if (response.data.length > 0) {
                allItems = allItems.concat(response.data);
            }
            totalPages = response.totalPages;
            if (this.debug) console.log(`   - Fetched page ${page}/${totalPages}. Items so far: ${allItems.length}`);
            page++;
        } while (page <= totalPages);

        if (this.debug) console.log(`[WooCommerceAPI] ✅ Finished fetchAllPages for ${endpoint}. Total items: ${allItems.length}`);
        return allItems;
    }

    // --- Simplified Endpoint Methods ---
    getProducts(params: Record<string, unknown> = {}) { return this.makeRequest("/products", params); }
    getProductById(id: number) { return this.makeRequest(`/products/${id}`); }
    updateProduct(id: number, data: Record<string, unknown>) { return this.makeRequest(`/products/${id}`, {}, "PUT", data); }

    getOrders(params: Record<string, unknown> = {}) { return this.makeRequest("/orders", params); }
    getOrderById(id: number) { return this.makeRequest(`/orders/${id}`); }

    getCustomerById(id: number) { return this.makeRequest(`/customers/${id}`); }
    getCoupons(params: Record<string, unknown> = {}) { return this.makeRequest("/coupons", params); }
    getReviews(params: Record<string, unknown> = {}) { return this.makeRequest("/products/reviews", params); }
    getCategories(params: Record<string, unknown> = {}) { return this.makeRequest("/products/categories", params); }
    getReport(endpoint: string, params: Record<string, unknown> = {}) { return this.makeRequest(`/reports/${endpoint}`, params); }

    /**
     * Fetches customers. Includes a workaround to filter by date, as the API does not support it directly.
     */
    async getCustomers(params: Record<string, unknown> = {}) {
        const needsDateFilter = params.after || params.before;
        if (!needsDateFilter && !params.fetchAll) {
            return this.makeRequest("/customers", params);
        }

        const allCustomers = await this.fetchAllPages<WooCommerceCustomer>("/customers", { ...params, after: undefined, before: undefined });

        if (!needsDateFilter) {
            return { data: allCustomers, total: allCustomers.length, totalPages: 1, currentPage: 1, perPage: allCustomers.length };
        }

        const afterDate = params.after ? new Date(String(params.after)) : null;
        const beforeDate = params.before ? new Date(String(params.before)) : null;

        const filtered = allCustomers.filter(c => {
            const dateString = c.date_registered || c.date_created || c.date_created_gmt || c.date_modified;
            const registrationDate = dateString ? new Date(dateString) : null;
            if (!registrationDate) return false;
            if (afterDate && registrationDate < afterDate) return false;
            if (beforeDate && registrationDate > beforeDate) return false;
            return true;
        });

        return { data: filtered, total: filtered.length, totalPages: 1, currentPage: 1, perPage: filtered.length };
    }

    /**
     * Generates an accurate overview of store performance for a specified period.
     */
    async getStoreOverview(period: "week" | "month" | "last_month" | "year" = "month") {
        const now = new Date();
        let afterDate: string | undefined;
        let beforeDate: string | undefined;

        switch (period) {
            case "week":
                afterDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                break;
            case "month":
                afterDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                break;
            case "last_month":
                afterDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
                beforeDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                break;
            case "year":
                afterDate = new Date(now.getFullYear(), 0, 1).toISOString();
                break;
        }

        const [orders, customers, products, coupons] = await Promise.all([
            this.fetchAllPages<WooCommerceOrder>("/orders", { after: afterDate, before: beforeDate, status: "completed,processing" }),
            this.getCustomers({ fetchAll: true, after: afterDate, before: beforeDate }),
            this.getProducts({ per_page: 1 }),
            this.getCoupons({ per_page: 1 }),
        ]);

        const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
        const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

        const topProductsMap: Record<string, number> = {};
        for (const order of orders) {
            for (const item of order.line_items || []) {
                topProductsMap[item.name] = (topProductsMap[item.name] || 0) + item.quantity;
            }
        }

        const topProducts = Object.entries(topProductsMap)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, quantity]) => ({ name, quantity }));

        return {
            success: true,
            data: {
                period,
                dateRange: { from: afterDate, to: beforeDate || new Date().toISOString() },
                totalRevenue: +totalRevenue.toFixed(2),
                totalOrders: orders.length,
                totalNewCustomers: customers.total,
                averageOrderValue: +avgOrderValue.toFixed(2),
                topSellingProducts: topProducts,
                totalProductsInStore: products.total,
                totalCouponsAvailable: coupons.total,
            },
        };
    }
}


/* ---------------------------------------------
    3. Code Interpreter (Sandbox Execution)
---------------------------------------------- */
async function runUserCode(
    code: string,
    helpers: Record<string, unknown>,
    debug: boolean = false
): Promise<{ success: boolean; result?: unknown; error?: string; stack?: string }> {
    if (debug) {
        console.log("=== runUserCode START ===");
        console.log("Code to execute:", code);
    }

    try {
        const safeHelpers = {
            // Math utilities
            multiply: (a: number, b: number) => a * b,
            add: (a: number, b: number) => a + b,
            subtract: (a: number, b: number) => a - b,
            divide: (a: number, b: number) => (b !== 0 ? a / b : 0),
            sum: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
            average: (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0,
            max: (arr: number[]) => Math.max(...arr),
            min: (arr: number[]) => Math.min(...arr),

            // Array utilities
            sortBy: (arr: Record<string, unknown>[], key: string, desc = false) => {
                return [...arr].sort((a, b) => {
                    const aVal = Number(a[key]) || 0;
                    const bVal = Number(b[key]) || 0;
                    return desc ? bVal - aVal : aVal - bVal;
                });
            },
            groupBy: (arr: Record<string, unknown>[], key: string) => {
                return arr.reduce((groups: Record<string, Record<string, unknown>[]>, item) => {
                    const groupKey = String(item[key]);
                    if (!groups[groupKey]) groups[groupKey] = [];
                    groups[groupKey].push(item);
                    return groups;
                }, {});
            },

            // Date utilities
            formatDate: (date: string | Date) => new Date(date).toLocaleDateString(),
            daysBetween: (date1: string | Date, date2: string | Date) => {
                const d1 = new Date(date1);
                const d2 = new Date(date2);
                return Math.abs((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
            },

            ...helpers,
            Math: Math,
            Date: Date,
            JSON: JSON,
            console: {
                log: (...args: unknown[]) => console.log('[SANDBOX]', ...args),
                error: (...args: unknown[]) => console.error('[SANDBOX]', ...args),
            },
        };

        // Create a safer execution environment
        const asyncFunction = new Function(
            'helpers',
            `
            return (async () => {
                const {
                    multiply, add, subtract, divide, sum, average, max, min, sortBy, groupBy,
                    formatDate, daysBetween, Math, Date, JSON, console, fetch,
                    ...otherHelpers
                } = helpers;

                // Execute and explicitly return the result
                return await (async () => {
                    ${code}
                })();
            })();
            `
        );
        const executionPromise = asyncFunction(safeHelpers);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Execution timed out after 50 seconds')), 50000));
        const result = await Promise.race([executionPromise, timeoutPromise]);

        if (debug) {
            console.log("=== runUserCode SUCCESS ===");
            console.log("Result:", JSON.stringify(result, null, 2));
        }

        return { success: true, result };
    } catch (err: unknown) {
        if (debug) {
            console.error('=== runUserCode ERROR ===');
            console.error('Error:', err instanceof Error ? err.message : 'Unknown error');
        }

        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined,
        };
    }
}

/* ---------------------------------------------
    4. Tool Factory
---------------------------------------------- */

export function createWooCommerceToolsWithCredentials(credentials: WooCommerceConfig): DynamicStructuredTool[] {
    const api = new WooCommerceAPI(credentials);

    /**
     * A wrapper function to standardize tool execution and error handling.
     * Ensures all tools return proper JSON strings for MCP compatibility.
     */
    const createTool = (func: (args: Record<string, unknown>) => Promise<unknown>) => async (args: Record<string, unknown>) => {
        try {
            // Validate required credentials
            if (!credentials.url || !credentials.consumerKey || !credentials.consumerSecret) {
                return JSON.stringify({
                    success: false,
                    error: "Missing WooCommerce credentials. Please configure url, consumerKey, and consumerSecret."
                });
            }

            const result = await func(args);
            return typeof result === 'string' ? result : JSON.stringify(result);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            return JSON.stringify({
                success: false,
                error: `Tool execution failed: ${errorMessage}`,
                timestamp: new Date().toISOString()
            });
        }
    };

    return [
        /*  Store Overview */
        new DynamicStructuredTool({
            name: "getStoreOverview",
            description: "Get a comprehensive and accurate performance summary of the store, including total revenue, total orders, new customers, average order value, and top-selling products for a given period. Returns detailed analytics with actionable insights.",
            schema: z.object({
                period: z.enum(["week", "month", "last_month", "year"]).default("month")
                    .describe("Time period for analysis. Valid values: 'week' (last 7 days), 'month' (current month to date), 'last_month' (previous full month), 'year' (current year to date)")
            }),
            func: createTool(args => api.getStoreOverview(args.period as "week" | "month" | "last_month" | "year")),
        }),

        /*  Get Products */
        new DynamicStructuredTool({
            name: "getProducts",
            description: "Fetch products with comprehensive filtering options including category, search terms, stock status, pricing, and publication status. Returns product details with pagination support.",
            schema: z.object({
                per_page: z.number().optional().default(20).describe("Number of products per page (max 100)"),
                page: z.number().optional().default(1).describe("Page number to retrieve (starts from 1)"),
                search: z.string().optional().describe("Search term to filter products by name, description, or SKU"),
                category: z.string().optional().describe("Category slug or ID to filter products by category"),
                status: z.enum(["any", "draft", "pending", "private", "publish"]).optional()
                    .describe("Product status filter. Options: 'any' (all statuses), 'draft' (draft products), 'pending' (pending review), 'private' (private products), 'publish' (published products)"),
                stock_status: z.enum(["instock", "outofstock", "onbackorder"]).optional()
                    .describe("Stock status filter. Options: 'instock' (in stock), 'outofstock' (out of stock), 'onbackorder' (available on backorder)"),
                on_sale: z.boolean().optional().describe("Filter for products currently on sale (true) or not on sale (false)"),
                featured: z.boolean().optional().describe("Filter for featured products (true) or non-featured products (false)"),
                min_price: z.string().optional().describe("Minimum price filter (e.g., '10.00')"),
                max_price: z.string().optional().describe("Maximum price filter (e.g., '100.00')"),
                after: z.string().optional().describe("Filter products created after this date (ISO date string, e.g., '2024-01-01T00:00:00Z')"),
                before: z.string().optional().describe("Filter products created before this date (ISO date string, e.g., '2024-12-31T23:59:59Z')"),
            }),
            func: createTool(args => api.getProducts(args)),
        }),

        /*  Get Product by ID */
        new DynamicStructuredTool({
            name: "getProductById",
            description: "Fetch a single product by its unique ID.",
            schema: z.object({
                id: z.number().describe("The ID of the product to retrieve.")
            }),
            func: createTool(async (args) => {
                if (!args.id || Number(args.id) <= 0) {
                    return { success: false, error: "Invalid product ID. Must be a positive number." };
                }
                return await api.getProductById(Number(args.id));
            }),
        }),

        /*  Update Product Stock */
        /*new DynamicStructuredTool({
            name: "updateProductStock",
            description: "Update the stock quantity and status for a specific product.",
            schema: z.object({
                productId: z.number().describe("The ID of the product to update."),
                stock_quantity: z.number().describe("The new stock quantity."),
                stock_status: z.enum(["instock", "outofstock", "onbackorder"]).optional().describe("Set stock status. Recommended to set to 'instock' if quantity > 0."),
            }),
            func: createTool(async (args) => {
                try {
                    // Validate inputs
                    if (!args.productId || args.productId <= 0) {
                        return { success: false, error: "Invalid product ID. Must be a positive number." };
                    }
                    if (args.stock_quantity < 0) {
                        return { success: false, error: "Stock quantity cannot be negative." };
                    }

                    const { productId, ...updateData } = args;
                    const result = await api.updateProduct(productId, updateData);
                    const updatedProduct = result.data[0] as any;
                    return {
                        success: true,
                        data: {
                            id: updatedProduct.id,
                            name: updatedProduct.name,
                            stock_quantity: updatedProduct.stock_quantity,
                            stock_status: updatedProduct.stock_status
                        }
                    };
                } catch (error: any) {
                    return {
                        success: false,
                        error: `Failed to update product stock: ${error.message}`
                    };
                }
            }),
        }),

        /*  Get Orders */
        new DynamicStructuredTool({
            name: "getOrders",
            description: "Fetch orders with comprehensive filtering by status, customer, or date range. Returns order details including billing information, line items, totals, and order status.",
            schema: z.object({
                per_page: z.number().optional().default(20).describe("Number of orders per page (max 100)"),
                page: z.number().optional().default(1).describe("Page number to retrieve (starts from 1)"),
                status: z.enum(["any", "pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"]).optional()
                    .describe("Order status filter. Options: 'any' (all statuses), 'pending' (payment pending), 'processing' (being processed), 'on-hold' (on hold), 'completed' (completed), 'cancelled' (cancelled), 'refunded' (refunded), 'failed' (failed)"),
                customer: z.number().optional().describe("Filter orders by specific customer ID"),
                after: z.string().optional().describe("Filter orders created after this date (ISO date string, e.g., '2024-01-01T00:00:00Z')"),
                before: z.string().optional().describe("Filter orders created before this date (ISO date string, e.g., '2024-12-31T23:59:59Z')"),
            }),
            func: createTool(args => api.getOrders(args)),
        }),

        /*  Get Order by ID */
        new DynamicStructuredTool({
            name: "getOrderById",
            description: "Fetch a single order by its unique ID.",
            schema: z.object({
                id: z.number().describe("The ID of the order to retrieve.")
            }),
            func: createTool(async (args: Record<string, unknown>) => {
                const id = typeof args.id === 'number' ? args.id : Number(args.id);
                if (!id || isNaN(id) || id <= 0) {
                    return { success: false, error: "Invalid order ID. Must be a positive number." };
                }
                return await api.getOrderById(id);
            }),
        }),

        /*  Get Customers */
        new DynamicStructuredTool({
            name: "getCustomers",
            description: "Fetch customers with filtering options. IMPORTANT: For date filtering, you MUST use fetchAll=true as the WooCommerce API doesn't support date ranges for customers directly.",
            schema: z.object({
                per_page: z.number().optional().default(20).describe("Number of customers per page (max 100)"),
                page: z.number().optional().default(1).describe("Page number to retrieve (starts from 1)"),
                search: z.string().optional().describe("Search term to filter customers by name or email address"),
                fetchAll: z.boolean().optional().describe("Set to true to fetch all pages. REQUIRED for date filtering as WooCommerce API doesn't support date ranges for customers."),
                after: z.string().optional().describe("Filter customers registered after this date (ISO date string, e.g., '2024-01-01T00:00:00Z'). REQUIRES fetchAll=true."),
                before: z.string().optional().describe("Filter customers registered before this date (ISO date string, e.g., '2024-12-31T23:59:59Z'). REQUIRES fetchAll=true."),
            }),
            func: createTool(args => api.getCustomers(args)),
        }),

        /*  Get Customer by ID */
        new DynamicStructuredTool({
            name: "getCustomerById",
            description: "Fetch a single customer by their unique ID.",
            schema: z.object({
                id: z.number().describe("The ID of the customer to retrieve.")
            }),
            func: createTool(async (args: Record<string, unknown>) => {
                const id = typeof args.id === 'number' ? args.id : Number(args.id);
                if (!id || isNaN(id) || id <= 0) {
                    return { success: false, error: "Invalid customer ID. Must be a positive number." };
                }
                return await api.getCustomerById(id);
            }),
        }),

        /*  Top Customers */
        new DynamicStructuredTool({
            name: "getTopCustomers",
            description: "Identify top customers by total spend within a given period. This tool provides an accurate list by analyzing all relevant orders and returns customer name, email, total spend, and number of orders.",
            schema: z.object({
                period: z.enum(["week", "month", "last_month", "year"]).default("month")
                    .describe("Time period to analyze. Valid values: 'week' (last 7 days), 'month' (current month), 'last_month' (previous month), 'year' (current year)"),
                limit: z.number().default(10).describe("Maximum number of top customers to return (default: 10)"),
            }),
            func: createTool(async (args: Record<string, unknown>) => {
                const now = new Date();
                let afterDate: string | undefined, beforeDate: string | undefined;

                if (args.period === "week") afterDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                else if (args.period === "month") afterDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                else if (args.period === "last_month") {
                    afterDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
                    beforeDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                } else if (args.period === "year") afterDate = new Date(now.getFullYear(), 0, 1).toISOString();

                // Fetch ALL orders for the period for accurate results.
                const orders = await api.fetchAllPages<WooCommerceOrder>("/orders", { after: afterDate, before: beforeDate, status: "completed,processing" });
                const customerData: Record<string, { name: string; email: string; total: number; orders: number }> = {};
                for (const order of orders) {
                    const email = order.billing?.email as string || `guest_${order.id}`;
                    if (!email) continue;

                    const name = `${order.billing?.first_name as string || ""} ${order.billing?.last_name as string || ""}`.trim() || "Guest";
                    const total = parseFloat(order.total?.toString() || "0");
                    if (!customerData[email]) customerData[email] = { name, email, total: 0, orders: 0 };
                    customerData[email].total += total;
                    customerData[email].orders += 1;
                }

                const topCustomers = Object.values(customerData).sort((a, b) => b.total - a.total).slice(0, Number(args.limit));
                return { success: true, data: topCustomers };
            }),
        }),

        /*  Low Stock Products */
        new DynamicStructuredTool({
            name: "getLowStockProducts",
            description: "List products with stock management enabled that are low in stock based on a specified threshold. Returns product ID, name, SKU, current stock quantity, and permalink.",
            schema: z.object({
                threshold: z.number().default(5).describe("Stock quantity threshold - products with stock at or below this number will be returned")
            }),
            func: createTool(async (args) => {
                const allProducts = await api.fetchAllPages<Record<string, unknown>>("/products", { per_page: 100 });
                const lowStock = allProducts
                    .filter((p: Record<string, unknown>) => p.manage_stock && typeof p.stock_quantity === "number" && p.stock_quantity <= Number(args.threshold))
                    .map((p: Record<string, unknown>) => ({ id: p.id, name: p.name, sku: p.sku, stock_quantity: p.stock_quantity, permalink: p.permalink }));

                return { success: true, data: lowStock, count: lowStock.length };
            }),
        }),

        /*  Sales Growth Comparison */
        new DynamicStructuredTool({
            name: "getSalesGrowthComparison",
            description: "Compare sales revenue between two time periods using WooCommerce sales reports. Returns current sales, previous sales, growth rate, and trend direction. IMPORTANT: Only supports 'week', 'month', and 'year' periods. For quarterly or custom date ranges, use the codeInterpreter tool instead.",
            schema: z.object({
                currentPeriod: z.enum(["week", "month", "year"]).default("month")
                    .describe("The recent period to analyze. Valid values ONLY: 'week' (last 7 days), 'month' (current month), 'year' (current year). For quarters, use codeInterpreter tool."),
                previousPeriod: z.enum(["week", "month", "year"]).default("month")
                    .describe("The comparison period. Valid values ONLY: 'week' (previous week), 'month' (previous month), 'year' (previous year). For quarters, use codeInterpreter tool."),
            }),
            func: createTool(async (args: Record<string, unknown>) => {
                try {
                    const [current, previous] = await Promise.all([
                        api.getReport("sales", { period: args.currentPeriod }),
                        api.getReport("sales", { period: args.previousPeriod }),
                    ]);

                    const currentTotal = Array.isArray(current.data)
                        ? current.data.reduce((sum: number, r) => {
                            const row = r as Record<string, unknown>;
                            return sum + (parseFloat(String(row.total_sales)) || 0);
                        }, 0 as number)
                        : 0;

                    const previousTotal = Array.isArray(previous.data)
                        ? previous.data.reduce((sum: number, r) => {
                            const row = r as Record<string, unknown>;
                            return sum + (parseFloat(String(row.total_sales)) || 0);
                        }, 0 as number)
                        : 0;

                    const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

                    return {
                        success: true,
                        data: {
                            currentPeriod: args.currentPeriod,
                            previousPeriod: args.previousPeriod,
                            currentTotal: +currentTotal.toFixed(2),
                            previousTotal: +previousTotal.toFixed(2),
                            growthRate: +growth.toFixed(2),
                            trend: growth > 0 ? "up" : growth < 0 ? "down" : "stable"
                        },
                    };
                } catch (err: unknown) {
                    return { success: false, error: err instanceof Error ? err.message : 'Unknown error occurred' };
                }
            }),
        }),

        /*  Code Interpreter - Advanced Analytics */
        new DynamicStructuredTool({
            name: "codeInterpreter",
            description: "Execute sandboxed JavaScript for complex, multi-step WooCommerce data analysis. Use this for: quarterly analysis, custom date ranges beyond week/month/year, complex multi-step calculations, data transformations, and advanced analytics that other tools cannot handle. This tool has access to the FULL WooCommerce API and can analyze any data. Available functions: fetch(endpoint, params) to get data (returns {data: [], total: number}), plus utility functions like sum(), average(), sortBy(), groupBy(), etc. The code MUST return a final result. IMPORTANT: Use fetchAll=true parameter to fetch all pagination data.",
            schema: z.object({
                code: z.string().describe("JavaScript code to execute. Use `return` to output the result. Access WooCommerce data via `await fetch(endpoint, {fetchAll: true, ...params})`")
            }),
            func: createTool(async (args: Record<string, unknown>) => {
                const helpers = {
                    fetch: async (endpoint: string, params: { fetchAll?: boolean;[key: string]: unknown } = {}) => {
                        const { fetchAll: shouldFetchAll = true, ...apiParams } = params;
                        try {
                            if (shouldFetchAll) {
                                const items = await api.fetchAllPages(endpoint, apiParams);
                                return { data: items, total: items.length };
                            } else {
                                const result = await api.makeRequest(endpoint, apiParams);
                                return result;
                            }
                        } catch (error) {
                            throw error;
                        }
                    },
                };

                const result = await runUserCode(args.code as string, helpers, credentials.debug as boolean);
                return result.success ? { success: true, result: result.result } : { success: false, error: result.error, stack: result.stack };
            }),
        }),
    ];
}

export const wooCommerceToolsArray = [];