import type { Config } from './config.js'
import { createPrismaClient } from '@tg-allegro/db'

export function createDatabase(config: Config) {
  return createPrismaClient(config.databaseUrl)
}
