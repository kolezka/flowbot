import process from 'node:process'
import { API_CONSTANTS } from 'grammy'
import * as v from 'valibot'

const DEFAULT_ALLOWED_UPDATES = JSON.stringify([
  'message',
  'callback_query',
  'chat_member',
  'my_chat_member',
  'edited_message',
  'chat_join_request',
])

const baseConfigSchema = v.object({
  debug: v.optional(v.pipe(v.string(), v.transform(JSON.parse), v.boolean()), 'false'),
  logLevel: v.optional(v.pipe(v.string(), v.picklist(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])), 'info'),
  botToken: v.pipe(v.string(), v.regex(/^\d+:[\w-]+$/, 'Invalid BOT_TOKEN format')),
  botAllowedUpdates: v.optional(v.pipe(v.string(), v.transform(JSON.parse), v.array(v.picklist(API_CONSTANTS.ALL_UPDATE_TYPES))), DEFAULT_ALLOWED_UPDATES),
  botAdmins: v.optional(v.pipe(v.string(), v.transform(JSON.parse), v.array(v.number())), '[]'),
  databaseUrl: v.string(),
  anthropicApiKey: v.optional(v.string()),
  aiModEnabled: v.optional(v.pipe(v.string(), v.transform(val => val === 'true'), v.boolean()), 'false'),
  triggerSecretKey: v.optional(v.string()),
  triggerApiUrl: v.optional(v.string()),
  apiUrl: v.optional(v.string(), 'http://localhost:3000'),
  apiServerHost: v.optional(v.string(), '0.0.0.0'),
  apiServerPort: v.optional(v.pipe(v.string(), v.transform(Number), v.number()), '3001'),
})

const configSchema = v.variant('botMode', [
  v.pipe(
    v.object({
      botMode: v.literal('polling'),
      ...baseConfigSchema.entries,
    }),
    v.transform(input => ({
      ...input,
      isDebug: input.debug,
      isWebhookMode: false as const,
      isPollingMode: true as const,
    })),
  ),
  v.pipe(
    v.object({
      botMode: v.literal('webhook'),
      ...baseConfigSchema.entries,
      botWebhook: v.pipe(v.string(), v.url()),
      botWebhookSecret: v.pipe(v.string(), v.minLength(12)),
      serverHost: v.optional(v.string(), '0.0.0.0'),
      serverPort: v.optional(v.pipe(v.string(), v.transform(Number), v.number()), '80'),
    }),
    v.transform(input => ({
      ...input,
      isDebug: input.debug,
      isWebhookMode: true as const,
      isPollingMode: false as const,
    })),
  ),
])

export type Config = v.InferOutput<typeof configSchema>
export type PollingConfig = v.InferOutput<typeof configSchema['options'][0]>
export type WebhookConfig = v.InferOutput<typeof configSchema['options'][1]>

export function createConfig(input: v.InferInput<typeof configSchema>) {
  return v.parse(configSchema, input)
}

type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
  : Lowercase<S>

type KeysToCamelCase<T> = {
  [K in keyof T as CamelCase<string & K>]: T[K] extends object ? KeysToCamelCase<T[K]> : T[K]
}

function toCamelCase(str: string): string {
  return str.toLowerCase().replace(/_([a-z])/g, (_match, p1) => p1.toUpperCase())
}

function convertKeysToCamelCase<T>(obj: T): KeysToCamelCase<T> {
  const result: any = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelCaseKey = toCamelCase(key)
      result[camelCaseKey] = obj[key]
    }
  }
  return result
}

export function createConfigFromEnvironment() {
  try {
    process.loadEnvFile()
  }
  catch {
    // No .env file found
  }

  try {
    const env = convertKeysToCamelCase(process.env) as Record<string, string>
    if (!env.botMode) {
      env.botMode = 'polling'
    }
    const config = createConfig(env as any)

    return config
  }
  catch (error) {
    throw new Error('Invalid config', {
      cause: error,
    })
  }
}
