#!/usr/bin/env tsx

import process from 'node:process'
import { serve } from '@hono/node-server'
import { createDiscordBot } from './bot/index.js'
import { createConfigFromEnvironment } from './config.js'
import { createServer } from './server/index.js'
import { DiscordFlowEventForwarder } from './services/flow-events.js'

const config = createConfigFromEnvironment()

const client = createDiscordBot()
const flowForwarder = new DiscordFlowEventForwarder(config.apiUrl)

// Register event handlers
import { registerMessageEvents } from './bot/events/message.js'
import { registerMemberJoinEvents } from './bot/events/member-join.js'
import { registerMemberLeaveEvents } from './bot/events/member-leave.js'
import { registerReactionEvents } from './bot/events/reaction.js'
import { registerInteractionEvents } from './bot/events/interaction.js'
import { registerVoiceStateEvents } from './bot/events/voice-state.js'

registerMessageEvents(client, flowForwarder)
registerMemberJoinEvents(client, flowForwarder)
registerMemberLeaveEvents(client, flowForwarder)
registerReactionEvents(client, flowForwarder)
registerInteractionEvents(client, flowForwarder)
registerVoiceStateEvents(client, flowForwarder)

const app = createServer(client, config)

let isShuttingDown = false

async function shutdown() {
  if (isShuttingDown) return
  isShuttingDown = true

  console.log('[discord-bot] Shutting down...')
  client.destroy()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

try {
  await client.login(config.discordBotToken)
  console.log(`[discord-bot] Logged in as ${client.user?.tag}`)

  serve(
    {
      fetch: app.fetch,
      hostname: '0.0.0.0',
      port: config.port,
    },
    (info) => {
      const url = info.family === 'IPv6'
        ? `http://[${info.address}]:${info.port}`
        : `http://${info.address}:${info.port}`
      console.log(`[discord-bot] HTTP server listening on ${url}`)
    },
  )
}
catch (error) {
  console.error('[discord-bot] Failed to start:', error)
  process.exit(1)
}
