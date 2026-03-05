import { Command } from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type TextChannel,
} from 'discord.js';
import { PurgeConfig } from '../lib/constants.js';
import {
  createPurgeConfirmEmbed,
  createPurgeProgressEmbed,
  createPurgeCompleteEmbed,
} from '../lib/embeds.js';
import {
  fetchAllUserMessages,
  bulkDeleteMessages,
  deleteOldMessages,
} from '../lib/messages.js';
import type { PurgeProgress } from '../lib/types.js';

export class PurgeCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'purge',
      description: 'Delete all messages from a user across every text channel',
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addUserOption((option) =>
          option
            .setName('target')
            .setDescription('The user whose messages will be deleted')
            .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    );
  }

  public async chatInputRun(interaction: ChatInputCommandInteraction) {
    try {
      const target = interaction.options.getUser('target', true);
      const guild = interaction.guild;

      if (!guild) {
        return interaction.reply({
          content: '❌ This command can only be used in a server.',
          flags: ['Ephemeral'],
        });
      }

      // Gather top-level text channels only (no threads)
      const textChannels = guild.channels.cache.filter(
        (ch): ch is TextChannel => ch.type === ChannelType.GuildText
      );

      if (textChannels.size === 0) {
        return interaction.reply({
          content: '❌ No text channels found in this server.',
          flags: ['Ephemeral'],
        });
      }

      // Show confirmation embed with buttons
      const confirmButton = new ButtonBuilder()
        .setCustomId('purge-confirm')
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId('purge-cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        confirmButton,
        cancelButton
      );

      const confirmEmbed = createPurgeConfirmEmbed(target, textChannels.size);

      const reply = await interaction.reply({
        embeds: [confirmEmbed],
        components: [row],
        flags: ['Ephemeral'],
      });

      // Await button interaction
      let buttonInteraction;
      try {
        buttonInteraction = await reply.awaitMessageComponent({
          componentType: ComponentType.Button,
          filter: (i) => i.user.id === interaction.user.id,
          time: PurgeConfig.CONFIRMATION_TIMEOUT,
        });
      } catch {
        // Timed out
        await interaction.editReply({
          content: '⏰ Purge confirmation timed out.',
          embeds: [],
          components: [],
        });
        return;
      }

      if (buttonInteraction.customId === 'purge-cancel') {
        await buttonInteraction.update({
          content: '❌ Purge cancelled.',
          embeds: [],
          components: [],
        });
        return;
      }

      // Confirmed — start purging
      const progress: PurgeProgress = {
        totalChannels: textChannels.size,
        channelsScanned: 0,
        currentChannelName: '',
        messagesDeleted: 0,
      };

      await buttonInteraction.update({
        content: null,
        embeds: [createPurgeProgressEmbed(target, { ...progress, currentChannelName: 'Starting...' })],
        components: [],
      });

      for (const channel of textChannels.values()) {
        progress.currentChannelName = channel.name;

        try {
          const { recent, old } = await fetchAllUserMessages(channel, target.id);

          if (recent.length > 0) {
            progress.messagesDeleted += await bulkDeleteMessages(channel, recent);
          }

          if (old.length > 0) {
            progress.messagesDeleted += await deleteOldMessages(old);
          }
        } catch (error) {
          // Per-channel errors shouldn't abort the whole purge
          console.error(`Error purging #${channel.name}:`, error);
        }

        progress.channelsScanned++;

        // Update progress embed — catch failures gracefully
        // (interaction token expires after 15 min for very large purges)
        try {
          await interaction.editReply({
            embeds: [createPurgeProgressEmbed(target, { ...progress })],
          });
        } catch {
          // Interaction token expired; continue purging silently
        }
      }

      // Show completion embed
      try {
        await interaction.editReply({
          embeds: [
            createPurgeCompleteEmbed(
              target,
              progress.messagesDeleted,
              progress.channelsScanned
            ),
          ],
        });
      } catch {
        // Interaction token may have expired
      }
    } catch (error) {
      console.error('Error running purge command:', error);
      return this.handleError(interaction);
    }
  }

  private async handleError(interaction: ChatInputCommandInteraction) {
    const errorMessage = {
      content: '❌ Failed to execute purge. Please try again.',
      flags: ['Ephemeral'] as const,
    };

    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(errorMessage);
    }

    return interaction.reply(errorMessage);
  }
}
