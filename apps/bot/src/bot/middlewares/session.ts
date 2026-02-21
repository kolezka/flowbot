import type { Context, SessionData } from '../context'
import type { Middleware, SessionOptions } from 'grammy'
import { session as createSession } from 'grammy'

type Options = Pick<SessionOptions<SessionData, Context>, 'getSessionKey' | 'storage'>

export function session(options: Options): Middleware<Context> {
  return createSession<SessionData, Context>({
    getSessionKey: options.getSessionKey,
    storage: options.storage,
    initial: () => ({} as SessionData),
  })
}
