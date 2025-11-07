import { BaseMessage } from "@langchain/core/messages";
import { MetaPostgresSaver } from "./MetaPostgresSaver";
import pg from "pg";
pg.defaults.ssl = true; // no rejectUnauthorized here

/**
 * Creates a PostgresSaver instance using Supabase connection
 * @returns PostgresSaver instance
 */
export function createPostgresMemory(): MetaPostgresSaver {
  // Use Supabase direct connection (not pooler) to avoid SSL issues
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  try {
    return MetaPostgresSaver.fromConnString(connectionString);
  } catch (error) {
    console.error("Failed to create PostgresSaver:", error);
    throw error;
  }
}

/**
 * Retrieves the message history for a specific thread.
 * @param threadId - The ID of the thread to retrieve history for.
 * @returns An array of messages associated with the thread.
 */
export const getHistory = async (threadId: string): Promise<BaseMessage[]> => {
  const history = await postgresCheckpointer.getWithMetadata({
    configurable: { thread_id: threadId },
  });
  return history

  // Converts lc_serializable -> BaseMessage subclasses
  //return Array.isArray(history?.channel_values?.messages) ? history.channel_values.messages : [];
};

export const postgresCheckpointer = createPostgresMemory();
