import { logger } from '@trigger.dev/sdk/v3';
import { getTransportForConnection } from './connection-transport.js';
import type { DispatchResult } from './dispatcher.js';

/**
 * Dispatch a user_* action via a specific PlatformConnection's GramJS transport.
 * These actions ONLY work with MTProto user accounts, never Bot API.
 */
export async function dispatchUserAction(
  action: string,
  params: Record<string, unknown>,
  connectionId: string,
): Promise<DispatchResult> {
  if (!action.startsWith('user_')) {
    return { nodeId: '', dispatched: false, error: `'${action}' is not a user account action` };
  }

  try {
    const transport = await getTransportForConnection(connectionId);
    const client = transport.getClient() as import('telegram').TelegramClient;

    if (!client) {
      return { nodeId: '', dispatched: false, error: 'Transport has no underlying client' };
    }

    const chatId = String(params.chatId ?? '');
    let response: unknown;

    switch (action) {
      // --- Read Operations ---
      case 'user_get_chat_history': {
        const limit = Number(params.limit ?? 50);
        const entity = await client.getEntity(chatId);
        response = await client.getMessages(entity, { limit });
        break;
      }

      case 'user_search_messages': {
        const entity = await client.getEntity(chatId);
        response = await client.getMessages(entity, {
          search: String(params.query ?? ''),
          limit: Number(params.limit ?? 50),
        });
        break;
      }

      case 'user_get_all_members': {
        const entity = await client.getEntity(chatId);
        response = await client.getParticipants(entity, {
          limit: Number(params.limit ?? 200),
        });
        break;
      }

      case 'user_get_chat_info': {
        response = await client.getEntity(chatId);
        break;
      }

      case 'user_get_contacts': {
        const { Api } = await import('telegram');
        response = await client.invoke(new Api.contacts.GetContacts({ hash: BigInt(0) }));
        break;
      }

      case 'user_get_dialogs': {
        response = await client.getDialogs({ limit: Number(params.limit ?? 100) });
        break;
      }

      // --- Write Operations ---
      case 'user_send_message': {
        response = await transport.sendMessage(chatId, String(params.text ?? ''), {
          parseMode: mapParseMode(params.parseMode),
          silent: Boolean(params.disableNotification),
          replyToMsgId: params.replyToMessageId ? Number(params.replyToMessageId) : undefined,
        });
        break;
      }

      case 'user_send_media': {
        const mediaType = String(params.mediaType ?? 'photo');
        const url = String(params.url ?? '');
        if (mediaType === 'video') {
          response = await transport.sendVideo(chatId, url, { caption: params.caption ? String(params.caption) : undefined });
        } else if (mediaType === 'document') {
          response = await transport.sendDocument(chatId, url, { caption: params.caption ? String(params.caption) : undefined });
        } else {
          response = await transport.sendPhoto(chatId, url, { caption: params.caption ? String(params.caption) : undefined });
        }
        break;
      }

      case 'user_forward_message': {
        const fromChatId = String(params.fromChatId ?? '');
        const toChatId = String(params.toChatId ?? chatId);
        const messageIds = Array.isArray(params.messageIds)
          ? (params.messageIds as number[])
          : [Number(params.messageId ?? 0)];
        response = await transport.forwardMessage(fromChatId, toChatId, messageIds);
        break;
      }

      case 'user_delete_messages': {
        const msgIds = Array.isArray(params.messageIds)
          ? (params.messageIds as number[])
          : [Number(params.messageId ?? 0)];
        response = await transport.deleteMessages(chatId, msgIds);
        break;
      }

      case 'user_join_chat': {
        const { Api } = await import('telegram');
        const link = String(params.invite ?? params.username ?? '');
        if (link.includes('+') || link.includes('joinchat')) {
          const hash = link.split('+').pop() || link.split('joinchat/').pop() || '';
          response = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
        } else {
          const entity = await client.getEntity(link);
          response = await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
        }
        break;
      }

      case 'user_leave_chat': {
        const entity = await client.getEntity(chatId);
        const { Api } = await import('telegram');
        response = await client.invoke(new Api.channels.LeaveChannel({ channel: entity }));
        break;
      }

      case 'user_create_group': {
        const { Api } = await import('telegram');
        const users = (params.users as string[] ?? []);
        const entities = await Promise.all(users.map((u) => client.getEntity(u)));
        response = await client.invoke(new Api.messages.CreateChat({
          title: String(params.title ?? 'New Group'),
          users: entities,
        }));
        break;
      }

      case 'user_create_channel': {
        const { Api } = await import('telegram');
        response = await client.invoke(new Api.channels.CreateChannel({
          title: String(params.title ?? 'New Channel'),
          about: String(params.about ?? ''),
          broadcast: Boolean(params.broadcast ?? true),
          megagroup: Boolean(params.megagroup ?? false),
        }));
        break;
      }

      case 'user_invite_users': {
        const { Api } = await import('telegram');
        const entity = await client.getEntity(chatId);
        const inviteUsers = (params.users as string[] ?? []);
        const userEntities = await Promise.all(inviteUsers.map((u) => client.getEntity(u)));
        response = await client.invoke(new Api.channels.InviteToChannel({
          channel: entity,
          users: userEntities,
        }));
        break;
      }

      // --- Account Operations ---
      case 'user_update_profile': {
        const { Api } = await import('telegram');
        response = await client.invoke(new Api.account.UpdateProfile({
          firstName: params.firstName ? String(params.firstName) : undefined,
          lastName: params.lastName ? String(params.lastName) : undefined,
          about: params.bio ? String(params.bio) : undefined,
        }));
        break;
      }

      case 'user_set_status': {
        const { Api } = await import('telegram');
        const offline = Boolean(params.offline ?? false);
        response = await client.invoke(new Api.account.UpdateStatus({ offline }));
        break;
      }

      case 'user_get_profile_photos': {
        const { Api } = await import('telegram');
        const entity = await client.getEntity(String(params.userId ?? chatId));
        response = await client.invoke(new Api.photos.GetUserPhotos({
          userId: entity,
          offset: 0,
          maxId: BigInt(0),
          limit: Number(params.limit ?? 10),
        }));
        break;
      }

      default:
        return { nodeId: '', dispatched: false, error: `Unknown user action: ${action}` };
    }

    return { nodeId: '', dispatched: true, response };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`User action dispatch failed for ${action}: ${msg}`);
    return { nodeId: '', dispatched: false, error: msg };
  }
}

function mapParseMode(mode: unknown): 'html' | 'markdown' | undefined {
  const str = String(mode ?? '').toLowerCase();
  if (str === 'html') return 'html';
  if (str === 'markdownv2' || str === 'markdown') return 'markdown';
  return undefined;
}
