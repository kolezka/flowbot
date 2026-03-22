import type { BotScope } from '@flowbot/platform-kit'

export function shouldProcessMessage(
  scope: BotScope | undefined,
  chatId: string,
  userId: string,
): boolean {
  if (!scope) return true

  const hasGroupScope = scope.groupIds !== undefined && scope.groupIds.length > 0
  const hasUserScope = scope.userIds !== undefined && scope.userIds.length > 0

  if (!hasGroupScope && !hasUserScope) return true

  if (hasGroupScope && scope.groupIds!.includes(chatId)) return true
  if (hasUserScope && scope.userIds!.includes(userId)) return true

  return false
}
