import process from "node:process";
import * as v from "valibot";

const configSchema = v.object({
  databaseUrl: v.string(),
  apiUrl: v.optional(v.string(), "http://localhost:3000"),
  poolHost: v.optional(v.string(), "0.0.0.0"),
  poolPort: v.optional(
    v.pipe(v.string(), v.transform(Number), v.number()),
    "3010",
  ),
  logLevel: v.optional(
    v.pipe(
      v.string(),
      v.picklist([
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
        "silent",
      ]),
    ),
    "info",
  ),

  // Telegram user-specific (shared across all TG user workers)
  tgApiId: v.optional(v.pipe(v.string(), v.transform(Number), v.number()), "0"),
  tgApiHash: v.optional(v.string(), ""),

  // Pool tuning
  maxWorkers: v.optional(
    v.pipe(v.string(), v.transform(Number), v.number()),
    "100",
  ),
  batchSize: v.optional(
    v.pipe(v.string(), v.transform(Number), v.number()),
    "20",
  ),
  batchDelayMs: v.optional(
    v.pipe(v.string(), v.transform(Number), v.number()),
    "1000",
  ),
  reconcileIntervalMs: v.optional(
    v.pipe(v.string(), v.transform(Number), v.number()),
    "30000",
  ),

  // Per-pool enable/disable flags
  enableTelegramBot: v.optional(v.string(), "true"),
  enableTelegramUser: v.optional(v.string(), "true"),
  enableWhatsappUser: v.optional(v.string(), "true"),
  enableDiscordBot: v.optional(v.string(), "true"),
});

export type Config = v.InferOutput<typeof configSchema>;

function createConfig(input: v.InferInput<typeof configSchema>) {
  return v.parse(configSchema, input);
}

export function isPoolEnabled(
  config: Config,
  pool: "telegramBot" | "telegramUser" | "whatsappUser" | "discordBot",
): boolean {
  const key = {
    telegramBot: config.enableTelegramBot,
    telegramUser: config.enableTelegramUser,
    whatsappUser: config.enableWhatsappUser,
    discordBot: config.enableDiscordBot,
  }[pool];
  return key === "true";
}

function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/_([a-z])/g, (_match, p1) => (p1 as string).toUpperCase());
}

function convertKeysToCamelCase(obj: Record<string, string | undefined>): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[toCamelCase(key)] = obj[key];
    }
  }
  return result;
}

export function createConfigFromEnvironment(): Config {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file found
  }

  try {
    const env = convertKeysToCamelCase(process.env as Record<string, string | undefined>);
    return createConfig(env as v.InferInput<typeof configSchema>);
  } catch (error) {
    throw new Error("Invalid config", { cause: error });
  }
}
