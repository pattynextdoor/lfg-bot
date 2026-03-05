import { EmbedBuilder } from 'discord.js';
import type { User } from 'discord.js';
import type { FightRoomOptions, PurgeProgress } from './types.js';
import { CustomEmoji, EmbedColors } from './constants.js';

/**
 * Creates a rich embed for a fight room
 */
export function createFightRoomEmbed(options: FightRoomOptions): EmbedBuilder {
  const { roomCode, participants, creator } = options;

  const participantMentions = participants.map(p => `<@${p.id}>`).join('\n');

  return new EmbedBuilder()
    .setColor(EmbedColors.FIGHT_ROOM)
    .setTitle(`${CustomEmoji.RED_CHECK} Room Created!`)
    .addFields(
      {
        name: '🎮 Room Code',
        value: `\`\`\`${roomCode}\`\`\``,
        inline: false
      },
      {
        name: `${CustomEmoji.PEPO_FIGHT} Participants`,
        value: participantMentions,
        inline: false
      }
    )
    .setFooter({
      text: `Created by ${creator.tag}`,
      iconURL: creator.displayAvatarURL()
    })
    .setTimestamp();
}

/**
 * Gets the content string for mentioning all participants
 */
export function getParticipantMentions(participants: FightRoomOptions['participants']): string {
  return participants.map(p => `<@${p.id}>`).join(' ');
}

/**
 * Creates a confirmation embed before starting a purge
 */
export function createPurgeConfirmEmbed(target: User, channelCount: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.PURGE_CONFIRM)
    .setTitle('⚠️ Confirm Purge')
    .setDescription(
      `This will delete **all** messages from <@${target.id}> across **${channelCount}** text channel(s).\n\n` +
      `**This action is irreversible.**`
    )
    .setFooter({ text: 'This confirmation expires in 60 seconds' })
    .setTimestamp();
}

/**
 * Creates a progress embed shown while a purge is running
 */
export function createPurgeProgressEmbed(target: User, progress: PurgeProgress): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.PURGE_CONFIRM)
    .setTitle('🔄 Purge In Progress')
    .setDescription(`Deleting messages from <@${target.id}>...`)
    .addFields(
      {
        name: 'Current Channel',
        value: `#${progress.currentChannelName}`,
        inline: true,
      },
      {
        name: 'Channels Scanned',
        value: `${progress.channelsScanned} / ${progress.totalChannels}`,
        inline: true,
      },
      {
        name: 'Messages Deleted',
        value: `${progress.messagesDeleted}`,
        inline: true,
      }
    )
    .setTimestamp();
}

/**
 * Creates an embed shown when a purge is aborted mid-run
 */
export function createPurgeAbortedEmbed(
  target: User,
  messagesDeleted: number,
  channelsScanned: number
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.PURGE_CONFIRM)
    .setTitle('🛑 Purge Aborted')
    .setDescription(
      `Purge of <@${target.id}> was stopped.\n\n` +
      `**${messagesDeleted}** message(s) deleted across **${channelsScanned}** channel(s) before abort.`
    )
    .setTimestamp();
}

/**
 * Creates a completion embed shown when a purge finishes
 */
export function createPurgeCompleteEmbed(
  target: User,
  totalDeleted: number,
  channelsScanned: number
): EmbedBuilder {
  const description =
    totalDeleted === 0
      ? `No messages found from <@${target.id}>.`
      : `Deleted **${totalDeleted}** message(s) from <@${target.id}> across **${channelsScanned}** channel(s).`;

  return new EmbedBuilder()
    .setColor(EmbedColors.PURGE_COMPLETE)
    .setTitle('✅ Purge Complete')
    .setDescription(description)
    .setTimestamp();
}
