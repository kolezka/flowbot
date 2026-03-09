import type { PrismaClient } from '@tg-allegro/db'
import type { Api } from 'grammy'
import type { Logger } from '../logger.js'

const POLL_INTERVAL_MS = 30_000 // 30 seconds

export class SchedulerService {
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false

  constructor(
    private prisma: PrismaClient,
    private api: Api,
    private logger: Logger,
  ) {}

  start() {
    if (this.timer)
      return
    this.logger.info('Scheduler started')
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS)
    // Run immediately on start
    this.poll()
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      this.logger.info('Scheduler stopped')
    }
  }

  private async poll() {
    if (this.running)
      return
    this.running = true

    try {
      const now = new Date()
      const pending = await this.prisma.scheduledMessage.findMany({
        where: {
          sent: false,
          sendAt: { lte: now },
        },
        orderBy: { sendAt: 'asc' },
        take: 10,
      })

      for (const msg of pending) {
        try {
          await this.api.sendMessage(Number(msg.chatId), msg.text, { parse_mode: 'HTML' })
          await this.prisma.scheduledMessage.update({
            where: { id: msg.id },
            data: { sent: true, sentAt: new Date() },
          })
          this.logger.info({ messageId: msg.id, chatId: msg.chatId.toString() }, 'Scheduled message sent')
        }
        catch (error) {
          this.logger.error({ messageId: msg.id, error }, 'Failed to send scheduled message')
        }
      }
    }
    catch (error) {
      this.logger.error({ error }, 'Scheduler poll error')
    }
    finally {
      this.running = false
    }
  }
}
