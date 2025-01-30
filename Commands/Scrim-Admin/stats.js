const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayerStats } = require('../../Data/player-stats');

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName('player-stats')
        .setDescription('Show detailed Valorant player statistics')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Player\'s in-game name')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tag')
                .setDescription('Player\'s tag')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const createAsciiGraph = (wins, losses) => {
            const total = wins + losses;
            if (total === 0) return "No matches played";
            
            const winPercentage = (wins / total) * 100;
            const lossPercentage = (losses / total) * 100;
            
            const winBars = '█'.repeat(Math.round(winPercentage / 10));
            const lossBars = '░'.repeat(10 - winBars.length);
        
            return [
                `[2;32mWins[0m   ${winBars} ${winPercentage.toFixed(1)}%`,
                `[2;31mLosses[0m ${lossBars} ${lossPercentage.toFixed(1)}%`
            ].join('\n');
        };

        const getRankEmoji = (rank) => {
            const ranks = ['☆', '★', '✧', '✦', '✪'];
            return ranks[Math.min(rank - 1, ranks.length - 1)] || '☆';
        };

        const createColoredLine = (label, value, colorCode, padLength = 8) => {
            const visibleLabelLength = label.length;
            const ansiLabel = `[2;${colorCode}m${label}[0m`;
            const padding = ' '.repeat(padLength - visibleLabelLength);
            return `${ansiLabel}${padding}▸ ${value}`;
        };

        try {
            const name = interaction.options.getString('name');
            const tag = interaction.options.getString('tag');
            
            const player = await getPlayerStats(name, tag);
            
            if (!player) {
                return await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ff4654')
                            .setTitle('🔍 Player Not Found')
                            .setDescription(`Couldn't find stats for **${name}#${tag}**\nStart tracking by finishing a match!`)
                            .setThumbnail('https://i.postimg.cc/3R8Tw2Zy/valorant-error.png')
                            .setFooter({ text: 'Stats will appear after first recorded match' })
                    ]
                });
            }

            const winRate = (player.wins / (player.wins + player.losses) * 100 || 0).toFixed(1);
            const kdRatio = (player.kills / player.deaths || 0).toFixed(2);
            const hsPercentage = player.headshotPercentage.toFixed(1);
            const avgACS = (player.matchData.reduce((sum, match) => sum + match.acs, 0) / player.processedMatches.length).toFixed(0);

            const statsEmbed = new EmbedBuilder()
                .setColor('#ff4654')
                .setAuthor({ 
                    name: `${name}#${tag}`,
                    iconURL: 'https://i.postimg.cc/3R8Tw2Zy/valorant-logo.png' 
                })
                .setThumbnail('https://i.postimg.cc/3R8Tw2Zy/valorant-rank.png')
                .addFields(
                    { 
                        name: '🏆 Scrim Overview',
                        value: [
                            `▫️ **Matches:** \`${player.processedMatches.length}\``,
                            `▫️ **Win Rate:** \`${winRate}%\``,
                            `▫️ **Current Streak:** \`${getRankEmoji(player.matchMVPs)}\``,
                            `\`\`\`ansi\n${createAsciiGraph(player.wins, player.losses)}\`\`\``
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '🔫 Combat Performance',
                    value: [
                        '```ansi',
                        createColoredLine('Kills', player.kills, '34'),
                        createColoredLine('Deaths', player.deaths, '31'),
                        createColoredLine('Assists', player.assists, '32'),
                        createColoredLine('K/D', kdRatio, '36'),
                        createColoredLine('HS%', `${hsPercentage}%`, '35'),
                        createColoredLine('ACS', avgACS, '33'),
                        '```'
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '🎖️ MVPs',
                        value: [
                            '```diff',
                            `+ Match MVPs: ${player.matchMVPs} 🏅`,
                            `+ Team MVPs:  ${player.teamMVPs} 🥈`,
                            '```'
                        ].join('\n'),
                        inline: true
                    }
                )
                .setFooter({ 
                    text: `Last Updated • ${player.lastUpdated.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: '2-digit', 
                        year: 'numeric' 
                    })}`,
                    iconURL: 'https://i.postimg.cc/3R8Tw2Zy/valorant-footer.png'
                });

            await interaction.editReply({ embeds: [statsEmbed] });
            
        } catch (error) {
            console.error('Error fetching player stats:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🚨 Data Retrieval Error')
                        .setDescription('Failed to load player statistics\nPlease try again later')
                        .setThumbnail('https://i.postimg.cc/3R8Tw2Zy/valorant-error.png')
                ]
            });
        }
    }
};