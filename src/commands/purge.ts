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
  createPurgeAbortedEmbed,
} from '../lib/embeds.js';
import { purgeChannelMessages } from '../lib/messages.js';
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
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Specific channel to purge (defaults to all text channels)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
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

      // Use specific channel if provided, otherwise all top-level text channels
      const specificChannel = interaction.options.getChannel('channel') as TextChannel | null;

      let textChannels: TextChannel[];
      if (specificChannel) {
        textChannels = [specificChannel];
      } else {
        textChannels = [...guild.channels.cache
          .filter((ch): ch is TextChannel => ch.type === ChannelType.GuildText)
          .values()];
      }

      if (textChannels.length === 0) {
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

      const confirmEmbed = createPurgeConfirmEmbed(target, textChannels.length);

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
        totalChannels: textChannels.length,
        channelsScanned: 0,
        currentChannelName: '',
        messagesDeleted: 0,
      };

      const abortButton = new ButtonBuilder()
        .setCustomId('purge-abort')
        .setLabel('Abort')
        .setStyle(ButtonStyle.Secondary);

      const abortRow = new ActionRowBuilder<ButtonBuilder>().addComponents(abortButton);

      await buttonInteraction.update({
        content: null,
        embeds: [createPurgeProgressEmbed(target, { ...progress, currentChannelName: 'Starting...' })],
        components: [abortRow],
      });

      // Listen for the abort button click throughout the purge
      let aborted = false;
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.customId === 'purge-abort' && i.user.id === interaction.user.id,
      });

      collector.on('collect', async (i) => {
        aborted = true;
        await i.deferUpdate();
        collector.stop();
      });

      for (const channel of textChannels) {
        if (aborted) break;

        progress.currentChannelName = channel.name;

        try {
          // Remember the count before this channel so we can show
          // a live running total as chunks are deleted
          const baseDeleted = progress.messagesDeleted;

          const deleted = await purgeChannelMessages(
            channel,
            target.id,
            () => aborted,
            (runningTotal) => {
              // runningTotal = cumulative deletes within this channel
              progress.messagesDeleted = baseDeleted + runningTotal;
              interaction.editReply({
                embeds: [createPurgeProgressEmbed(target, { ...progress })],
                components: aborted ? [] : [abortRow],
              }).catch(() => {});
            }
          );

          progress.messagesDeleted = baseDeleted + deleted;
        } catch (error) {
          // Per-channel errors shouldn't abort the whole purge
          console.error(`Error purging #${channel.name}:`, error);
        }

        progress.channelsScanned++;

        // Update progress embed after finishing the channel
        try {
          await interaction.editReply({
            embeds: [createPurgeProgressEmbed(target, { ...progress })],
            components: aborted ? [] : [abortRow],
          });
        } catch {
          // Interaction token expired; continue purging silently
        }
      }

      collector.stop();

      // Show final embed
      try {
        const finalEmbed = aborted
          ? createPurgeAbortedEmbed(target, progress.messagesDeleted, progress.channelsScanned)
          : createPurgeCompleteEmbed(target, progress.messagesDeleted, progress.channelsScanned);

        await interaction.editReply({
          embeds: [finalEmbed],
          components: [],
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
