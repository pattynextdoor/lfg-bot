/**
 * Application constants
 */

/**
 * Custom emojis used throughout the bot
 */
export const CustomEmoji = {
  /** Red check mark emoji for room creation */
  RED_CHECK: '<a:dm_red_check:1438002447300825268>',

  /** Fighting pepe emoji for participants */
  PEPO_FIGHT: '<a:pepo_fight:1438002031779516566>',
} as const;

/**
 * Thread configuration constants
 */
export const ThreadConfig = {
  /** Auto-archive duration in minutes (24 hours) */
  AUTO_ARCHIVE_DURATION: 1440,
} as const;

/**
 * Purge command configuration
 */
export const PurgeConfig = {
  /** Max messages per API fetch */
  FETCH_LIMIT: 100,
  /** Delay between individual old-message deletes (ms) */
  DELETE_DELAY_MS: 1000,
  /** How long the confirmation buttons stay active (ms) */
  CONFIRMATION_TIMEOUT: 60_000,
  /** Messages older than 14 days cannot be bulk-deleted (Discord API limit) */
  BULK_DELETE_CUTOFF_MS: 14 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Embed colors
 */
export const EmbedColors = {
  /** Red color for fighting games */
  FIGHT_ROOM: 0xFF6B6B,
  /** Orange for purge confirmation / progress */
  PURGE_CONFIRM: 0xFFA500,
  /** Green for purge completion */
  PURGE_COMPLETE: 0x57F287,
} as const;
