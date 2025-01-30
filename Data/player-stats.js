const mongoose = require('mongoose');

const playerStatsSchema = new mongoose.Schema({
    puuid: { type: String, required: true },
    name: { type: String, required: true },
    tag: { type: String, required: true },
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    totalHeadshots: { type: Number, default: 0 },
    totalBodyshots: { type: Number, default: 0 },
    totalLegshots: { type: Number, default: 0 },
    matchMVPs: { type: Number, default: 0 },
    teamMVPs: { type: Number, default: 0 },
    processedMatches: [{ type: String }],
    lastUpdated: { type: Date, default: Date.now },
    matchData: [{
        matchId: { type: String, required: true },
        kills: { type: Number, required: true },
        deaths: { type: Number, required: true },
        assists: { type: Number, required: true },
        won: { type: Boolean, required: true },
        headshots: { type: Number, required: true },
        bodyshots: { type: Number, required: true },
        legshots: { type: Number, required: true },
        isMatchMVP: { type: Boolean, required: true },
        isTeamMVP: { type: Boolean, required: true },
        agent: { type: String, required: true },
        acs: { type: Number, required: true },
        date: { type: Date, default: Date.now }
    }]
});

playerStatsSchema.virtual('headshotPercentage').get(function() {
    const total = this.totalHeadshots + this.totalBodyshots + this.totalLegshots;
    return total > 0 ? Number(((this.totalHeadshots / total) * 100).toFixed(2)) : 0;
});

playerStatsSchema.set('toObject', { virtuals: true });
playerStatsSchema.set('toJSON', { virtuals: true });

playerStatsSchema.index({ name: 1, tag: 1 }, { unique: true });

const PlayerStats = mongoose.model('PlayerStats', playerStatsSchema);

async function updatePlayerStats(name, tag, stats) {
    try {
        let player = await PlayerStats.findOne({ name, tag });

        if (!player) {
            player = await PlayerStats.findOne({ puuid: stats.puuid });

            if (player) {
                console.log(`Potential duplicate found for ${name}#${tag}. Please use /merge-player-records to merge with ${player.name}#${player.tag}`);
            }
        }

        if (player) {
            if (player.name !== name || player.tag !== tag) {
                player.name = name;
                player.tag = tag;
            }

            player.kills += stats.kills;
            player.deaths += stats.deaths;
            player.assists += stats.assists;
            player.totalHeadshots += stats.headshots;
            player.totalBodyshots += stats.bodyshots;
            player.totalLegshots += stats.legshots;

            stats.won ? player.wins++ : player.losses++;

            if (stats.isMatchMVP) player.matchMVPs++;
            if (stats.isTeamMVP) player.teamMVPs++;

            if (player.processedMatches.includes(stats.matchId)) return;
            player.matchData.push({
                matchId: stats.matchId,
                kills: stats.kills,
                deaths: stats.deaths,
                assists: stats.assists,
                won: stats.won,
                headshots: stats.headshots,
                bodyshots: stats.bodyshots,
                legshots: stats.legshots,
                isMatchMVP: stats.isMatchMVP,
                isTeamMVP: stats.isTeamMVP,
                agent: stats.agent,
                acs: stats.acs
            });

            player.lastUpdated = new Date();
            await player.save();
        } else {
            await new PlayerStats({
                puuid: stats.puuid,
                name,
                tag,
                kills: stats.kills,
                deaths: stats.deaths,
                assists: stats.assists,
                wins: stats.won ? 1 : 0,
                losses: stats.won ? 0 : 1,
                totalHeadshots: stats.headshots,
                totalBodyshots: stats.bodyshots,
                totalLegshots: stats.legshots,
                matchMVPs: stats.isMatchMVP ? 1 : 0,
                teamMVPs: stats.isTeamMVP ? 1 : 0,
                processedMatches: [stats.matchId],
                matchData: [{
                    matchId: stats.matchId,
                    kills: stats.kills,
                    deaths: stats.deaths,
                    assists: stats.assists,
                    won: stats.won,
                    headshots: stats.headshots,
                    bodyshots: stats.bodyshots,
                    legshots: stats.legshots,
                    isMatchMVP: stats.isMatchMVP,
                    isTeamMVP: stats.isTeamMVP,
                    agent: stats.agent,
                    acs: stats.acs
                }]
            }).save();
        }
    } catch (error) {
        console.error(`Error updating ${name}#${tag}:`, error);
        throw error;
    }
}

async function removeMatchStats(matchId) {
    try {
        const players = await PlayerStats.find({ 'processedMatches': matchId });
        
        for (const player of players) {
            const matchIndex = player.matchData.findIndex(m => m.matchId === matchId);
            if (matchIndex === -1) continue;

            const match = player.matchData[matchIndex];
            
            player.kills -= match.kills;
            player.deaths -= match.deaths;
            player.assists -= match.assists;
            player.totalHeadshots -= match.headshots;
            player.totalBodyshots -= match.bodyshots;
            player.totalLegshots -= match.legshots;

            match.won ? player.wins-- : player.losses--;

            if (match.isMatchMVP) player.matchMVPs--;
            if (match.isTeamMVP) player.teamMVPs--;

            // Remove match records
            player.processedMatches = player.processedMatches.filter(id => id !== matchId);
            player.matchData.splice(matchIndex, 1);

            await player.save();
        }
    } catch (error) {
        console.error(`Error removing match ${matchId}:`, error);
        throw error;
    }
}

module.exports = {
    PlayerStats,
    getPlayerStats: async (name, tag) => {
        return PlayerStats.findOne({ name, tag });
    },
    updatePlayerStats,
    removeMatchStats
};