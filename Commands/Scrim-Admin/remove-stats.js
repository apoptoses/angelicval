const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { removeMatchStats } = require('../../Data/player-stats');

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName('remove-stats')
        .setDescription('Remove all stats associated with a match ID')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('matchid')
                .setDescription('The match ID to remove')
                .setRequired(true)),
    
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: "You don't have permission to use this command. Administrator rights are required.",
                flags: 64
            });
            return;
        }

        await interaction.deferReply({ flags: 64 });
        
        try {
            const matchId = interaction.options.getString('matchid');
            
            await removeMatchStats(matchId);
            
            await interaction.editReply({
                content: `Successfully removed stats for match \`${matchId}\``,
                flags: 64
            });
            
        } catch (error) {
            console.error('Error removing match stats:', error);
            await interaction.editReply({
                content: `Failed to remove stats: ${error.message}`,
                flags: 64
            });
        }
    }
};