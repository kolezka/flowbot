/**
 * Interactive mtcute authentication script.
 *
 * Authenticates a Telegram user account via MTProto and prints the session
 * string to stdout. The session string can then be set as TG_CLIENT_SESSION.
 *
 * Usage:
 *   npx tsx packages/telegram-user-connector/src/scripts/authenticate.ts
 *
 * Environment variables:
 *   TG_CLIENT_API_ID   - Telegram API ID (from https://my.telegram.org)
 *   TG_CLIENT_API_HASH - Telegram API hash
 */

import { TelegramClient } from '@mtcute/node'
import { tl } from '@mtcute/node'
import { SentCode } from '@mtcute/node'
import * as readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

async function main(): Promise<void> {
  const apiId = Number(process.env.TG_CLIENT_API_ID)
  const apiHash = process.env.TG_CLIENT_API_HASH

  if (!apiId || !apiHash) {
    console.error('Error: TG_CLIENT_API_ID and TG_CLIENT_API_HASH must be set')
    process.exit(1)
  }

  const rl = readline.createInterface({ input: stdin, output: stdout })

  const client = new TelegramClient({
    apiId,
    apiHash,
    storage: 'mtcute-auth.session',
  })

  try {
    const phone = await rl.question('Phone number (international format, e.g. +1234567890): ')

    const sentCodeResult = await client.sendCode({ phone })

    // sendCode can return a User (already authorized) or SentCode
    if (!(sentCodeResult instanceof SentCode)) {
      console.log('Already authorized!')
      const session = await client.exportSession()
      console.log('\n--- Session string (set as TG_CLIENT_SESSION) ---')
      console.log(session)
      console.log('--- End of session string ---\n')
      await client.disconnect()
      return
    }

    const code = await rl.question('Enter the code you received: ')

    try {
      await client.signIn({
        phone,
        phoneCodeHash: sentCodeResult.phoneCodeHash,
        phoneCode: code,
      })
    } catch (error: unknown) {
      if (tl.RpcError.is(error, 'SESSION_PASSWORD_NEEDED')) {
        const password = await rl.question('2FA password: ')
        await client.checkPassword(password)
      } else {
        throw error
      }
    }

    const session = await client.exportSession()
    console.log('\n--- Session string (set as TG_CLIENT_SESSION) ---')
    console.log(session)
    console.log('--- End of session string ---\n')

    await client.disconnect()
  } catch (error) {
    console.error('Authentication failed:', error)
    await client.disconnect()
    process.exit(1)
  } finally {
    rl.close()
  }
}

main()
