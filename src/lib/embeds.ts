import { EmbedBuilder } from 'discord.js';
import type { FightRoomOptions } from './types.js';
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
