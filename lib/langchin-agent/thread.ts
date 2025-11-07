import { postgrest } from "@/lib/postgrest";

/**
 * Ensure a thread exists; create if missing. Title derived from seed (first 100 chars) or fallback.
 * Returns the Supabase thread record.
 */
export async function ensureThread(threadId: string, userId: number, titleSeed?: string) {
  if (!threadId) throw new Error("threadId is required");

  // Check if thread exists
  const { data: existing, error: fetchError } = await postgrest
    .from("Thread")
    .select("*")
    .eq("id", threadId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw new Error(`Failed to fetch thread: ${fetchError.message}`);
  }

  if (existing) return existing;

  // Create new thread
  const title = (titleSeed?.trim() || "New thread").substring(0, 100);
  const { data: newThread, error: createError } = await postgrest
    .from("Thread")
    .insert({ id: threadId, title, user_id: userId })
    .select()
    .single();

  if (createError) {
    throw new Error(`Failed to create thread: ${createError.message}`);
  }

  return newThread;
}
