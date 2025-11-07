import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

interface WooCommerceConfig {
    url: string;
    consumerKey: string;
    consumerSecret: string;
    debug?: boolean;
}

interface APIResponse<T> {
    data: T[];
    total: number;
    totalPages: number;
    currentPage: number;
    perPage: number;
}

class WooCommerceAPI {
    private config: WooCommerceConfig;
    private baseUrl: string;
    private debug: boolean;

    constructor(config: WooCommerceConfig) {
        this.config = config;
        this.debug = config.debug || false;
        const cleanUrl = config.url.replace(/\/$/, "");
        this.baseUrl = `${cleanUrl}/wp-json/wc/v3`;
    }

    private log(message: string, data?: unknown) {
        if (this.debug) {
            console.log(`[WooCommerce API] ${message}`, data ? JSON.stringify(data, null, 2) : '');
        }
    }

    private logError(message: string, error?: unknown) {
        if (this.debug) {
            console.error(`[WooCommerce API] ${message}`, error);
        }
    }

    private async makeRequest<T>(
        endpoint: string,
        params: Record<string, unknown> = {},
    ): Promise<APIResponse<T>> {
        try {
            const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
            const url = new URL(`${this.baseUrl}${cleanEndpoint}`);

            url.searchParams.append("consumer_key", this.config.consumerKey);
            url.searchParams.append("consumer_secret", this.config.consumerSecret);

            Object.entries(params).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    url.searchParams.append(key, value.toString());
                }
            });

            this.log(`Making request to ${endpoint}`, { params, url: url.toString() });

            const response = await fetch(url.toString(), {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "WooCommerce-Analytics-Agent/1.0",
                },
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "Unknown error");
                this.logError(`API Error: ${response.status}`, errorText);
                throw new Error(`WooCommerce API Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            const total = Number.parseInt(response.headers.get("X-WP-Total") || "0");
            const totalPages = Number.parseInt(response.headers.get("X-WP-TotalPages") || "1");
            const currentPage = Number.parseInt(String(params.page || "1"));
            const perPage = Number.parseInt(String(params.per_page || "20"));

            this.log(`Request successful`, { 
                endpoint, 
                total, 
                totalPages, 
                currentPage, 
                perPage,
                dataLength: Array.isArray(data) ? data.length : 1
            });

            return {
                data: Array.isArray(data) ? data : [data],
                total,
                totalPages,
                currentPage,
                perPage,
            };
        } catch (error: unknown) {
            this.logError(`Request failed for ${endpoint}`, error);
            
            if (error instanceof Error && error.cause && typeof error.cause === "object" && "code" in error.cause) {
                const cause = error.cause as { code: string };
                if (
                    cause.code === "ENOTFOUND" ||
                    cause.code === "ECONNREFUSED" ||
                    cause.code === "ETIMEDOUT"
                ) {
                    throw new Error(
                        `Network Error: Unable to connect to the store at ${this.config.url}. Please verify the URL is correct and the store is online.`,
                    );
                }
            }
            if (error instanceof Error && error.message.includes("fetch")) {
                throw new Error(
                    `Network Error: A connection could not be made to ${this.config.url}. The server may be down or a firewall may be blocking the connection.`,
                );
            }
            throw error;
        }
    }

    async getProducts(params: Record<string, unknown> = {}) {
        return this.makeRequest("/products", {
            orderby: "date",
            order: "desc",
            ...params,
        });
    }

    async getOrders(params: Record<string, unknown> = {}) {
        return this.makeRequest("/orders", {
            orderby: "date",
            order: "desc",
            ...params,
        });
    }

    async getCustomers(params: Record<string, unknown> = {}) {
        return this.makeRequest("/customers", {
            orderby: "registered_date",
            order: "desc",
            ...params,
        });
    }

    async getStoreOverview(period: "week" | "month" | "last_month" | "year" = "month") {
        const today = new Date();
        let afterDate: string | undefined;

        switch (period) {
            case "week":
                afterDate = new Date(today.setDate(today.getDate() - 7)).toISOString();
                break;
            case "month":
                afterDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
                break;
            case "last_month":
                afterDate = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
                break;
            case "year":
                afterDate = new Date(today.getFullYear(), 0, 1).toISOString();
                break;
        }

        const [products, orders, customers, coupons] = await Promise.all([
            this.getProducts({ per_page: 1 }),
            this.getOrders({ after: afterDate, per_page: 100, status: "completed,processing" }),
            this.getCustomers({ after: afterDate, per_page: 1 }),
            this.makeRequest("/coupons", { per_page: 1 }),
        ]);

        const totalRevenue = (orders.data as Array<{ total?: string }>).reduce(
            (sum: number, order: { total?: string }) => sum + parseFloat(order.total || "0"),
            0,
        );
        const top5Products = (orders.data as Array<{ line_items: Array<{ name: string; quantity: number }> }>)
            .flatMap((o: { line_items: Array<{ name: string; quantity: number }> }) => o.line_items)
            .reduce(
                (acc, item) => {
                    acc[item.name] = (acc[item.name] || 0) + item.quantity;
                    return acc;
                },
                {} as Record<string, number>,
            );

        const sortedTop5 = Object.entries(top5Products)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 5)
            .map(([name, quantity]) => ({ name, quantity }));

        return {
            period,
            totalRevenue: parseFloat(totalRevenue.toFixed(2)),
            totalOrders: orders.total,
            totalNewCustomers: customers.total,
            averageOrderValue:
                orders.total > 0 ? parseFloat((totalRevenue / orders.total).toFixed(2)) : 0,
            topSellingProducts: sortedTop5,
            totalProductsInStore: products.total,
            totalCouponsAvailable: coupons.total,
        };
    }
}

// Create WooCommerce API instance with provided config
function createWooCommerceAPI(config: WooCommerceConfig): WooCommerceAPI {
    return new WooCommerceAPI(config);
}

// Solution 1: Fixed version of your current approach
async function runUserCode(code: string, helpers: Record<string, unknown>, debug: boolean = false): Promise<{ success: boolean; result?: unknown; error?: string; stack?: string }> {
    if (debug) {
        console.log("=== runUserCode START ===");
        console.log("Code to execute:", code);
    }

    try {
        const safeHelpers = {
            multiply: (a: number, b: number) => a * b,
            add: (a: number, b: number) => a + b,
            subtract: (a: number, b: number) => a - b,
            divide: (a: number, b: number) => (b !== 0 ? a / b : 0),
            sum: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
            average: (arr: number[]) =>
                arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0,
            max: (arr: number[]) => Math.max(...arr),
            min: (arr: number[]) => Math.min(...arr),
            sortBy: (arr: Record<string, unknown>[], key: string, desc = false) => {
                return [...arr].sort((a, b) => {
                    const aVal = Number(a[key]) || 0;
                    const bVal = Number(b[key]) || 0;
                    if (desc) return bVal - aVal;
                    return aVal - bVal;
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

        // ✅ KEY FIX: Wrap in async IIFE and ensure return value is captured
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
                const result = await (async () => {
                    ${code}
                })();
                
                return result;
            })();
            `
        );

        const executionPromise = asyncFunction(safeHelpers);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Execution timed out after 50 seconds')), 50000)
        );

        const result = await Promise.race([executionPromise, timeoutPromise]);

        if (debug) {
            console.log("=== runUserCode SUCCESS ===");
            console.log("Result type:", typeof result);
            console.log("Result value:", JSON.stringify(result, null, 2));
        }

        return { success: true, result };

    } catch (err: unknown) {
        if (debug) {
            console.error('=== runUserCode ERROR ===');
            console.error('Error message:', err instanceof Error ? err.message : 'Unknown error');
            console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
        }
        
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined,
        };
    }
}

// Helper function to fetch all data with pagination
async function fetchAll(
    wooAPI: WooCommerceAPI,
    endpoint: string,
    params: Record<string, unknown> = {},
): Promise<unknown[]> {
    let allItems: unknown[] = [];
    let currentPage = 1;
    const perPage = params.per_page || 100;
    let keepFetching = true;

    // Access debug from the API instance
    const debug = (wooAPI as unknown as { debug?: boolean }).debug || false;

    if (debug) {
        console.log(`[fetchAll] Starting to fetch all data from ${endpoint}`, params);
    }

    while (keepFetching) {
        const currentParams = { ...params, per_page: perPage, page: currentPage };
        const response = await (wooAPI as unknown as { makeRequest: (endpoint: string, params: Record<string, unknown>) => Promise<{ data: unknown[] }> }).makeRequest(endpoint, currentParams);

        if (response && Array.isArray(response.data) && response.data.length > 0) {
            allItems = allItems.concat(response.data);
            currentPage++;
            
            if (debug) {
                console.log(`[fetchAll] Fetched page ${currentPage - 1}, total items: ${allItems.length}`);
            }
        } else {
            keepFetching = false;
        }
    }

    if (debug) {
        console.log(`[fetchAll] Completed fetching all data from ${endpoint}, total items: ${allItems.length}`);
    }

    return allItems;
}

// Helper function to create WooCommerce tools with credentials
export function createWooCommerceToolsWithCredentials(
    credentials: WooCommerceConfig,
): DynamicStructuredTool[] {
    const api = createWooCommerceAPI(credentials);

    return [
        new DynamicStructuredTool({
            name: "getProducts",
            description: "Fetch products from WooCommerce store with flexible filtering and pagination options",
            schema: z.object({
                per_page: z.number().optional().default(20).describe("Number of products to fetch"),
                page: z.number().optional().default(1).describe("Page number for pagination"),
                orderby: z.enum(["date", "id", "include", "title", "slug", "modified"]).optional().default("date"),
                order: z.enum(["asc", "desc"]).optional().default("desc"),
                status: z.enum(["any", "draft", "pending", "private", "publish"]).optional().default("publish"),
                category: z.string().optional().describe("Product category ID or slug"),
                search: z.string().optional().describe("Search term for products"),
                after: z.string().optional().describe("ISO date string to get products after this date"),
                before: z.string().optional().describe("ISO date string to get products before this date"),
                stock_status: z.enum(["instock", "outofstock", "onbackorder"]).optional().default("instock"),
                on_sale: z.boolean().optional().describe("Set to true to fetch only on-sale products"),
                featured: z.boolean().optional().describe("Set to true to fetch only featured products"),
                min_price: z.string().optional().describe("Minimum price for the product range"),
                max_price: z.string().optional().describe("Maximum price for the product range"),
            }),
            func: async (args) => {
                const debug = credentials.debug || false;
                
                if (debug) {
                    console.log(`\n--- 🛠️ EXECUTING TOOL: getProducts ---`);
                    console.log('   Arguments:', JSON.stringify(args, null, 2));
                }

                try {
                    const result = await api.getProducts(args);
                    const simplifiedProducts = (result.data as Array<{ id: number; name: string; price: string; regular_price: string; sale_price: string; on_sale: boolean; stock_status: string; permalink: string; categories: Array<{ id: number; name: string }> }>).map((product) => ({
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        regular_price: product.regular_price,
                        sale_price: product.sale_price,
                        on_sale: product.on_sale,
                        stock_status: product.stock_status,
                        permalink: product.permalink,
                        categories: product.categories.map((cat) => ({ id: cat.id, name: cat.name })),
                    }));

                    const response = {
                        success: true,
                        data: simplifiedProducts,
                        total: result.total,
                        totalPages: result.totalPages,
                        currentPage: result.currentPage,
                        perPage: result.perPage,
                    };

                    if (debug) {
                        console.log('   ✅ Result:', JSON.stringify(response));
                        console.log(`--- ✅ TOOL getProducts FINISHED ---\n`);
                    }
                    return JSON.stringify(response);
                } catch (error: unknown) {
                    if (debug) {
                        console.error(`   🔴 ERROR in tool getProducts:`, error);
                        console.log(`--- 🔴 TOOL getProducts FAILED ---\n`);
                    }
                    return JSON.stringify({
                        success: false,
                        error: `Failed to fetch products: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    });
                }
            },
        }),

        new DynamicStructuredTool({
            name: "getOrders",
            description: "Fetch orders from WooCommerce store with comprehensive filtering options",
            schema: z.object({
                per_page: z.number().optional().default(20).describe("Number of orders to fetch"),
                page: z.number().optional().default(1).describe("Page number for pagination"),
                orderby: z.enum(["date", "id", "include", "title", "slug"]).optional().default("date"),
                order: z.enum(["asc", "desc"]).optional().default("desc"),
                status: z.enum(["any", "pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"]).optional().default("any"),
                customer: z.number().optional().describe("Customer ID to filter orders"),
                after: z.string().optional().describe("ISO date string to get orders after this date"),
                before: z.string().optional().describe("ISO date string to get orders before this date"),
            }),
            func: async (args) => {
                const debug = credentials.debug || false;
                
                if (debug) {
                    console.log(`\n--- 🛠️ EXECUTING TOOL: getOrders ---`);
                    console.log('   Arguments:', JSON.stringify(args, null, 2));
                }

                try {
                    const result = await api.getOrders(args);
                    const simplifiedOrders = (result.data as Array<{ id: number; date_created: string; status: string; customer_id: number; billing: { first_name: string; last_name: string; email: string }; line_items: Array<{ product_id: number; name: string; quantity: number; total: string }>; total: string; total_tax: string; shipping_total: string; discount_total: string; payment_method_title: string }>).map((order) => ({
                        "Order ID": order.id,
                        Date: order.date_created,
                        Status: order.status,
                        customer: {
                            id: order.customer_id,
                            first_name: order.billing.first_name,
                            last_name: order.billing.last_name,
                            email: order.billing.email,
                        },
                        Items: order.line_items.length,
                        products: order.line_items.map((item) => ({
                            product_id: item.product_id,
                            name: item.name,
                            quantity: item.quantity,
                            total: item.total,
                        })),
                        Subtotal: (
                            parseFloat(order.total || "0") -
                            parseFloat(order.total_tax || "0") -
                            parseFloat(order.shipping_total || "0") +
                            parseFloat(order.discount_total || "0")
                        ).toFixed(2),
                        Discount: parseFloat(order.discount_total || "0").toFixed(2),
                        Shipping: parseFloat(order.shipping_total || "0").toFixed(2),
                        Tax: parseFloat(order.total_tax || "0").toFixed(2),
                        Total: parseFloat(order.total || "0").toFixed(2),
                        "Payment Method": order.payment_method_title,
                    }));

                    const response = {
                        success: true,
                        data: simplifiedOrders,
                        total: result.total,
                        totalPages: result.totalPages,
                        currentPage: result.currentPage,
                        perPage: result.perPage,
                    };

                    if (debug) {
                        console.log('   ✅ Result:', JSON.stringify(response));
                        console.log(`--- ✅ TOOL getOrders FINISHED ---\n`);
                    }
                    return JSON.stringify(response);
                } catch (error: unknown) {
                    if (debug) {
                        console.error(`   🔴 ERROR in tool getOrders:`, error);
                        console.log(`--- 🔴 TOOL getOrders FAILED ---\n`);
                    }
                    return JSON.stringify({
                        success: false,
                        error: `Failed to fetch orders: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    });
                }
            },
        }),

        new DynamicStructuredTool({
            name: "getCustomers",
            description: "Fetch customers from WooCommerce store with search and filtering capabilities",
            schema: z.object({
                per_page: z.number().optional().default(20).describe("Number of customers to fetch"),
                page: z.number().optional().default(1).describe("Page number for pagination"),
                orderby: z.enum(["id", "include", "name", "registered_date"]).optional().default("registered_date"),
                order: z.enum(["asc", "desc"]).optional().default("desc"),
                search: z.string().optional().describe("Search term for customers"),
            }),
            func: async (args) => {
                const debug = credentials.debug || false;
                
                if (debug) {
                    console.log(`\n--- 🛠️ EXECUTING TOOL: getCustomers ---`);
                    console.log('   Arguments:', JSON.stringify(args, null, 2));
                }

                try {
                    const result = await api.getCustomers(args);
                    const response = {
                        success: true,
                        data: result.data,
                        total: result.total,
                        totalPages: result.totalPages,
                        currentPage: result.currentPage,
                        perPage: result.perPage,
                    };

                    if (debug) {
                        console.log('   ✅ Result:', JSON.stringify(response));
                        console.log(`--- ✅ TOOL getCustomers FINISHED ---\n`);
                    }
                    return JSON.stringify(response);
                } catch (error: unknown) {
                    if (debug) {
                        console.error(`   🔴 ERROR in tool getCustomers:`, error);
                        console.log(`--- 🔴 TOOL getCustomers FAILED ---\n`);
                    }
                    return JSON.stringify({
                        success: false,
                        error: `Failed to fetch customers: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    });
                }
            },
        }),

        new DynamicStructuredTool({
            name: "getStoreOverview",
            description: "Get a comprehensive overview of store performance for a specific time period",
            schema: z.object({
                period: z.enum(["week", "month", "last_month", "year"]).optional().default("month").describe("The time period for the overview"),
            }),
            func: async (args) => {
                const debug = credentials.debug || false;
                
                if (debug) {
                    console.log(`\n--- 🛠️ EXECUTING TOOL: getStoreOverview ---`);
                    console.log('   Arguments:', JSON.stringify(args, null, 2));
                }

                try {
                    const overview = await api.getStoreOverview(args.period);
                    const response = {
                        success: true,
                        ...overview,
                    };

                    if (debug) {
                        console.log('   ✅ Result:', JSON.stringify(response));
                        console.log(`--- ✅ TOOL getStoreOverview FINISHED ---\n`);
                    }
                    return JSON.stringify(response);
                } catch (error: unknown) {
                    if (debug) {
                        console.error(`   🔴 ERROR in tool getStoreOverview:`, error);
                        console.log(`--- 🔴 TOOL getStoreOverview FAILED ---\n`);
                    }
                    return JSON.stringify({
                        success: false,
                        error: `Failed to get store overview: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    });
                }
            },
        }),

        new DynamicStructuredTool({
            name: "codeInterpreter",
            description: "Execute sandboxed JavaScript for complex, multi-step WooCommerce data analysis. This tool has access to the FULL WooCommerce API and can analyze any data. Use this for advanced analytics, custom calculations, and data processing. Available functions: fetch(endpoint, params) to get data (returns {data: [], total: number}), plus utility functions like sum(), average(), sortBy(), groupBy(), etc. The code MUST return a final result. You can analyze sales data, find best-selling products, calculate revenue, and perform any complex analysis.",
            schema: z.object({
                code: z.string().describe("JavaScript code to execute for data analysis")
            }),
            func: async (args) => {
                const debug = credentials.debug || false;
                
                if (debug) {
                    console.log(`\n--- 🛠️ EXECUTING TOOL: codeInterpreter ---`);
                    console.log('   Arguments:', JSON.stringify(args, null, 2));
                }

                const wooHelpers = {
                    // ✅ FIX: Return consistent object structure with data property
                    fetch: async (endpoint: 'products' | 'orders' | 'coupons' | 'customers', params: { fetchAll?: boolean;[key: string]: unknown } = {}) => {
                        const { fetchAll: shouldFetchAll = true, ...apiParams } = params;
                        
                        if (debug) {
                            console.log(`[fetch] Endpoint: ${endpoint}, FetchAll: ${shouldFetchAll}, Params:`, apiParams);
                        }

                        try {
                            if (shouldFetchAll) {
                                const items = await fetchAll(api, endpoint, apiParams);
                                if (debug) {
                                    console.log(`[fetch] FetchAll result: ${items.length} items`);
                                }
                                // Return consistent structure with data property
                                return {
                                    data: items,
                                    total: items.length
                                };
                            } else {
                                const result = await (api as unknown as { makeRequest: (endpoint: string, params: Record<string, unknown>) => Promise<{ data: unknown[] }> }).makeRequest(endpoint, apiParams);
                                if (debug) {
                                    console.log(`[fetch] Single page result: ${result.data.length} items`);
                                }
                                // Already has the correct structure
                                return result;
                            }
                        } catch (error: unknown) {
                            if (debug) {
                                console.error(`[fetch] Error fetching ${endpoint}:`, error);
                            }
                            throw error;
                        }
                    },
                };

                try {
                    const result = await runUserCode(args.code, wooHelpers, debug);
                    
                    if (debug) {
                        console.log('   ✅ Result:', JSON.stringify(result));
                        console.log(`--- ✅ TOOL codeInterpreter FINISHED ---\n`);
                    }

                    // Check if the result indicates an error
                    if (result && result.success === false) {
                        return JSON.stringify({
                            success: false,
                            error: "Code execution failed",
                            message: result.error,
                            stack: result.stack,
                            details: {
                                code: args.code,
                                errorType: "ExecutionError",
                                timestamp: new Date().toISOString()
                            }
                        });
                    }

                    return JSON.stringify({
                        success: true,
                        result: result.result || result
                    });
                } catch (error: unknown) {
                    if (debug) {
                        console.error(`   🔴 ERROR in tool codeInterpreter:`, error);
                        console.log(`--- 🔴 TOOL codeInterpreter FAILED ---\n`);
                    }
                    return JSON.stringify({
                        success: false,
                        error: "Code execution failed",
                        message: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined,
                        details: {
                            code: args.code,
                            errorType: error instanceof Error ? error.constructor.name : 'Unknown',
                            timestamp: new Date().toISOString()
                        }
                    });
                }
            },
        }),
    ];
}

// Export the tools array for easy integration (without credentials - for backward compatibility)
export const wooCommerceToolsArray = [];