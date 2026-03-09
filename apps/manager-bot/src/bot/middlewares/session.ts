import type { Middleware } from 'grammy'
import type { Context, SessionData } from '../context.js'
import { session as createSession, MemorySessionStorage } from 'grammy'

export function session(): Middleware<Context> {
  return createSession<SessionData, Context>({
    getSessionKey: ctx => ctx.chat?.id?.toString(),
    storage: new MemorySessionStorage<SessionData>(),
    initial: () => ({}) as SessionData,
  })
}
