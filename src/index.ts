import { SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the current file's directory (ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config();

// Create the Sapphire client
const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  loadMessageCommandListeners: true,
  baseUserDirectory: __dirname
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

// Ready event
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
  console.log(`📊 Ready in ${client.guilds.cache.size} guild(s)`);
  console.log(`🔧 Loaded ${client.stores.get('commands').size} command(s)`);
  console.log(`📁 Base directory: ${__dirname}`);

  // List loaded commands
  const commands = client.stores.get('commands');
  if (commands.size > 0) {
    console.log('Commands:', Array.from(commands.keys()).join(', '));
  } else {
    console.log('⚠️  No commands loaded. Check that files exist in:', join(__dirname, 'commands'));
  }
});

// Command registration logging
client.on('applicationCommandRegistryError', (error, command) => {
  console.error(`❌ Error registering command ${(command as any).name}:`, error);
});

// Error handling
client.on('error', (error: Error) => {
  console.error('Client error:', error);
});

process.on('unhandledRejection', (error: Error) => {
  console.error('Unhandled promise rejection:', error);
});
