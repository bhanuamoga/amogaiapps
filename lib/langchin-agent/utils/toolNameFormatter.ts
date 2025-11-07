/**
 * Format technical tool names into user-friendly display names
 */
export const formatToolName = (toolName: string): string => {
  const toolNameMap: Record<string, string> = {
    // WooCommerce tools
    getOrders: "📦 Getting orders",
    getProducts: "🛍️ Getting products",
    getCustomers: "👥 Getting customers",
    getCategories: "📁 Getting categories",
    getProductReviews: "⭐ Getting product reviews",
    createProduct: "➕ Creating product",
    updateProduct: "✏️ Updating product",
    deleteProduct: "🗑️ Deleting product",
    
    // Analytics tools
    createDataCards: "📊 Creating data cards",
    createDataDisplay: "📈 Creating data display",
    
    // File operations
    readFile: "📄 Reading file",
    writeFile: "💾 Writing file",
    listFiles: "📂 Listing files",
    
    // Database operations
    queryDatabase: "🗄️ Querying database",
    executeQuery: "⚡ Executing query",
    
    // API operations
    fetchData: "🌐 Fetching data",
    sendRequest: "📡 Sending request",
    
    // General operations
    analyze: "🔍 Analyzing",
    process: "⚙️ Processing",
    calculate: "🧮 Calculating",
    search: "🔎 Searching",
  };

  // Return mapped name if exists
  if (toolNameMap[toolName]) {
    return toolNameMap[toolName];
  }

  // Convert camelCase to readable format
  const readable = toolName
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .trim();

  return `⚡ ${readable}`;
};

/**
 * Get just the emoji for a tool
 */
export const getToolEmoji = (toolName: string): string => {
  const formatted = formatToolName(toolName);
  const emojiMatch = formatted.match(/^(\p{Emoji}+)/u);
  return emojiMatch ? emojiMatch[1] : '⚡';
};

/**
 * Get the display name without emoji
 */
export const getToolDisplayName = (toolName: string): string => {
  const formatted = formatToolName(toolName);
  return formatted.replace(/^(\p{Emoji}+)\s*/u, '');
};

