#!/usr/bin/env tsx
import process from 'node:process'
import * as readline from 'node:readline'
import { TelegramClient } from 'telegram'
import { loadSession } from '../client/session.js'
import { createConfigFromEnvironment } from '../config.js'

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function main() {
  const config = createConfigFromEnvironment()
  const session = loadSession()

  const client = new TelegramClient(session, config.tgClientApiId, config.tgClientApiHash, {
    connectionRetries: 5,
  })

  console.error('Starting authentication...')
  console.error('You will be prompted for your phone number, verification code, and optionally a 2FA password.')

  await client.start({
    phoneNumber: () => prompt('Enter your phone number: '),
    phoneCode: () => prompt('Enter the code you received: '),
    password: () => prompt('Enter your 2FA password (if enabled): '),
    onError: (err) => {
      console.error('Authentication error:', err.message)
    },
  })

  console.error('Authentication successful!')
  console.error('')
  console.error('Save the following session string to your TG_CLIENT_SESSION environment variable:')
  console.error('')

  // Print the session string to stdout (never to a logger)
  const sessionString = client.session.save() as unknown as string
  process.stdout.write(`${sessionString}\n`)

  await client.disconnect()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
