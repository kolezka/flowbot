import type { PrismaClient } from '@tg-allegro/db'
import type { Logger } from '../logger.js'

interface CommandConfig {
  command: string
  description: string | null
  isEnabled: boolean
  sortOrder: number
}

interface SyncedConfig {
  configVersion: number
  commands: CommandConfig[]
}

const POLL_INTERVAL_MS = 60_000

export class ConfigSyncService {
  private config: SyncedConfig | null = null
  private botInstanceId: string | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly prisma: PrismaClient,
    private readonly botToken: string,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    await this.sync()

    this.pollTimer = setInterval(async () => {
      try {
        await this.checkForUpdates()
      }
      catch (error) {
        this.logger.warn({ err: error }, 'ConfigSync poll failed, keeping cached config')
      }
    }, POLL_INTERVAL_MS)

    // Don't prevent process exit
    if (this.pollTimer.unref) {
      this.pollTimer.unref()
    }
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  isCommandEnabled(command: string): boolean {
    if (!this.config) {
      // No DB config loaded — allow all commands (code defaults)
      return true
    }

    const cmd = this.config.commands.find(c => c.command === command)
    if (!cmd) {
      // Command not in DB — allow it (code default)
      return true
    }

    return cmd.isEnabled
  }

  getCommands(): CommandConfig[] {
    return this.config?.commands ?? []
  }

  getConfigVersion(): number {
    return this.config?.configVersion ?? 0
  }

  private async sync(): Promise<void> {
    try {
      const instance = await this.prisma.botInstance.findFirst({
        where: { botToken: this.botToken, isActive: true },
        include: {
          commands: { orderBy: { sortOrder: 'asc' } },
        },
      })

      if (!instance) {
        this.logger.info('No BotInstance found in DB for this token, using code defaults')
        this.config = null
        this.botInstanceId = null
        return
      }

      this.botInstanceId = instance.id
      this.config = {
        configVersion: instance.configVersion,
        commands: instance.commands.map(c => ({
          command: c.command,
          description: c.description,
          isEnabled: c.isEnabled,
          sortOrder: c.sortOrder,
        })),
      }

      this.logger.info(
        { configVersion: instance.configVersion, commandCount: instance.commands.length },
        'ConfigSync loaded config from DB',
      )
    }
    catch (error) {
      this.logger.warn({ err: error }, 'ConfigSync failed to load from DB, falling back to code defaults')
      this.config = null
    }
  }

  private async checkForUpdates(): Promise<void> {
    if (!this.botInstanceId) {
      // Try to find the instance again (may have been created since last check)
      await this.sync()
      return
    }

    try {
      const instance = await this.prisma.botInstance.findUnique({
        where: { id: this.botInstanceId },
        select: { configVersion: true },
      })

      if (!instance) {
        this.logger.warn('BotInstance no longer found, resetting config')
        this.config = null
        this.botInstanceId = null
        return
      }

      if (instance.configVersion !== this.config?.configVersion) {
        this.logger.info(
          { oldVersion: this.config?.configVersion, newVersion: instance.configVersion },
          'Config version changed, reloading',
        )
        await this.sync()
      }
    }
    catch (error) {
      this.logger.warn({ err: error }, 'ConfigSync version check failed')
    }
  }
}

let instance: ConfigSyncService | null = null

export function initConfigSync(prisma: PrismaClient, botToken: string, logger: Logger): ConfigSyncService {
  instance = new ConfigSyncService(prisma, botToken, logger)
  return instance
}

export function getConfigSync(): ConfigSyncService | null {
  return instance
}
