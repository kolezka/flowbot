import * as v from 'valibot'

export enum ActionType {
  SEND_MESSAGE = 'SEND_MESSAGE',
  FORWARD_MESSAGE = 'FORWARD_MESSAGE',
}

export interface SendMessagePayload {
  peer: string
  text: string
  parseMode?: string
  replyToMsgId?: number
  silent?: boolean
}

export interface ForwardMessagePayload {
  fromPeer: string
  toPeer: string
  messageIds: number[]
  silent?: boolean
  dropAuthor?: boolean
}

export type ActionPayload = SendMessagePayload | ForwardMessagePayload

export interface Action {
  type: ActionType
  payload: ActionPayload
  idempotencyKey?: string
}

export const SendMessagePayloadSchema = v.object({
  peer: v.string(),
  text: v.string(),
  parseMode: v.optional(v.string()),
  replyToMsgId: v.optional(v.number()),
  silent: v.optional(v.boolean()),
})

export const ForwardMessagePayloadSchema = v.object({
  fromPeer: v.string(),
  toPeer: v.string(),
  messageIds: v.array(v.number()),
  silent: v.optional(v.boolean()),
  dropAuthor: v.optional(v.boolean()),
})

export const ActionSchema = v.variant('type', [
  v.object({
    type: v.literal(ActionType.SEND_MESSAGE),
    payload: SendMessagePayloadSchema,
    idempotencyKey: v.optional(v.string()),
  }),
  v.object({
    type: v.literal(ActionType.FORWARD_MESSAGE),
    payload: ForwardMessagePayloadSchema,
    idempotencyKey: v.optional(v.string()),
  }),
])
