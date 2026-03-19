import process from 'node:process'
import * as v from 'valibot'

const configSchema = v.object({
  waConnectionId: v.string(),
  waBotInstanceId: v.string(),
  databaseUrl: v.string(),
  apiServerHost: v.optional(v.string(), '0.0.0.0'),
  apiServerPort: v.optional(v.pipe(v.string(), v.transform(Number), v.number()), '3004'),
  apiUrl: v.optional(v.string(), 'http://localhost:3000'),
  logLevel: v.optional(v.pipe(v.string(), v.picklist(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])), 'info'),
  debug: v.optional(v.pipe(v.string(), v.transform(JSON.parse), v.boolean()), 'false'),
})

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
  return str.toLowerCase().replace(/_([a-z])/g, (_match, p1) => (p1 as string).toUpperCase())
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
    return createConfig(env as any)
  }
  catch (error) {
    throw new Error('Invalid config', {
      cause: error,
    })
  }
}
