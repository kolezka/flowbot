import process from 'node:process'
import * as v from 'valibot'

const configSchema = v.pipe(
  v.object({
    tgClientApiId: v.pipe(v.string(), v.transform(Number), v.number()),
    tgClientApiHash: v.pipe(v.string(), v.minLength(1)),
    tgClientSession: v.optional(v.string()),
    databaseUrl: v.string(),
    logLevel: v.optional(v.pipe(v.string(), v.picklist(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])), 'info'),
    debug: v.optional(v.pipe(v.string(), v.transform(JSON.parse), v.boolean()), 'false'),
    schedulerPollIntervalMs: v.optional(v.pipe(v.string(), v.transform(Number), v.number()), '5000'),
    schedulerMaxRetries: v.optional(v.pipe(v.string(), v.transform(Number), v.number()), '3'),
    backoffBaseMs: v.optional(v.pipe(v.string(), v.transform(Number), v.number()), '1000'),
    backoffMaxMs: v.optional(v.pipe(v.string(), v.transform(Number), v.number()), '60000'),
    healthServerPort: v.optional(v.pipe(v.string(), v.transform(Number), v.number()), '3002'),
    healthServerHost: v.optional(v.string(), '0.0.0.0'),
  }),
  v.transform(input => ({
    ...input,
    isDebug: input.debug,
  })),
)

export type Config = v.InferOutput<typeof configSchema>

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
    const config = createConfig(env as any)

    return config
  }
  catch (error) {
    throw new Error('Invalid config', {
      cause: error,
    })
  }
}
