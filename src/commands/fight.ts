import { Command } from '@sapphire/framework';
import type { ChatInputCommandInteraction, User } from 'discord.js';
import { createFightRoomEmbed, getParticipantMentions } from '../lib/embeds.js';
import { getTargetChannel } from '../lib/channels.js';
import { ThreadConfig } from '../lib/constants.js';

export class FightCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'fight',
      description: 'Create a fight thread with room code and participants'
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption(option =>
          option
            .setName('roomcode')
            .setDescription('The room code for the fight')
            .setRequired(true)
        )
        .addUserOption(option =>
          option
            .setName('participant1')
            .setDescription('First participant')
            .setRequired(true)
        )
        .addUserOption(option =>
          option
            .setName('participant2')
            .setDescription('Second participant')
            .setRequired(false)
        )
        .addUserOption(option =>
          option
            .setName('participant3')
            .setDescription('Third participant')
            .setRequired(false)
        )
        .addUserOption(option =>
          option
            .setName('participant4')
            .setDescription('Fourth participant')
            .setRequired(false)
        )
        .addUserOption(option =>
          option
            .setName('participant5')
            .setDescription('Fifth participant')
            .setRequired(false)
        )
    );
  }

  public async chatInputRun(interaction: ChatInputCommandInteraction) {
    try {
      // Extract command options
      const roomCode = interaction.options.getString('roomcode', true);
      const participants = this.extractParticipants(interaction);

      // Get target channel for thread creation
      const channel = await getTargetChannel(
        interaction.client,
        process.env.FIGHT_CHANNEL_ID,
        interaction.channel
      );

      if (!channel) {
        return interaction.reply({
          content: '❌ Cannot create threads in this channel type.',
          flags: ['Ephemeral']
        });
      }

      // Create the thread
      const thread = await channel.threads.create({
        name: `Room: ${roomCode}`,
        autoArchiveDuration: ThreadConfig.AUTO_ARCHIVE_DURATION,
        reason: `Thread created by ${interaction.user.tag}`
      });

      // Send embed to thread
      const embed = createFightRoomEmbed({
        roomCode,
        participants,
        creator: interaction.user
      });

      await thread.send({
        content: getParticipantMentions(participants),
        embeds: [embed]
      });

      // Reply to user
      await interaction.reply({
        content: `✅ Thread created: ${thread.toString()}`,
        flags: ['Ephemeral']
      });

    } catch (error) {
      console.error('Error creating thread:', error);
      return this.handleError(interaction);
    }
  }

  /**
   * Extracts all participant users from the interaction options
   */
  private extractParticipants(interaction: ChatInputCommandInteraction): User[] {
    const participants: User[] = [];
    for (let i = 1; i <= 5; i++) {
      const participant = interaction.options.getUser(`participant${i}`);
      if (participant) {
        participants.push(participant);
      }
    }
    return participants;
  }

  /**
   * Handles errors when creating a fight thread
   */
  private async handleError(interaction: ChatInputCommandInteraction) {
    const errorMessage = {
      content: '❌ Failed to create thread. Please try again.',
      flags: ['Ephemeral'] as const
    };

    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(errorMessage);
    }

    return interaction.reply(errorMessage);
  }
}
