
export type UserDataUpsertDTO = {
  telegramId: bigint
  username: string | null
  firstName: string | null
  lastName: string | null
  languageCode: string | null
  isBot: boolean
  lastChatId: bigint | null

  updateKind: 'message' | 'callback' | 'other'
  lastMessageText: string | null

  seenAt: Date
  messageAt: Date | null
  isCommand: boolean

  messageCountDelta: 0 | 1
  commandCountDelta: 0 | 1
}

export type UserDataUpsertDTOUpdateKind = UserDataUpsertDTO['updateKind']
