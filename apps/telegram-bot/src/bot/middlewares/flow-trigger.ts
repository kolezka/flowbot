import type { Logger } from 'pino'

export interface TriggerEntry {
  flowId: string
  nodeType: string
  config: Record<string, unknown>
  platform: string
}

interface TriggerRegistryState {
  triggers: TriggerEntry[]
  version: number
  lastFetch: number
}

const POLL_INTERVAL_MS = 30_000

export function matchTriggers(
  registry: TriggerEntry[],
  eventType: string,
  eventData: Record<string, unknown>,
): TriggerEntry[] {
  const matches: TriggerEntry[] = []

  for (const entry of registry) {
    if (entry.platform !== 'telegram') continue

    // Direct event type match
    if (entry.nodeType === eventType) {
      if (matchesConfig(entry, eventData)) {
        matches.push(entry)
      }
      continue
    }

    // keyword_match triggers fire on message events
    if (entry.nodeType === 'keyword_match' && eventType === 'message_received') {
      if (matchesKeywords(entry.config, eventData)) {
        matches.push(entry)
      }
    }

    // callback_data_match triggers fire on callback_query events
    if (entry.nodeType === 'callback_data_match' && eventType === 'callback_query') {
      if (matchesCallbackData(entry.config, eventData)) {
        matches.push(entry)
      }
    }
  }

  return matches
}

function matchesConfig(entry: TriggerEntry, eventData: Record<string, unknown>): boolean {
  switch (entry.nodeType) {
    case 'command_received': {
      const cmd = entry.config.command as string | undefined
      return !cmd || eventData.command === cmd
    }
    case 'message_received':
    case 'user_joins':
    case 'user_leaves':
    case 'callback_query':
      return true
    default:
      return false
  }
}

function matchesKeywords(
  config: Record<string, unknown>,
  eventData: Record<string, unknown>,
): boolean {
  const keywords = config.keywords as string[] | undefined
  if (!keywords?.length) return false
  const text = String(eventData.text ?? '').toLowerCase()
  const mode = (config.mode as string) ?? 'any'
  if (mode === 'all') return keywords.every((k) => text.includes(k.toLowerCase()))
  return keywords.some((k) => text.includes(k.toLowerCase()))
}

function matchesCallbackData(
  config: Record<string, unknown>,
  eventData: Record<string, unknown>,
): boolean {
  const pattern = config.pattern as string | undefined
  if (!pattern) return true
  const data = String(eventData.callbackData ?? '')
  const mode = (config.matchMode as string) ?? 'exact'
  switch (mode) {
    case 'exact': return data === pattern
    case 'starts_with': return data.startsWith(pattern)
    case 'contains': return data.includes(pattern)
    default: return false
  }
}

export function createTriggerRegistry(apiUrl: string, logger: Logger) {
  const state: TriggerRegistryState = { triggers: [], version: 0, lastFetch: 0 }

  async function fetchRegistry(): Promise<void> {
    try {
      const res = await fetch(`${apiUrl}/api/flows/trigger-registry`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { triggers: TriggerEntry[]; version: number }
      state.triggers = data.triggers
      state.version = data.version
      state.lastFetch = Date.now()
      logger.info({ version: state.version, count: state.triggers.length }, 'Trigger registry loaded')
    } catch (err) {
      logger.warn({ err }, 'Failed to fetch trigger registry, using cached')
    }
  }

  async function checkVersion(): Promise<void> {
    try {
      const res = await fetch(`${apiUrl}/api/flows/trigger-registry/version`)
      if (!res.ok) return
      const data = (await res.json()) as { version: number }
      if (data.version !== state.version) {
        await fetchRegistry()
      }
    } catch {
      // Ignore — use cached registry
    }
  }

  const interval = setInterval(checkVersion, POLL_INTERVAL_MS)

  return {
    fetchRegistry,
    getState: () => state,
    stop: () => clearInterval(interval),
  }
}
