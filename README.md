# LFG Bot

Assistant for the FGC discord - A Discord bot built with Sapphire Framework and discord.js that creates fight threads with room codes and participants.

## Features

- `/fight` slash command to create organized fight threads
- Support for up to 5 participants
- Room code tracking
- Auto-archiving threads after 1 hour of inactivity

## Setup

1. Install dependencies:
```bash
yarn install
# or
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Add your Discord bot token to `.env`:
```env
DISCORD_TOKEN=your_bot_token_here
```

4. (Optional) Set a specific channel ID for fight threads:
```env
FIGHT_CHANNEL_ID=your_channel_id_here
```

## Development

Build the TypeScript code:
```bash
yarn build
# or
npm run build
```

Run the bot:
```bash
yarn start
# or
npm start
```

Build and run in one command:
```bash
yarn dev
# or
npm run dev
```

Watch mode (auto-rebuild on changes):
```bash
yarn watch
# or
npm run watch
```

## Usage

Once the bot is running and invited to your server:

1. Use `/fight` command
2. Enter a room code (required)
3. Select at least 1 participant (up to 5)
4. The bot will create a thread in the configured channel with all details

## Creating a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Go to the "Bot" section and create a bot
4. Copy the bot token and add it to your `.env` file
5. Enable the following Privileged Gateway Intents:
   - Message Content Intent
6. Go to OAuth2 → URL Generator
7. Select scopes: `bot`, `applications.commands`
8. Select bot permissions:
   - Send Messages
   - Create Public Threads
   - Send Messages in Threads
9. Use the generated URL to invite the bot to your server

## Project Structure

```
lfg-bot/
├── src/
│   ├── commands/
│   │   └── fight.ts       # Fight slash command
│   └── index.ts           # Bot entry point
├── .env.example           # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json          # TypeScript configuration
└── README.md
```
