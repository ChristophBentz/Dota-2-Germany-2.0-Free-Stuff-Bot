const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const axios = require('axios');
const schedule = require('node-schedule');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID; // Channel ID, in which the bot will post free games

let lastPostedGames = {
    epic: [],
    steam: []
};

client.once('ready', () => {
    console.log('Bot is online!');
    
    // Set the bot's status and activity
    client.user.setActivity('Free Games', { type: ActivityType.Watching });
    
    schedule.scheduleJob('0 * * * *', async () => { // Runs every hour
        await checkAndPostFreeGames();
    });
});

client.on('messageCreate', async message => {
    if (message.content === '!freegames') {
        const freeGamesEmbeds = await getFreeGamesEmbeds();
        if (freeGamesEmbeds.length > 0) {
            message.channel.send({ content: '@everyone', embeds: freeGamesEmbeds });
        } else {
            const embed = new EmbedBuilder()
                .setTitle('No Free Games Available')
                .setColor(0xFF0000)
                .setTimestamp();
            message.channel.send({ content: '@everyone', embeds: [embed] });
        }
    }
});

async function checkAndPostFreeGames() {
    const channel = await client.channels.fetch(CHANNEL_ID);
    const freeGamesEmbeds = await getFreeGamesEmbeds();
    const newEpicGames = [];
    const newSteamGames = [];

    freeGamesEmbeds.forEach(embed => {
        // Überprüfung auf bereits gepostete Spiele
        if (embed.description === 'Epic Games Store' && !lastPostedGames.epic.includes(embed.title)) {
            newEpicGames.push(embed);
        } else if (embed.description === 'Steam' && !lastPostedGames.steam.includes(embed.title)) {
            newSteamGames.push(embed);
        }
    });

    // Senden neuer Epic Games Embeds
    if (newEpicGames.length > 0) {
        newEpicGames.forEach(embed => {
            channel.send({ content: '@everyone', embeds: [embed] });
            lastPostedGames.epic.push(embed.title);
        });
    }

    // Senden neuer Steam Games Embeds
    if (newSteamGames.length > 0) {
        newSteamGames.forEach(embed => {
            channel.send({ content: '@everyone', embeds: [embed] });
            lastPostedGames.steam.push(embed.title);
        });
    }

    // Begrenzen der Liste auf die letzten 10 Einträge
    lastPostedGames.epic = lastPostedGames.epic.slice(-10);
    lastPostedGames.steam = lastPostedGames.steam.slice(-10);
}

async function getFreeGamesEmbeds() {
    try {
        const epicGames = await getEpicGames();
        const steamGames = await getSteamGames();

        const embeds = [];

        if (epicGames.length > 0) {
            // Nur das erste Spiel der Liste wird umgewandelt und hinzugefügt
            const game = epicGames[0];
            if (!lastPostedGames.epic.includes(game.title)) {
                const embed = new EmbedBuilder()
                    .setTitle(game.title)
                    //.setURL(game.link)
                    .setColor(0x00AE86)
                    .setDescription('Epic Games Store')
                    .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Epic_Games_logo.svg/200px-Epic_Games_logo.svg.png')
                    .setImage(game.image)
                    .setAuthor({ name: 'Jumpy.gg', iconURL: 'https://i.imgur.com/u40Xvea.png', url: 'https://steamcommunity.com/profiles/76561199559658112' })
                    .setFooter({ text: 'Bot is created by Jumpy.gg', iconURL: 'https://i.imgur.com/u40Xvea.png' })
                    .setTimestamp();
                embeds.push(embed);
            }
        }

        if (steamGames.length > 0) {
            // Nur das erste Spiel der Liste wird umgewandelt und hinzugefügt
            const game = steamGames[0];
            if (!lastPostedGames.steam.includes(game.title)) {
                const embed = new EmbedBuilder()
                    .setTitle(game.title)
                    .setURL(game.link)
                    .setColor(0x00AE86)
                    .setDescription('Steam')
                    .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/240px-Steam_icon_logo.svg.png')
                    .setImage(game.image)
                    .setAuthor({ name: 'Jumpy.gg', iconURL: 'https://i.imgur.com/u40Xvea.png', url: 'https://steamcommunity.com/profiles/76561199559658112' })
                    .setFooter({ text: 'Bot is created by Jumpy.gg', iconURL: 'https://i.imgur.com/u40Xvea.png' })
                    .setTimestamp();
                embeds.push(embed);
            }
        }

        return embeds;
    } catch (error) {
        console.error(error);
        const embed = new EmbedBuilder()
            .setTitle('Error')
            .setColor(0xFF0000)
            .setDescription('Sorry, I could not fetch the free games at the moment.')
            .setTimestamp();
        return [embed];
    }
}

async function getEpicGames() {
    try {
        const response = await axios.get('https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions');
        const games = response.data.data.Catalog.searchStore.elements;
        const currentDate = new Date();

        const freeGames = games.filter(game => {
            if (game.promotions && game.promotions.promotionalOffers.length > 0) {
                const offer = game.promotions.promotionalOffers[0].promotionalOffers[0];
                const startDate = new Date(offer.startDate);
                const endDate = new Date(offer.endDate);
                return startDate <= currentDate && endDate >= currentDate;
            }
            return false;
        });

        return freeGames
            .filter(game => game.keyImages.some(image => image.type === 'OfferImageWide'))
            .map(game => ({
                title: game.title,
                image: game.keyImages.find(image => image.type === 'OfferImageWide').url,
                link: `https://store.epicgames.com/de/p/${game.productSlug}`
            }));
    } catch (error) {
        console.error('Error fetching Epic Games:', error);
        return [];
    }
}

async function getSteamGames() {
    try {
        const response = await axios.get('https://store.steampowered.com/api/featuredcategories');
        const specials = response.data.specials.items;

        const freeGames = specials.filter(game => game.discounted && game.final_price === 0);

        return freeGames.map(game => ({
            title: game.name,
            image: `https://steamcdn-a.akamaihd.net/steam/apps/${game.id}/header.jpg`,
            link: `https://store.steampowered.com/app/${game.id}`
        }));
    } catch (error) {
        console.error('Error fetching Steam Games:', error);
        return [];
    }
}

client.login(TOKEN);
