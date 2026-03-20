import process from 'node:process'

export interface Config {
  discordBotToken: string
  botInstanceId: string
  apiUrl: string
  serverHost: string
  serverPort: number
  logLevel: string
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

  const botInstanceId = process.env.DISCORD_BOT_INSTANCE_ID
  if (!botInstanceId) {
    throw new Error('DISCORD_BOT_INSTANCE_ID is required')
  }

  return {
    discordBotToken,
    botInstanceId,
    apiUrl: process.env.API_URL ?? 'http://localhost:3000',
    serverHost: process.env.SERVER_HOST ?? '0.0.0.0',
    serverPort: process.env.SERVER_PORT ? Number(process.env.SERVER_PORT) : 3003,
    logLevel: process.env.LOG_LEVEL ?? 'info',
  }
}
