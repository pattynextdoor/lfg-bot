import type { TextChannel, Message, Collection, Snowflake } from 'discord.js';
import { PurgeConfig } from './constants.js';

/**
 * Promise-based delay helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches ALL messages from a user in a channel by paginating
 * through the full history. Returns messages split into "recent"
 * (eligible for bulk delete) and "old" (must be deleted individually).
 */
export async function fetchAllUserMessages(
  channel: TextChannel,
  userId: string
): Promise<{ recent: Message[]; old: Message[] }> {
  const recent: Message[] = [];
  const old: Message[] = [];
  const cutoff = Date.now() - PurgeConfig.BULK_DELETE_CUTOFF_MS;

  let lastMessageId: string | undefined;

  while (true) {
    const options: { limit: number; before?: string } = {
      limit: PurgeConfig.FETCH_LIMIT,
    };
    if (lastMessageId) {
      options.before = lastMessageId;
    }

    const fetched: Collection<Snowflake, Message> =
      await channel.messages.fetch(options);

    if (fetched.size === 0) break;

    for (const message of fetched.values()) {
      if (message.author.id === userId) {
        if (message.createdTimestamp >= cutoff) {
          recent.push(message);
        } else {
          old.push(message);
        }
      }
    }

    lastMessageId = fetched.lastKey();

    // If we got fewer than the limit, we've reached the end
    if (fetched.size < PurgeConfig.FETCH_LIMIT) break;
  }

  return { recent, old };
}

/**
 * Bulk-deletes messages in chunks of 100. Only works for messages
 * under 14 days old (Discord API limitation). Returns total deleted.
 */
export async function bulkDeleteMessages(
  channel: TextChannel,
  messages: Message[]
): Promise<number> {
  let deleted = 0;

  for (let i = 0; i < messages.length; i += PurgeConfig.FETCH_LIMIT) {
    const chunk = messages.slice(i, i + PurgeConfig.FETCH_LIMIT);
    const result = await channel.bulkDelete(chunk, true);
    deleted += result.size;
  }

  return deleted;
}

/**
 * Deletes messages one-by-one with a delay between each call.
 * Used for messages older than 14 days that can't be bulk-deleted.
 * Gracefully ignores "Unknown Message" errors (already deleted).
 */
export async function deleteOldMessages(
  messages: Message[]
): Promise<number> {
  let deleted = 0;

  for (const message of messages) {
    try {
      await message.delete();
      deleted++;
    } catch (error: unknown) {
      // 10008 = Unknown Message (already deleted)
      const discordError = error as { code?: number };
      if (discordError.code !== 10008) {
        throw error;
      }
    }
    await sleep(PurgeConfig.DELETE_DELAY_MS);
  }

  return deleted;
}
