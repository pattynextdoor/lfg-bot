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
 * Embed colors
 */
export const EmbedColors = {
  /** Red color for fighting games */
  FIGHT_ROOM: 0xFF6B6B,
} as const;
