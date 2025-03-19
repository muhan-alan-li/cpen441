// Require the necessary discord.js classes
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Config process.env
config();

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord with your client's token
client.login(process.env.TOKEN);
