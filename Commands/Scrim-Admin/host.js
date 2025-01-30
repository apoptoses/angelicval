const { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("host")
        .setDescription("Host a new scrim match for Valorant.")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option => 
            option.setName('partycode')
                .setDescription('The party code for the scrim')
                .setRequired(true)),
    enabled: true,
    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     * @param {*} client 
     */
    async execute(interaction, client) {
        const competitiveMaps = ['Abyss', 'Bind', 'Fracture', 'Haven', 'Lotus', 'Pearl', 'Split'];
        const casualMaps = ['Abyss', 'Ascent', 'Breeze', 'Icebox', 'Sunset', 'Bind', 'Fracture', 'Haven', 'Lotus', 'Pearl', 'Split'];
        const servers = ['Oregon', 'California', 'Illinois', 'Georgia', 'Texas', 'N. Virgina'];

        let mapVotes = {};
        let poolVotes = { competitive: 0, casual: 0 };
        let serverVotes = servers.reduce((acc, server) => {
            acc[server] = 0;
            return acc;
        }, {});
        let selectedPool = '';
        const userVotes = new Map();
        const mapUserVotes = new Map();
        const serverUserVotes = new Map();

        const mapPoolEmbed = new EmbedBuilder()
            .setTitle(`Map Pool Selection`)
            .setDescription(`Please elect a map pool, either "Casual" or "Competitive".\n\n- **Competitive** are the current Episode 10 Act I Maps in competitive queue.\n\n- **Casual** are all maps in unrated.`)
            .addFields(
                { name: "Competitive", value: `Votes: ${poolVotes.competitive}`, inline: true },
                { name: "Casual", value: `Votes: ${poolVotes.casual}`, inline: true },
            );

        const mapPoolMenu = new StringSelectMenuBuilder()
            .setCustomId('map_pool')
            .setPlaceholder('Select the Map Pool')
            .addOptions([
                { label: "Competitive", value: 'competitive', description: "Episode 10 Act I Competitive Maps" },
                { label: "Casual", value: 'casual', description: "All maps available to play on" },
            ]);

        const mapPoolRow = new ActionRowBuilder().addComponents(mapPoolMenu);

        await interaction.reply({ embeds: [mapPoolEmbed], components: [mapPoolRow] });

        const poolFilter = i => i.customId === 'map_pool';
        const poolCollector = interaction.channel.createMessageComponentCollector({ filter: poolFilter, componentType: ComponentType.StringSelect, time: 35000 });

        poolCollector.on('collect', async i => {
            await i.deferUpdate();

            const previousVote = userVotes.get(i.user.id);
            const newVote = i.values[0];

            if (previousVote && previousVote !== newVote) {
                poolVotes[previousVote] -= 1;
                poolVotes[newVote] += 1;
                userVotes.set(i.user.id, newVote);
            } else if (!previousVote) {
                poolVotes[newVote] += 1;
                userVotes.set(i.user.id, newVote);
            }

            const updateMapPoolEmbed = new EmbedBuilder()
                .setTitle(`Map Pool Selection`)
                .setDescription(`Please elect a map pool, either "Casual" or "Competitive".\n\n- **Competitive** are the current Episode 10 Act I Maps in competitive queue.\n\n- **Casual** are all maps in unrated.`)
                .addFields(
                    { name: "Competitive", value: `Votes: ${poolVotes.competitive}`, inline: true },
                    { name: "Casual", value: `Votes: ${poolVotes.casual}`, inline: true },
                );

            await interaction.editReply({ embeds: [updateMapPoolEmbed] });
        });

        poolCollector.on('end', async collected => {
            if (collected.size === 0) {
                return interaction.editReply({ content: 'No selection was made.', components: [], embeds: [] });
            }

            if (poolVotes.competitive > poolVotes.casual) {
                selectedPool = 'Competitive';
            } else if (poolVotes.casual > poolVotes.competitive) {
                selectedPool = 'Casual';
            } else {
                selectedPool = Math.random() < 0.5 ? 'Competitive' : 'Casual';
            }

            let selectedMaps = selectedPool === 'Competitive' ? competitiveMaps : casualMaps;
            selectedMaps = selectedMaps.sort(() => 0.5 - Math.random()).slice(0, 5);

            mapVotes = selectedMaps.reduce((acc, map) => {
                acc[map] = 0;
                return acc;
            }, {});

            const mapVoteEmbed = new EmbedBuilder()
                .setTitle(`${selectedPool} Map Voting`)
                .setDescription(`Please vote for your preferred map by selecting it below.`)
                .addFields(selectedMaps.map(map => ({
                    name: `${map}`,
                    value: `Votes: ${mapVotes[map]}`,
                    inline: true
                })));

            const mapSelectMenu = new StringSelectMenuBuilder()
                .setCustomId('map_select')
                .setPlaceholder(`Select a map from the pool: ${selectedPool}`)
                .addOptions(selectedMaps.map(map => ({
                    label: map,
                    value: map
                })));

            const mapSelectRow = new ActionRowBuilder().addComponents(mapSelectMenu);

            await interaction.editReply({ embeds: [mapVoteEmbed], components: [mapSelectRow] });

            const mapFilter = i => i.customId === 'map_select';
            const mapCollector = interaction.channel.createMessageComponentCollector({ filter: mapFilter, componentType: ComponentType.StringSelect, time: 25000 });

            mapCollector.on('collect', async i => {
                await i.deferUpdate();

                const previousMapVote = mapUserVotes.get(i.user.id);
                const newMapVote = i.values[0];

                if (previousMapVote && previousMapVote !== newMapVote) {
                    mapVotes[previousMapVote] -= 1;
                    mapVotes[newMapVote] += 1;
                    mapUserVotes.set(i.user.id, newMapVote);
                } else if (!previousMapVote) {
                    mapVotes[newMapVote] += 1;
                    mapUserVotes.set(i.user.id, newMapVote);
                }

                const updatedMapVoteEmbed = new EmbedBuilder()
                    .setTitle(`${selectedPool} Map Voting`)
                    .setDescription(`Please vote for your preferred map by selecting it below.`)
                    .addFields(Object.keys(mapVotes).map(map => ({
                        name: `${map}`,
                        value: `Votes: ${mapVotes[map]}`,
                        inline: true
                    })));

                await interaction.editReply({ embeds: [updatedMapVoteEmbed] });
            });

            mapCollector.on('end', async collected => {
                if (collected.size === 0) {
                    await interaction.editReply({ content: 'No map was selected.', components: [], embeds: [] });
                } else {
                    await interaction.editReply({ content: 'Map voting has ended.', components: [], embeds: [] });
                }

                const serverVoteEmbed = new EmbedBuilder()
                    .setTitle(`Server Voting`)
                    .setDescription(`Please vote for your preferred server by selecting it below.`)
                    .addFields(servers.map(server => ({
                        name: `${server}`,
                        value: `Votes: ${serverVotes[server]}`,
                        inline: true
                    })));

                const serverSelectMenu = new StringSelectMenuBuilder()
                    .setCustomId('server_select')
                    .setPlaceholder('Select a server')
                    .addOptions(servers.map(server => ({
                        label: server,
                        value: server
                    })));

                const serverSelectRow = new ActionRowBuilder().addComponents(serverSelectMenu);

                await interaction.editReply({ embeds: [serverVoteEmbed], components: [serverSelectRow] });

                const serverFilter = i => i.customId === 'server_select';
                const serverCollector = interaction.channel.createMessageComponentCollector({ filter: serverFilter, componentType: ComponentType.StringSelect, time: 25000 });

                serverCollector.on('collect', async i => {
                    await i.deferUpdate();

                    const previousServerVote = serverUserVotes.get(i.user.id);
                    const newServerVote = i.values[0];

                    if (previousServerVote && previousServerVote !== newServerVote) {
                        serverVotes[previousServerVote] -= 1;
                        serverVotes[newServerVote] += 1;
                        serverUserVotes.set(i.user.id, newServerVote);
                    } else if (!previousServerVote) {
                        serverVotes[newServerVote] += 1;
                        serverUserVotes.set(i.user.id, newServerVote);
                    }

                    const updatedServerVoteEmbed = new EmbedBuilder()
                        .setTitle(`Server Voting`)
                        .setDescription(`Please vote for your preferred server by selecting it below.`)
                        .addFields(Object.keys(serverVotes).map(server => ({
                            name: `${server}`,
                            value: `Votes: ${serverVotes[server]}`,
                            inline: true
                        })));

                    await interaction.editReply({ embeds: [updatedServerVoteEmbed] });
                });

                serverCollector.on('end', async collected => {
                    if (collected.size === 0) {
                        await interaction.editReply({ content: 'No server was selected.', components: [], embeds: [] });
                    } else {
                        await interaction.editReply({ content: 'Server voting has ended.', components: [], embeds: [] });
                    }

                    const winningMap = Object.keys(mapVotes).reduce((a, b) => mapVotes[a] > mapVotes[b] ? a : b);
                    const winningServer = Object.keys(serverVotes).reduce((a, b) => serverVotes[a] > serverVotes[b] ? a : b);

                    const partyCode = interaction.options.getString('partycode');

                    const finalEmbed = new EmbedBuilder()
                        .setTitle('Scrim Match Details')
                        .setDescription('Here are the final details for the scrim match. Please ensure that you are following the scrim rules and guidelines, which can be found here: <#1327862672997486632>')
                        .addFields(
                            { name: 'Map Pool', value: selectedPool, inline: true },
                            { name: 'Map', value: winningMap, inline: true },
                            { name: 'Server', value: winningServer, inline: true },
                            { name: 'Party Code', value: partyCode, inline: true }
                        );

                    await interaction.followUp({ embeds: [finalEmbed] });
                });
            });
        });
    }
};