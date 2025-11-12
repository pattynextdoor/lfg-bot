import { Command } from '@sapphire/framework';
import type { ChatInputCommandInteraction, User } from 'discord.js';

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
      // Get the room code
      const roomCode = interaction.options.getString('roomcode', true);

      // Get all participants
      const participants: User[] = [];
      for (let i = 1; i <= 5; i++) {
        const participant = interaction.options.getUser(`participant${i}`);
        if (participant) {
          participants.push(participant);
        }
      }

      // Try to get the configured channel, fallback to current channel
      let channel = interaction.channel;

      if (process.env.FIGHT_CHANNEL_ID) {
        try {
          const configuredChannel = await interaction.client.channels.fetch(process.env.FIGHT_CHANNEL_ID);
          if (configuredChannel && configuredChannel.isTextBased() && !configuredChannel.isDMBased() && 'threads' in configuredChannel) {
            channel = configuredChannel;
          } else {
            console.warn('Configured FIGHT_CHANNEL_ID is invalid, using current channel instead');
          }
        } catch (error) {
          console.warn('Failed to fetch configured channel, using current channel instead:', error);
        }
      }

      // Validate the channel
      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        return interaction.reply({
          content: '❌ Cannot create threads in this channel type.',
          ephemeral: true
        });
      }

      // Check if the channel supports threads
      if (!('threads' in channel)) {
        return interaction.reply({
          content: '❌ This channel does not support threads.',
          ephemeral: true
        });
      }

      // Create the thread
      const threadName = `Fight - Room: ${roomCode}`;
      const thread = await channel.threads.create({
        name: threadName,
        autoArchiveDuration: 60, // Archive after 1 hour of inactivity
        reason: `Fight thread created by ${interaction.user.tag}`
      });

      // Create the initial message with participants
      const participantMentions = participants.map(p => `<@${p.id}>`).join(', ');
      await thread.send({
        content: `🥊 **Fight Created!**\n\n` +
                 `**Room Code:** \`${roomCode}\`\n` +
                 `**Participants:** ${participantMentions}\n\n` +
                 `Good luck and have fun!`
      });

      // Reply to the interaction
      await interaction.reply({
        content: `✅ Fight thread created: ${thread.toString()}`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error creating fight thread:', error);

      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({
          content: '❌ Failed to create fight thread. Please try again.',
          ephemeral: true
        });
      }

      return interaction.reply({
        content: '❌ Failed to create fight thread. Please try again.',
        ephemeral: true
      });
    }
  }
}
