import { StringSession } from 'telegram/sessions/index.js'

/**
 * Load a StringSession from an optional session string.
 * If a session string is provided, it is used to restore the session.
 * If not, an empty session is created (for first-time authentication).
 *
 * The session string is never logged.
 */
export function loadSession(sessionString?: string): StringSession {
  if (sessionString) {
    return new StringSession(sessionString)
  }

  return new StringSession('')
}
