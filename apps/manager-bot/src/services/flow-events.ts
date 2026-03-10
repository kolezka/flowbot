import type { PrismaClient } from '@tg-allegro/db'
import type { Logger } from '../logger.js'
import { tasks } from '@trigger.dev/sdk/v3'

interface FlowTriggerMatch {
  flowId: string
  triggerType: string
}

export class FlowEventForwarder {
  constructor(
    private prisma: PrismaClient,
    private logger: Logger,
  ) {}

  /**
   * Forward a message event to flows with `message_received` triggers.
   */
  async onMessage(chatId: bigint, userId: bigint, text: string, messageId: number): Promise<void> {
    const triggerData = {
      type: 'message_received',
      chatId: chatId.toString(),
      userId: userId.toString(),
      text,
      messageId,
      timestamp: new Date().toISOString(),
    }

    await this.forwardToMatchingFlows('message_received', triggerData, chatId)
  }

  /**
   * Forward a user join event to flows with `user_joins` triggers.
   */
  async onUserJoin(chatId: bigint, userId: bigint, username?: string): Promise<void> {
    const triggerData = {
      type: 'user_joins',
      chatId: chatId.toString(),
      userId: userId.toString(),
      userName: username ?? '',
      timestamp: new Date().toISOString(),
    }

    await this.forwardToMatchingFlows('user_joins', triggerData, chatId)
  }

  /**
   * Find active flows whose trigger nodes match the given trigger type,
   * then trigger the flow-execution task for each.
   */
  private async forwardToMatchingFlows(
    triggerType: string,
    triggerData: Record<string, unknown>,
    _chatId?: bigint,
  ): Promise<void> {
    try {
      const matchingFlows = await this.findMatchingFlows(triggerType)

      if (matchingFlows.length === 0) {
        return
      }

      this.logger.debug(
        { triggerType, flowCount: matchingFlows.length },
        'Forwarding event to matching flows',
      )

      for (const match of matchingFlows) {
        try {
          await tasks.trigger('flow-execution', {
            flowId: match.flowId,
            triggerData,
          })

          this.logger.info(
            { flowId: match.flowId, triggerType },
            'Flow execution triggered',
          )
        }
        catch (error) {
          this.logger.error(
            { flowId: match.flowId, triggerType, error },
            'Failed to trigger flow execution',
          )
        }
      }
    }
    catch (error) {
      this.logger.error(
        { triggerType, error },
        'Failed to forward event to flows',
      )
    }
  }

  /**
   * Query the database for active FlowDefinitions that have a trigger node
   * matching the given trigger type.
   */
  async findMatchingFlows(triggerType: string): Promise<FlowTriggerMatch[]> {
    const activeFlows = await this.prisma.flowDefinition.findMany({
      where: { status: 'active' },
      select: { id: true, nodesJson: true },
    })

    const matches: FlowTriggerMatch[] = []

    for (const flow of activeFlows) {
      const nodes = flow.nodesJson as unknown as Array<{
        id: string
        type: string
        category: string
      }>

      if (!Array.isArray(nodes)) continue

      const hasTrigger = nodes.some(
        node => node.category === 'trigger' && node.type === triggerType,
      )

      if (hasTrigger) {
        matches.push({ flowId: flow.id, triggerType })
      }
    }

    return matches
  }
}
