import type { WhatsAppGroupMetadata, WhatsAppMessageResult } from '../../transport/IWhatsAppTransport.js'
import type { IWhatsAppTransport } from '../../transport/IWhatsAppTransport.js'
import type {
  DemoteUserPayload,
  GetGroupInfoPayload,
  GetInviteLinkPayload,
  KickUserPayload,
  PromoteUserPayload,
} from '../types.js'

export async function executeKick(
  transport: IWhatsAppTransport,
  payload: KickUserPayload,
): Promise<boolean> {
  return transport.kickParticipant(payload.groupJid, payload.userJid)
}

export async function executePromote(
  transport: IWhatsAppTransport,
  payload: PromoteUserPayload,
): Promise<boolean> {
  return transport.promoteParticipant(payload.groupJid, payload.userJid)
}

export async function executeDemote(
  transport: IWhatsAppTransport,
  payload: DemoteUserPayload,
): Promise<boolean> {
  return transport.demoteParticipant(payload.groupJid, payload.userJid)
}

export async function executeGetGroupInfo(
  transport: IWhatsAppTransport,
  payload: GetGroupInfoPayload,
): Promise<WhatsAppGroupMetadata> {
  return transport.getGroupMetadata(payload.groupJid)
}

export async function executeGetInviteLink(
  transport: IWhatsAppTransport,
  payload: GetInviteLinkPayload,
): Promise<string> {
  return transport.getGroupInviteLink(payload.groupJid)
}
