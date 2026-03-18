import type { Config } from './config.js'
import { createPrismaClient } from '@flowbot/db'

export function createDatabase(config: Config) {
  return createPrismaClient(config.databaseUrl)
}
