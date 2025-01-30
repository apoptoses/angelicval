const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { Guilds, GuildMembers, GuildMessages, MessageContent, GuildPresences, GuildMessageReactions } = GatewayIntentBits;
const { User, Message, GuildMember, ThreadMember } = Partials;

const client = new Client({
    intents: [Guilds, GuildMembers, GuildMessages, MessageContent, GuildPresences, GuildMessageReactions],
    partials: [User, Message, GuildMember, ThreadMember],
    allowedMentions: {parse:["everyone", "users", "roles"]}
});

client.commands = new Collection();
client.events = new Collection();

const { loadEvents } = require('./Handlers/eventHandler');
loadEvents(client);

const fs = require('fs');
const yaml = require('js-yaml');
const config = yaml.load(fs.readFileSync('./Config/config.yml', 'utf-8'));

const mongoose = require('mongoose');
mongoose.connect(config.MongoDB, { useNewUrlParser: true, useUnifiedTopology: true }).then(console.log('Connected to the database!'));

client.login(config.Token)