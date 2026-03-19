import type {
  IWhatsAppTransport,
  WhatsAppContact,
  WhatsAppMessageKey,
  WhatsAppPresenceType,
} from '@flowbot/whatsapp-transport'

export interface ActionResult {
  success: boolean
  result?: unknown
  error?: string
}

/**
 * Dispatches a named action to the WhatsApp transport and returns a
 * normalised result envelope.
 */
export async function handleAction(
  transport: IWhatsAppTransport,
  action: string,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    const chatId = String(params.chatId ?? '')
    const userId = params.userId ? String(params.userId) : ''

    let result: unknown

    switch (action) {
      // --- Messaging ---
      case 'send_message': {
        const res = await transport.sendMessage(chatId, String(params.text ?? ''))
        result = { key: res.key, status: res.status }
        break
      }

      case 'send_photo': {
        const res = await transport.sendMedia(
          chatId,
          'image',
          String(params.photoUrl ?? ''),
          { caption: params.caption ? String(params.caption) : undefined },
        )
        result = { key: res.key, status: res.status }
        break
      }

      case 'send_video': {
        const res = await transport.sendMedia(
          chatId,
          'video',
          String(params.videoUrl ?? ''),
          { caption: params.caption ? String(params.caption) : undefined },
        )
        result = { key: res.key, status: res.status }
        break
      }

      case 'send_document': {
        const res = await transport.sendDocument(
          chatId,
          String(params.documentUrl ?? ''),
          {
            caption: params.caption ? String(params.caption) : undefined,
            fileName: params.fileName ? String(params.fileName) : undefined,
          },
        )
        result = { key: res.key, status: res.status }
        break
      }

      case 'send_audio': {
        const res = await transport.sendMedia(
          chatId,
          'audio',
          String(params.audioUrl ?? ''),
        )
        result = { key: res.key, status: res.status }
        break
      }

      case 'send_voice': {
        const res = await transport.sendMedia(
          chatId,
          'audio',
          String(params.voiceUrl ?? ''),
          { ptt: true },
        )
        result = { key: res.key, status: res.status }
        break
      }

      case 'send_sticker': {
        const res = await transport.sendMedia(
          chatId,
          'sticker',
          String(params.sticker ?? ''),
        )
        result = { key: res.key, status: res.status }
        break
      }

      case 'send_location': {
        const res = await transport.sendLocation(
          chatId,
          Number(params.lat),
          Number(params.lng),
        )
        result = { key: res.key, status: res.status }
        break
      }

      case 'send_contact': {
        const contact = params.contact as WhatsAppContact
        const res = await transport.sendContact(chatId, contact)
        result = { key: res.key, status: res.status }
        break
      }

      // --- Message management ---
      case 'forward_message': {
        const key = params.key as WhatsAppMessageKey
        const res = await transport.forwardMessage(
          String(params.from ?? ''),
          String(params.to ?? ''),
          key,
        )
        result = { key: res.key, status: res.status }
        break
      }

      case 'edit_message': {
        const key = params.key as WhatsAppMessageKey
        const res = await transport.editMessage(chatId, key, String(params.text ?? ''))
        result = { key: res.key, status: res.status }
        break
      }

      case 'delete_message': {
        const key = params.key as WhatsAppMessageKey
        const deleted = await transport.deleteMessage(chatId, key)
        result = { deleted }
        break
      }

      case 'read_history': {
        await transport.readHistory(chatId, params.count ? Number(params.count) : undefined)
        result = { done: true }
        break
      }

      // --- Group admin ---
      case 'kick_user': {
        const kicked = await transport.kickParticipant(chatId, userId)
        result = { kicked }
        break
      }

      case 'promote_user': {
        const promoted = await transport.promoteParticipant(chatId, userId)
        result = { promoted }
        break
      }

      case 'demote_user': {
        const demoted = await transport.demoteParticipant(chatId, userId)
        result = { demoted }
        break
      }

      case 'get_group_info': {
        const meta = await transport.getGroupMetadata(chatId)
        result = meta
        break
      }

      case 'get_invite_link': {
        const link = await transport.getGroupInviteLink(chatId)
        result = { inviteLink: link }
        break
      }

      // --- Presence ---
      case 'send_presence': {
        await transport.sendPresenceUpdate(chatId, String(params.type ?? 'available') as WhatsAppPresenceType)
        result = { done: true }
        break
      }

      default:
        return { success: false, error: `Unknown action: ${action}` }
    }

    return { success: true, result }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}
