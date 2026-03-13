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
  async onMessage(
    chatId: bigint,
    userId: bigint,
    text: string,
    messageId: number,
    messageType: string = 'text',
    hasMedia: boolean = false,
  ): Promise<void> {
    const triggerData = {
      type: 'message_received',
      chatId: chatId.toString(),
      userId: userId.toString(),
      text,
      messageId,
      messageType,
      hasMedia,
      mediaType: hasMedia ? messageType : undefined,
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
   * Forward a user leave/kick event to flows with `user_leaves` triggers.
   */
  async onUserLeave(chatId: bigint, userId: bigint, username?: string, wasKicked: boolean = false): Promise<void> {
    const triggerData = {
      type: 'user_leaves',
      chatId: chatId.toString(),
      userId: userId.toString(),
      userName: username ?? '',
      wasKicked,
      timestamp: new Date().toISOString(),
    }

    await this.forwardToMatchingFlows('user_leaves', triggerData, chatId)
  }

  /**
   * Forward a callback query (inline button press) to flows with `callback_query` triggers.
   */
  async onCallbackQuery(
    userId: bigint,
    callbackQueryId: string,
    data: string,
    chatId?: bigint,
    messageId?: number,
  ): Promise<void> {
    const triggerData = {
      type: 'callback_query',
      userId: userId.toString(),
      callbackQueryId,
      callbackData: data,
      chatId: chatId?.toString() ?? '',
      messageId,
      timestamp: new Date().toISOString(),
    }

    await this.forwardToMatchingFlows('callback_query', triggerData, chatId)
  }

  /**
   * Forward a bot command to flows with `command_received` triggers.
   */
  async onCommandReceived(
    chatId: bigint,
    userId: bigint,
    command: string,
    args: string,
    messageId: number,
  ): Promise<void> {
    const triggerData = {
      type: 'command_received',
      chatId: chatId.toString(),
      userId: userId.toString(),
      command,
      args,
      messageId,
      text: `${command} ${args}`.trim(),
      timestamp: new Date().toISOString(),
    }

    await this.forwardToMatchingFlows('command_received', triggerData, chatId)
  }

  /**
   * Forward an edited message event to flows with `message_edited` triggers.
   */
  async onMessageEdited(
    chatId: bigint,
    userId: bigint,
    text: string,
    messageId: number,
  ): Promise<void> {
    const triggerData = {
      type: 'message_edited',
      chatId: chatId.toString(),
      userId: userId.toString(),
      text,
      messageId,
      timestamp: new Date().toISOString(),
    }

    await this.forwardToMatchingFlows('message_edited', triggerData, chatId)
  }

  /**
   * Forward a chat member status update to flows with `chat_member_updated` triggers.
   */
  async onChatMemberUpdated(
    chatId: bigint,
    userId: bigint,
    oldStatus: string,
    newStatus: string,
    username?: string,
  ): Promise<void> {
    const triggerData = {
      type: 'chat_member_updated',
      chatId: chatId.toString(),
      userId: userId.toString(),
      userName: username ?? '',
      oldStatus,
      newStatus,
      timestamp: new Date().toISOString(),
    }

    await this.forwardToMatchingFlows('chat_member_updated', triggerData, chatId)
  }

  /**
   * Forward a poll answer event to flows with `poll_answer` triggers.
   */
  async onPollAnswer(
    userId: bigint,
    pollId: string,
    optionIds: number[],
  ): Promise<void> {
    const triggerData = {
      type: 'poll_answer',
      userId: userId.toString(),
      pollId,
      optionIds,
      timestamp: new Date().toISOString(),
    }

    await this.forwardToMatchingFlows('poll_answer', triggerData)
  }

  /**
   * Forward an inline query event to flows with `inline_query` triggers.
   */
  async onInlineQuery(
    userId: bigint,
    queryId: string,
    query: string,
    offset: string,
  ): Promise<void> {
    const triggerData = {
      type: 'inline_query',
      userId: userId.toString(),
      queryId,
      query,
      offset,
      timestamp: new Date().toISOString(),
    }

    await this.forwardToMatchingFlows('inline_query', triggerData)
  }

  /**
   * Forward the bot's own chat member status change to flows with `my_chat_member` triggers.
   */
  async onMyChatMemberUpdated(
    chatId: bigint,
    oldStatus: string,
    newStatus: string,
  ): Promise<void> {
    const triggerData = {
      type: 'my_chat_member',
      chatId: chatId.toString(),
      oldStatus,
      newStatus,
      timestamp: new Date().toISOString(),
    }

    await this.forwardToMatchingFlows('my_chat_member', triggerData, chatId)
  }

  /**
   * Forward a chat title change event to flows with `new_chat_title` triggers.
   */
  async onNewChatTitle(
    chatId: bigint,
    userId: bigint,
    title: string,
  ): Promise<void> {
    const triggerData = {
      type: 'new_chat_title',
      chatId: chatId.toString(),
      userId: userId.toString(),
      title,
      timestamp: new Date().toISOString(),
    }

    await this.forwardToMatchingFlows('new_chat_title', triggerData, chatId)
  }

  /**
   * Forward a chat photo change event to flows with `new_chat_photo` triggers.
   */
  async onNewChatPhoto(
    chatId: bigint,
    userId: bigint,
  ): Promise<void> {
    const triggerData = {
      type: 'new_chat_photo',
      chatId: chatId.toString(),
      userId: userId.toString(),
      timestamp: new Date().toISOString(),
    }

    await this.forwardToMatchingFlows('new_chat_photo', triggerData, chatId)
  }

  /**
   * Forward a chat join request event to flows with `chat_join_request` triggers.
   */
  async onChatJoinRequest(
    chatId: bigint,
    userId: bigint,
    username?: string,
  ): Promise<void> {
    const triggerData = {
      type: 'chat_join_request',
      chatId: chatId.toString(),
      userId: userId.toString(),
      userName: username ?? '',
      timestamp: new Date().toISOString(),
    }

    await this.forwardToMatchingFlows('chat_join_request', triggerData, chatId)
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
