const { Client, ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    enabled: true,
    once: true,
    /**
     * 
     * @param {Client} client 
     */
    async execute(client) {
        console.log('Online!');

        const { loadCommands } = require('../../Handlers/commandHandler');
        loadCommands(client);

        client.user.setPresence({ activities: [{ type: ActivityType.Watching, name: `Active Scrim Games`}]})

    }
}