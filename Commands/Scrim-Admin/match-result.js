const fs = require('fs');
const yaml = require('js-yaml');
const axios = require('axios');
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = yaml.load(fs.readFileSync('./Config/config.yml', 'utf8'));
const { updatePlayerStats } = require('../../Data/player-stats');


async function getPlayerPUUID(name, tag) {
    try {
        const response = await axios.get(`https://api.henrikdev.xyz/valorant/v1/account/${name}/${tag}`, {
            headers: {
                'Authorization': config.ApiKey
            }
        });

        if (response.data?.data?.puuid) {
            return response.data.data.puuid;
        } else {
            console.error('API Response:', response.data);
            throw new Error('PUUID not found');
        }
    } catch (error) {
        console.error('Error fetching player PUUID:', error.message);
        return null;
    }
}

async function getPlayerCustomMatches(puuid, region = 'na') {
    try {
        const response = await axios.get(`https://api.henrikdev.xyz/valorant/v3/by-puuid/matches/${region}/${puuid}?size=10&mode=custom`, {
            headers: {
                'Authorization': config.ApiKey
            }
        });

        if (response.data && Array.isArray(response.data.data)) {
            return response.data.data
                .filter(match => match?.metadata?.mode === 'Custom Game' &&
                            match.metadata.mode_id === 'custom' &&
                            match.metadata.queue === 'Standard')
                .map(match => match.metadata.matchid);
        }
        throw new Error('Invalid match history response');
    } catch (error) {
        console.error('Error fetching custom matches:', error.message);
        return null;
    }
}

async function getMatchDetails(matchId) {
    try {
        const response = await axios.get(`https://api.henrikdev.xyz/valorant/v2/match/${matchId}`, {
            headers: {
                'Authorization': config.ApiKey
            }
        });

        const matchData = response.data?.data;
        if (!matchData) {
            console.error(`Match ${matchId} has no data in the response`);
            return null;
        }
        
        const isValid = matchData.players?.all_players?.length === 10 &&
                    matchData.metadata.mode === 'Custom Game' &&
                    matchData.metadata.queue === 'Standard';

        console.log(`Match ${matchId} validation:`, isValid); 

        return isValid ? matchData : null;
    } catch (error) {
        console.error(`Error fetching match details for ${matchId}:`, error.message);
        return null;
    }
}

function getAllPlayersStats(matchDetails) {
    const roundsPlayed = matchDetails.metadata.rounds_played || 1;
    const allPlayers = matchDetails.players.all_players;

    const players = allPlayers.map(player => {
        const team = player.team.toLowerCase();
        const won = matchDetails.teams[team]?.has_won || false;

        const maxScore = Math.max(...allPlayers.map(p => p.stats.score));
        const topScorers = allPlayers.filter(p => p.stats.score === maxScore);
        const isMatchMVP = player.stats.score === maxScore && topScorers[0].puuid === player.puuid;

        const teamPlayers = allPlayers.filter(p => p.team === player.team);
        const maxTeamScore = Math.max(...teamPlayers.map(p => p.stats.score));
        const topTeamScorers = teamPlayers.filter(p => p.stats.score === maxTeamScore);
        const isTeamMVP = !isMatchMVP && player.stats.score === maxTeamScore && topTeamScorers[0].puuid === player.puuid;

        const headshots = player.stats.headshots;
        const bodyshots = player.stats.bodyshots;
        const legshots = player.stats.legshots;
        const totalShots = headshots + bodyshots + legshots;
        const headshotPercentage = totalShots > 0 
            ? ((headshots / totalShots) * 100).toFixed(2)
            : 0;

        const points = (won ? 5 : 0) + (isMatchMVP ? 3 : 0) + (isTeamMVP ? 1 : 0);

        return {
            puuid: player.puuid,
            name: player.name,
            tag: player.tag,
            team: player.team,
            agent: player.character,
            kills: player.stats.kills,
            deaths: player.stats.deaths,
            assists: player.stats.assists,
            score: player.stats.score,
            won: won,
            isTeamMVP,
            isMatchMVP,
            headshots,
            bodyshots,
            legshots,
            headshotPercentage,
            points,
            acs: Math.floor(player.stats.score / roundsPlayed)
        };
    });

    players.sort((a, b) => b.score - a.score);
    
    return {
        players: players.map((player, index) => ({
            ...player,
            ranking: index + 1
        })),
        averageACS: Math.floor(players.reduce((sum, p) => sum + p.acs, 0) / players.length)
    };
}

module.exports = {
    getPlayerPUUID,
    getPlayerCustomMatches,
    getMatchDetails,
    getAllPlayersStats,
    enabled: true,
    data: new SlashCommandBuilder()
        .setName('match-result')
        .setDescription('Get the most recent custom match results for a player')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addStringOption(option => 
            option.setName('name')
                .setDescription('The player\'s in-game name')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('tag')
                .setDescription('The player\'s tag')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const createPlayerLine = (player) => {
            const mvpBadge = player.isMatchMVP ? '👑 ' : player.isTeamMVP ? '🌟 ' : '';
            const teamIcon = player.team === 'Blue' ? '🔵' : '🔴';
            const mvpText = player.isMatchMVP ? '**MATCH MVP**' : player.isTeamMVP ? '**TEAM MVP**' : '';
            
            return [
                `${teamIcon} ${mvpBadge}**${player.name}#${player.tag}** (${player.agent})`,
                ...(mvpText ? [mvpText] : []),
                '```ansi',
                `[2;33mACS ${player.acs.toString().padEnd(4)}[0m | ` +
                `[2;34mK[0m/[2;31mD[0m/[2;32mA[0m ` +
                `[2;34m${player.kills}[0m/[2;31m${player.deaths}[0m/[2;32m${player.assists}[0m`,
                `[2;35mHS% ${player.headshotPercentage}%[0m | ` +
                `[38;5;208mPoints ${player.points}[0m`,
                '```'
            ].join('\n');
        };

        try {
            const name = interaction.options.getString('name');
            const tag = interaction.options.getString('tag');
    
            const puuid = await getPlayerPUUID(name, tag);
            if (!puuid) {
                await interaction.editReply(`❌ Failed to fetch PUUID for ${name}#${tag}`);
                return;
            }
    
            const customMatchIds = await getPlayerCustomMatches(puuid);
            if (!customMatchIds?.length) {
                await interaction.editReply('❌ No valid custom matches found for this player');
                return;
            }
    
            const mostRecentMatchId = customMatchIds[0];
            const matchDetails = await getMatchDetails(mostRecentMatchId);
            if (!matchDetails) {
                await interaction.editReply('❌ Failed to fetch details for most recent match');
                return;
            }
    
            const allPlayersStats = getAllPlayersStats(matchDetails);
    
            const blueTeamData = matchDetails.teams.blue;
            const redTeamData = matchDetails.teams.red;
    
            const blueRounds = blueTeamData.rounds_won;
            const blueHasWon = blueTeamData.has_won;
    
            const redRounds = redTeamData.rounds_won;
            const redHasWon = redTeamData.has_won;
    
            for (const player of allPlayersStats.players) {
                await updatePlayerStats(player.name, player.tag, {
                    puuid: player.puuid,
                    kills: player.kills,
                    deaths: player.deaths,
                    assists: player.assists,
                    score: player.score,
                    won: player.won,
                    headshots: player.headshots,
                    bodyshots: player.bodyshots,
                    legshots: player.legshots,
                    isMatchMVP: player.isMatchMVP,
                    isTeamMVP: player.isTeamMVP,
                    agent: player.agent,
                    acs: player.acs,
                    matchId: mostRecentMatchId
                });
            }
    
            const blueTeam = allPlayersStats.players.filter(p => p.team === 'Blue');
            const redTeam = allPlayersStats.players.filter(p => p.team === 'Red');
    
            const mainEmbed = new EmbedBuilder()
                .setColor('#ff4654')
                .setTitle(`🔫 Match Report • ${mostRecentMatchId}`)
                .setThumbnail('https://i.ibb.co/0jQ3q1G/valorant-logo.png')
                .addFields(
                    { 
                        name: '📊 Match Overview',
                        value: [
                            `▫️ **Map:** \`${matchDetails.metadata.map}\``,
                            `▫️ **Mode:** \`${matchDetails.metadata.mode}\``,
                            `▫️ **Rounds:** \`${matchDetails.metadata.rounds_played}\``,
                            `▫️ **Duration:** \`${Math.floor(matchDetails.metadata.game_length / 60)}m\``
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '🕒 Match Details',
                        value: [
                            `▫️ **Date:** \`${new Date(matchDetails.metadata.game_start * 1000).toLocaleString('en-US', { 
                                month: 'numeric',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                            }).replace(/ ([AP]M)/, '$1')}\``,
                            `▫️ **Server:** \`${matchDetails.metadata.cluster}\``,
                            `▫️ **Avg ACS:** \`${allPlayersStats.averageACS}\``
                        ].join('\n'),
                        inline: true
                    }
                )
                .setImage('https://i.ibb.co/3dG2LxR/valorant-divider.png')
                .setFooter({ 
                    text: 'Angelic Tracker • Elite Match Analysis',
                    iconURL: 'https://i.ibb.co/0jQ3q1G/valorant-logo.png' 
                });
    
            const createTeamEmbed = (teamName, players, color, roundsWon, hasWon) => {
                return new EmbedBuilder()
                    .setColor(color)
                    .setTitle(`${teamName} Squad • ${hasWon ? 'VICTORY' : 'DEFEAT'} (${roundsWon})`)
                    .setDescription(players.map(createPlayerLine).join('\n'))
                    .setThumbnail(teamName === 'Blue' 
                        ? 'https://i.ibb.co/3dG2LxR/valorant-divider-blue.png' 
                        : 'https://i.ibb.co/3dG2LxR/valorant-divider-red.png');
            };
    
            await interaction.editReply({ 
                embeds: [
                    mainEmbed,
                    createTeamEmbed('Blue', blueTeam, '#5b6ee1', blueRounds, blueHasWon),
                    createTeamEmbed('Red', redTeam, '#bf3b3b', redRounds, redHasWon)
                ] 
            });
    
        } catch (error) {
            console.error('Error processing match result:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🚨 Match Analysis Failed')
                        .setDescription('Failed to process match data\nPlease try again later')
                        .setThumbnail('https://i.ibb.co/0jQ3q1G/valorant-logo.png')
                ]
            });
        }
    }
}    