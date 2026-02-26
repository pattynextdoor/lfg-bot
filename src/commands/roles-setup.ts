import { Command } from '@sapphire/framework';
import type { ChatInputCommandInteraction, Role } from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { EmbedColors } from '../lib/constants.js';

export class RolesSetupCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'roles-setup',
      description: 'Create a self-assign roles panel with buttons (admin only)'
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) => {
      builder
        .setName(this.name)
        .setDescription(this.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Title for the roles panel')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Description shown above the buttons')
            .setRequired(false)
        );

      for (let i = 1; i <= 10; i++) {
        builder.addRoleOption(option =>
          option
            .setName(`role${i}`)
            .setDescription(`Role #${i}`)
            .setRequired(i === 1)
        );
      }

      return builder;
    });
  }

  public async chatInputRun(interaction: ChatInputCommandInteraction) {
    try {
      const title = interaction.options.getString('title') ?? 'Self-Assign Roles';
      const description = interaction.options.getString('description') ?? 'Click a button below to toggle a role on or off.';

      const roles = this.extractRoles(interaction);

      if (roles.length === 0) {
        return interaction.reply({
          content: '❌ You must provide at least one role.',
          flags: ['Ephemeral']
        });
      }

      // Validate bot can manage these roles
      const botMember = await interaction.guild?.members.fetchMe();
      if (!botMember) {
        return interaction.reply({
          content: '❌ Could not fetch bot member info.',
          flags: ['Ephemeral']
        });
      }

      const unmanageable = roles.filter(
        r => r.position >= botMember.roles.highest.position || r.managed
      );

      if (unmanageable.length > 0) {
        return interaction.reply({
          content: `❌ I cannot manage these roles (above my highest role or managed by an integration): ${unmanageable.map(r => r.name).join(', ')}`,
          flags: ['Ephemeral']
        });
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(EmbedColors.ROLES_PANEL)
        .setTitle(title)
        .setDescription(description);

      // Build button rows (max 5 per row)
      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      for (let i = 0; i < roles.length; i += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        const chunk = roles.slice(i, i + 5);
        for (const role of chunk) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`role-toggle:${role.id}`)
              .setLabel(role.name)
              .setStyle(ButtonStyle.Secondary)
          );
        }
        rows.push(row);
      }

      // Post the panel to the channel
      const channel = interaction.channel;
      if (!channel || !('send' in channel)) {
        return interaction.reply({
          content: '❌ Cannot send messages in this channel.',
          flags: ['Ephemeral']
        });
      }

      await channel.send({
        embeds: [embed],
        components: rows
      });

      await interaction.reply({
        content: '✅ Roles panel created!',
        flags: ['Ephemeral']
      });
    } catch (error) {
      console.error('Error creating roles panel:', error);
      const errorMessage = {
        content: '❌ Failed to create roles panel. Please try again.',
        flags: ['Ephemeral'] as const
      };

      if (interaction.deferred || interaction.replied) {
        return interaction.followUp(errorMessage);
      }
      return interaction.reply(errorMessage);
    }
  }

  private extractRoles(interaction: ChatInputCommandInteraction): Role[] {
    const roles: Role[] = [];
    for (let i = 1; i <= 10; i++) {
      const role = interaction.options.getRole(`role${i}`);
      if (role) roles.push(role as Role);
    }
    return roles;
  }
}
