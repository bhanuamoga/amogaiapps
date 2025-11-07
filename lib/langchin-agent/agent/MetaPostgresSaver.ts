import {
  type Checkpoint,
  type CheckpointMetadata,
  type ChannelVersions,
} from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";
import pg from "pg";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import type { SerializerProtocol } from "@langchain/langgraph-checkpoint";
import { BaseMessage } from "@langchain/core/messages";

/**
 * ✅ Global SSL override for Supabase (handles self-signed chain)
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
pg.defaults.ssl = { rejectUnauthorized: false };

type MsgWithMeta = {
  role: string;
  content: string;
  user_id?: string;
  is_liked?: boolean;
  is_disliked?: boolean;
  is_favorited?: boolean;
  is_bookmarked?: boolean;
  is_flagged?: boolean;
  is_archived?: boolean;
};

export class MetaPostgresSaver extends PostgresSaver {
  private metaPool: pg.Pool;

  constructor(
    pool: pg.Pool,
    serde?: SerializerProtocol,
    options?: Partial<{ schema: string }>,
    metaPool?: pg.Pool
  ) {
    super(pool, serde, options);
    this.metaPool = metaPool ?? pool;
  }

  /**
   * ✅ Force SSL rejection off at pool creation.
   * This prevents "self-signed certificate in certificate chain" on Supabase pooled endpoints.
   */
  static fromConnString(
    connString: string,
    options?: Partial<{ schema: string }>
  ): MetaPostgresSaver {
    const pool = new pg.Pool({
      connectionString: connString,
      ssl: { rejectUnauthorized: false }, // <-- critical fix
    });

    return new MetaPostgresSaver(pool, undefined, options);
  }

  override async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    newVersions: ChannelVersions
  ): Promise<RunnableConfig> {
    console.log("MetaPostgresSaver.put", metadata);
    const threadId = requireThreadId(config);

    const result = await super.put(config, checkpoint, metadata, newVersions);

    const msgs = (checkpoint.channel_values as Record<string, unknown>)?.messages;
    if (Array.isArray(msgs)) {
      await this.saveMetadata(threadId, msgs);
    }

    return result;
  }

  override async get(config: RunnableConfig): Promise<Checkpoint | undefined> {
    const cp = await super.get(config);
    if (!cp) return undefined;
    return cp;
  }

  async getWithMetadata(config: RunnableConfig): Promise<Record<string, unknown>[]> {
    const cp: Checkpoint | undefined = await super.get(config);
    if (!cp) return [];

    const threadId = requireThreadId(config);
    const msgs = cp.channel_values?.messages;
    if (!Array.isArray(msgs)) return [];

    const metaMap = await this.loadMetadata(threadId);

    // Merge metadata + normalize + convert to plain dict
    const enriched = msgs.map((msg: Record<string, unknown>, idx: number) => {
      let baseData: Record<string, unknown>;

      if (msg instanceof BaseMessage) {
        baseData = msg.toDict();
      } else if (msg.lc_namespace?.includes("messages")) {
        const type =
          msg.lc_kwargs?.role === "user" ||
          msg.lc_namespace?.includes("human")
            ? "human"
            : "ai";

        baseData = {
          type,
          data: msg.lc_kwargs,
        };
      } else {
        baseData = msg;
      }

      return {
        ...baseData,
        ...metaMap.get(idx),
      };
    });

    return enriched;
  }

  private async saveMetadata(threadId: string, msgs: MsgWithMeta[]): Promise<void> {
    const queries = msgs.map((msg, idx) => {
      const messageId =
        (msg as Record<string, unknown>).id ??
        (msg as Record<string, unknown>).lc_kwargs?.id ??
        null;

      return this.metaPool.query(
        `INSERT INTO message_metadata (thread_id, message_id, message_index, user_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (thread_id, message_index)
         DO UPDATE SET 
           user_id = EXCLUDED.user_id, 
           is_liked = EXCLUDED.is_liked`,
        [threadId, messageId, idx, msg.user_id ?? null]
      );
    });
    await Promise.all(queries);
  }

  private async loadMetadata(
    threadId: string
  ): Promise<
    Map<
      number,
      {
        user_id?: string;
        is_liked?: boolean;
        is_disliked?: boolean;
        is_favorited?: boolean;
        is_bookmarked?: boolean;
        is_flagged?: boolean;
        is_archived?: boolean;
      }
    >
  > {
    const { rows } = await this.metaPool.query(
      `SELECT message_index, message_id, user_id, is_liked, is_disliked, is_favorited, is_bookmarked, is_flagged, is_archived 
       FROM message_metadata 
       WHERE thread_id = $1`,
      [threadId]
    );
    return new Map(
      rows.map((r) => [
        r.message_index,
        {
          message_id: r.message_id,
          user_id: r.user_id,
          is_liked: r.is_liked,
          is_disliked: r.is_disliked,
          is_favorited: r.is_favorited,
          is_bookmarked: r.is_bookmarked,
          is_flagged: r.is_flagged,
          is_archived: r.is_archived,
        },
      ])
    );
  }
}

function requireThreadId(config?: RunnableConfig): string {
  if (
    !config?.configurable ||
    (config.configurable as Record<string, unknown>).thread_id == null
  ) {
    throw new Error("Missing required config.configurable.thread_id");
  }
  return String((config.configurable as Record<string, unknown>).thread_id);
}
