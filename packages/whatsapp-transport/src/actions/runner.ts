import type { IWhatsAppTransport } from '../transport/IWhatsAppTransport.js'
import type { Action } from './types.js'

import {
  executeDemote,
  executeGetGroupInfo,
  executeGetInviteLink,
  executeKick,
  executePromote,
} from './executors/group-admin.js'
import {
  executeDelete,
  executeEdit,
  executeForward,
  executeReadHistory,
} from './executors/message-mgmt.js'
import { executeSendPresence } from './executors/presence.js'
import {
  executeSendAudio,
  executeSendDocument,
  executeSendPhoto,
  executeSendSticker,
  executeSendVideo,
  executeSendVoice,
} from './executors/send-media.js'
import { executeSendMessage } from './executors/send-message.js'
import { ActionType } from './types.js'

export interface ActionResult {
  success: boolean
  data?: unknown
  error?: string
}

export class ActionRunner {
  private readonly transport: IWhatsAppTransport

  constructor(transport: IWhatsAppTransport) {
    this.transport = transport
  }

  async execute(action: Action): Promise<ActionResult> {
    try {
      const data = await this.dispatch(action)
      return { success: true, data }
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async dispatch(action: Action): Promise<unknown> {
    switch (action.type) {
      case ActionType.SEND_MESSAGE:
        return executeSendMessage(this.transport, action)
      case ActionType.SEND_PHOTO:
        return executeSendPhoto(this.transport, action)
      case ActionType.SEND_VIDEO:
        return executeSendVideo(this.transport, action)
      case ActionType.SEND_AUDIO:
        return executeSendAudio(this.transport, action)
      case ActionType.SEND_VOICE:
        return executeSendVoice(this.transport, action)
      case ActionType.SEND_STICKER:
        return executeSendSticker(this.transport, action)
      case ActionType.SEND_DOCUMENT:
        return executeSendDocument(this.transport, action)
      case ActionType.SEND_LOCATION:
        return this.transport.sendLocation(action.jid, action.latitude, action.longitude)
      case ActionType.SEND_CONTACT:
        return this.transport.sendContact(action.jid, action.contact)
      case ActionType.FORWARD_MESSAGE:
        return executeForward(this.transport, action)
      case ActionType.EDIT_MESSAGE:
        return executeEdit(this.transport, action)
      case ActionType.DELETE_MESSAGE:
        return executeDelete(this.transport, action)
      case ActionType.READ_HISTORY:
        return executeReadHistory(this.transport, action)
      case ActionType.KICK_USER:
        return executeKick(this.transport, action)
      case ActionType.PROMOTE_USER:
        return executePromote(this.transport, action)
      case ActionType.DEMOTE_USER:
        return executeDemote(this.transport, action)
      case ActionType.GET_GROUP_INFO:
        return executeGetGroupInfo(this.transport, action)
      case ActionType.GET_INVITE_LINK:
        return executeGetInviteLink(this.transport, action)
      case ActionType.SEND_PRESENCE:
        return executeSendPresence(this.transport, action)
      default: {
        const exhaustiveCheck: never = action
        throw new Error(`Unknown action type: ${String((exhaustiveCheck as Action).type)}`)
      }
    }
  }
}
