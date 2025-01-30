const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { PlayerStats } = require('../../Data/player-stats');

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName('update-player-stats')
        .setDescription('Merge two player records into one')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => 
            option.setName('old_name')
                .setDescription('The player\'s old in-game name')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('old_tag')
                .setDescription('The player\'s old tag')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('new_name')
                .setDescription('The player\'s new in-game name')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('new_tag')
                .setDescription('The player\'s new tag')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const oldName = interaction.options.getString('old_name');
        const oldTag = interaction.options.getString('old_tag');
        const newName = interaction.options.getString('new_name');
        const newTag = interaction.options.getString('new_tag');

        try {
            const oldPlayer = await PlayerStats.findOne({ name: oldName, tag: oldTag });
            const newPlayer = await PlayerStats.findOne({ name: newName, tag: newTag });

            if (!oldPlayer) {
                return interaction.editReply(`No player found with the name ${oldName}#${oldTag}.`);
            }

            if (!newPlayer) {
                return interaction.editReply(`No player found with the name ${newName}#${newTag}.`);
            }

            newPlayer.kills += oldPlayer.kills;
            newPlayer.deaths += oldPlayer.deaths;
            newPlayer.assists += oldPlayer.assists;
            newPlayer.wins += oldPlayer.wins;
            newPlayer.losses += oldPlayer.losses;
            newPlayer.totalHeadshots += oldPlayer.totalHeadshots;
            newPlayer.totalBodyshots += oldPlayer.totalBodyshots;
            newPlayer.totalLegshots += oldPlayer.totalLegshots;
            newPlayer.matchMVPs += oldPlayer.matchMVPs;
            newPlayer.teamMVPs += oldPlayer.teamMVPs;

            newPlayer.processedMatches = [...new Set([...newPlayer.processedMatches, ...oldPlayer.processedMatches])];
            newPlayer.matchData = [...newPlayer.matchData, ...oldPlayer.matchData];

            newPlayer.lastUpdated = new Date();

            await newPlayer.save();

            await PlayerStats.deleteOne({ _id: oldPlayer._id });

            await interaction.editReply(`Successfully merged player records from ${oldName}#${oldTag} into ${newName}#${newTag}.`);
        } catch (error) {
            console.error('Error merging player records:', error);
            await interaction.editReply('An error occurred while merging player records. Please try again later.');
        }
    }
};