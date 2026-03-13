import { Client, GatewayIntentBits } from 'discord.js'

export function createDiscordBot(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildScheduledEvents,
    ],
  })

  client.once('ready', () => {
    console.log(`[discord-bot] Client ready as ${client.user?.tag}`)
  })

  return client
}
