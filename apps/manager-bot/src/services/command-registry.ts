import type { Api } from 'grammy'
import type { Logger } from '../logger.js'
import type { CommandConfig } from './config-sync.js'

/**
 * Registers enabled commands from DB config with the Telegram Bot API.
 * Falls back silently if no commands are configured (code defaults remain).
 */
export async function registerCommandsFromConfig(
  api: Api,
  commands: CommandConfig[],
  logger: Logger,
): Promise<void> {
  const enabledCommands = commands
    .filter(c => c.isEnabled && c.description)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(c => ({ command: c.command, description: c.description! }))

  if (enabledCommands.length === 0) {
    logger.debug('No enabled commands from DB config, keeping code defaults')
    return
  }

  try {
    await api.setMyCommands(enabledCommands)
    logger.info(
      { count: enabledCommands.length, commands: enabledCommands.map(c => c.command) },
      'Registered commands from config with Telegram API',
    )
  }
  catch (error) {
    logger.warn({ err: error }, 'Failed to register commands with Telegram API')
  }
}
