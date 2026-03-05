import type { TextChannel, Message, Collection, Snowflake } from 'discord.js';
import { PurgeConfig } from './constants.js';

/**
 * Promise-based delay helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches and deletes a user's messages in a channel incrementally.
 *
 * Instead of scanning the entire history first, this processes one
 * fetch-chunk at a time: fetch 100 messages → filter for the target
 * user → delete those immediately → move to the next chunk.
 *
 * This means messages start disappearing right away and the caller
 * gets progress callbacks after every chunk.
 *
 * @param channel     The text channel to purge
 * @param userId      The target user whose messages will be deleted
 * @param isAborted   Optional callback; return true to stop mid-purge
 * @param onProgress  Called after each chunk with the running delete count
 * @returns           Total number of messages deleted
 */
export async function purgeChannelMessages(
  channel: TextChannel,
  userId: string,
  isAborted?: () => boolean,
  onProgress?: (deleted: number) => void
): Promise<number> {
  const cutoff = Date.now() - PurgeConfig.BULK_DELETE_CUTOFF_MS;
  let totalDeleted = 0;
  let lastMessageId: string | undefined;

  while (true) {
    if (isAborted?.()) break;

    const options: { limit: number; before?: string } = {
      limit: PurgeConfig.FETCH_LIMIT,
    };
    if (lastMessageId) {
      options.before = lastMessageId;
    }

    const fetched: Collection<Snowflake, Message> =
      await channel.messages.fetch(options);

    if (fetched.size === 0) break;

    // Split this chunk's messages into recent (bulk-deletable) and old
    const recent: Message[] = [];
    const old: Message[] = [];

    for (const message of fetched.values()) {
      if (message.author.id === userId) {
        if (message.createdTimestamp >= cutoff) {
          recent.push(message);
        } else {
          old.push(message);
        }
      }
    }

    // Bulk-delete recent messages immediately
    if (recent.length > 0) {
      const result = await channel.bulkDelete(recent, true);
      totalDeleted += result.size;
    }

    // Delete old messages one-by-one (rate-limited)
    for (const message of old) {
      if (isAborted?.()) break;
      try {
        await message.delete();
        totalDeleted++;
      } catch (error: unknown) {
        // 10008 = Unknown Message (already deleted)
        const discordError = error as { code?: number };
        if (discordError.code !== 10008) {
          throw error;
        }
      }
      await sleep(PurgeConfig.DELETE_DELAY_MS);
    }

    onProgress?.(totalDeleted);

    lastMessageId = fetched.lastKey();

    // If we got fewer than the limit, we've reached the end
    if (fetched.size < PurgeConfig.FETCH_LIMIT) break;
  }

  return totalDeleted;
}
