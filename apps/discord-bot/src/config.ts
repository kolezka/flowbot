import process from 'node:process'

export interface Config {
  discordBotToken: string
  discordClientId: string
  databaseUrl: string
  apiUrl: string
  port: number
}

export function createConfigFromEnvironment(): Config {
  try {
    process.loadEnvFile()
  }
  catch {
    // No .env file found
  }

  const discordBotToken = process.env.DISCORD_BOT_TOKEN
  if (!discordBotToken) {
    throw new Error('DISCORD_BOT_TOKEN is required')
  }

  const discordClientId = process.env.DISCORD_CLIENT_ID
  if (!discordClientId) {
    throw new Error('DISCORD_CLIENT_ID is required')
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  return {
    discordBotToken,
    discordClientId,
    databaseUrl,
    apiUrl: process.env.API_URL ?? 'http://localhost:3000',
    port: process.env.PORT ? Number(process.env.PORT) : 3003,
  }
}
