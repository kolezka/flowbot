import type { Context } from '../context'
import { isAdmin } from '../filters/is-admin'
import { setCommandsHandler } from '../handlers/commands/setcommands'
import { logHandle } from '../helpers/logging'
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
