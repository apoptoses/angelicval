const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { PlayerStats } = require('../../Data/player-stats');

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName('reset-stats')
        .setDescription('[ADMIN] Reset all player statistics')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false),
    
    async execute(interaction) {
        try {
            await interaction.reply({
                content: 'Starting stats reset...',
                fetchReply: true
            });

            const confirmEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⚠️ Database Reset ⚠️')
                .setDescription('This will **PERMANENTLY DELETE** ALL player statistics!\n\n'
                    + '**This action cannot be undone!**\n'
                    + 'React with ✅ to confirm or ❌ to cancel.')
                .setFooter({ text: 'This confirmation will expire in 15 seconds' });

            const confirmMessage = await interaction.editReply({
                content: '',
                embeds: [confirmEmbed]
            });

            await confirmMessage.react('✅');
            await confirmMessage.react('❌');

            const filter = (reaction, user) => 
                ['✅', '❌'].includes(reaction.emoji.name) && 
                user.id === interaction.user.id;

            const collector = await confirmMessage.awaitReactions({
                filter,
                max: 1,
                time: 15000,
                errors: ['time']
            });

            const reaction = collector.first();
            
            if (reaction.emoji.name === '❌') {
                await interaction.editReply({
                    content: 'Stats reset cancelled',
                    embeds: [],
                    components: []
                });
                return;
            }

            const result = await PlayerStats.deleteMany({});
            
            const successEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Database Cleared')
                .setDescription(`Successfully removed ${result.deletedCount} player records`);

            await interaction.editReply({
                content: '',
                embeds: [successEmbed],
                components: [],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Error resetting stats:', error);
            
            if (error.name === 'TimeoutError') {
                await interaction.editReply({
                    content: 'Confirmation timed out - no changes made',
                    embeds: [],
                    components: [],
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.followUp({
                    content: 'Failed to reset stats. Please check server logs.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
};