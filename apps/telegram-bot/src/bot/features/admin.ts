import type { Context } from '../context.js'
import { isAdmin } from '../filters/is-admin.js'
import { setCommandsHandler } from '../handlers/commands/setcommands.js'
import { logHandle } from '../helpers/logging.js'
import { chatAction } from '@grammyjs/auto-chat-action'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

const feature = composer
  .chatType('private')
  .filter(isAdmin)

feature.command(
  'setcommands',
  logHandle('command-setcommands'),
  chatAction('typing'),
  setCommandsHandler,
)

export { composer as adminFeature }
