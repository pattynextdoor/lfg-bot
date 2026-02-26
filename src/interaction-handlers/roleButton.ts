import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';

export class RoleButtonHandler extends InteractionHandler {
  public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button
    });
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith('role-toggle:')) return this.none();

    const roleId = interaction.customId.slice('role-toggle:'.length);
    return this.some(roleId);
  }

  public async run(interaction: ButtonInteraction, roleId: InteractionHandler.ParseResult<this>) {
    if (!interaction.guild || !interaction.member) {
      return interaction.reply({
        content: '❌ This can only be used in a server.',
        flags: ['Ephemeral']
      });
    }

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const role = await interaction.guild.roles.fetch(roleId);

      if (!role) {
        return interaction.reply({
          content: '❌ This role no longer exists.',
          flags: ['Ephemeral']
        });
      }

      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        return interaction.reply({
          content: `✅ Removed the **${role.name}** role.`,
          flags: ['Ephemeral']
        });
      } else {
        await member.roles.add(roleId);
        return interaction.reply({
          content: `✅ Added the **${role.name}** role.`,
          flags: ['Ephemeral']
        });
      }
    } catch (error) {
      console.error('Error toggling role:', error);
      return interaction.reply({
        content: '❌ Failed to update your role. The bot may not have permission to manage this role.',
        flags: ['Ephemeral']
      });
    }
  }
}
