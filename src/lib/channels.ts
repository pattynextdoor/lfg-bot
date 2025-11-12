import type { Client, Channel } from 'discord.js';
import type { ThreadableChannel } from './types.js';

/**
 * Validates if a channel can support threads
 */
export function isThreadableChannel(channel: Channel | null): channel is ThreadableChannel {
  if (!channel) return false;
  if (!channel.isTextBased()) return false;
  if (channel.isDMBased()) return false;
  if (!('threads' in channel)) return false;
  return true;
}

/**
 * Gets the target channel for creating fight threads
 * Falls back to the current channel if the configured channel is invalid
 */
export async function getTargetChannel(
  client: Client,
  configuredChannelId: string | undefined,
  fallbackChannel: Channel | null
): Promise<ThreadableChannel | null> {
  // Try configured channel first
  if (configuredChannelId) {
    try {
      const channel = await client.channels.fetch(configuredChannelId);
      if (isThreadableChannel(channel)) {
        return channel;
      }
      console.warn('Configured FIGHT_CHANNEL_ID is invalid, using current channel instead');
    } catch (error) {
      console.warn('Failed to fetch configured channel, using current channel instead:', error);
    }
  }

  // Fallback to current channel
  if (isThreadableChannel(fallbackChannel)) {
    return fallbackChannel;
  }

  return null;
}
