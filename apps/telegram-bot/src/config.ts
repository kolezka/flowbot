import process from 'node:process'
import * as v from 'valibot'

const configSchema = v.object({
  logLevel: v.optional(v.picklist(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']), 'info'),
  botToken: v.pipe(v.string(), v.regex(/^\d+:[\w-]+$/, 'Invalid BOT_TOKEN format')),
  botMode: v.optional(v.picklist(['polling', 'webhook']), 'polling'),
  botAdmins: v.optional(v.pipe(v.string(), v.transform(JSON.parse), v.array(v.number())), '[]'),
  botInstanceId: v.optional(v.string()),
  apiUrl: v.optional(v.string()),
  apiServerHost: v.optional(v.string(), 'localhost'),
  apiServerPort: v.optional(v.pipe(v.string(), v.transform(Number), v.number()), '3000'),
  serverHost: v.optional(v.string(), '0.0.0.0'),
  serverPort: v.optional(v.pipe(v.string(), v.transform(Number), v.number()), '3001'),
})

export type Config = v.InferOutput<typeof configSchema>

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

export function createConfigFromEnvironment(): Config {
  try {
    process.loadEnvFile()
  }
  catch {
    // No .env file found
  }

  try {
    const env = convertKeysToCamelCase(process.env) as Record<string, string>
    return v.parse(configSchema, env)
  }
  catch (error) {
    throw new Error('Invalid config', { cause: error })
  }
}
