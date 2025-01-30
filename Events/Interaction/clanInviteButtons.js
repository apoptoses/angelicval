const { Client, ButtonInteraction } = require('discord.js');
const Clan = require('../../Data/clan');

module.exports = {
    name: 'interactionCreate',
    enabled: true,
    /**
     *
     * @param {ButtonInteraction} interaction
     */
    async execute(interaction, client) {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'invite-yes') {

            const clan = await Clan.findOne({ pendingInvitations: { $in: [interaction.user.id] } });
            if (!clan) {
                interaction.reply({ content: `You have no pending invitations.`, ephemeral: true });
                return;
            }

            if (!clan.members.includes(interaction.user.id)) {
                clan.members.push(interaction.user.id);
                clan.pendingInvitations = clan.pendingInvitations.filter(id => id !== interaction.user.id);
                await clan.save();

                const member = await interaction.guild.members.fetch(interaction.user.id);
                const role = interaction.guild.roles.cache.find(role => role.id === clan.clanRole);
                member.roles.add(role);

                interaction.reply({ content: `You have joined the clan "${clan.name}".`, ephemeral: true });
            } else {
                clan.pendingInvitations = clan.pendingInvitations.filter(id => id !== interaction.user.id);
                await clan.save();
                interaction.reply({ content: `You are already a member of this clan.`, ephemeral: true });
            }

            try {
                await interaction.message.delete();
            } catch (error) {
                console.error('Failed to delete the message:', error);
            }

        }

        if (interaction.customId === 'invite-no') {

            const clan = await Clan.findOne({ pendingInvitations: { $in: [interaction.user.id] } });
            if (!clan) {
                interaction.reply({ content: `You have no pending invitations.`, ephemeral: true });
                return;
            }

            clan.pendingInvitations = clan.pendingInvitations.filter(id => id !== interaction.user.id);
            await clan.save();
            interaction.reply({ content: `You have declined the invitation to join the clan.`, ephemeral: true });

            try {
                await interaction.message.delete();
            } catch (error) {
                console.error('Failed to delete the message:', error);
            }

        }

    }
}
