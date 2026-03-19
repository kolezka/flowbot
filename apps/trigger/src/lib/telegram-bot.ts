const TELEGRAM_BOT_API_URL = process.env.TELEGRAM_BOT_API_URL || 'http://localhost:3001'

export interface SendMessageResult {
  success: boolean
  messageId?: number
  error?: string
}

export async function sendMessageViaTelegramBot(
  chatId: string,
  text: string,
): Promise<SendMessageResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(`${TELEGRAM_BOT_API_URL}/api/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, text }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    const data = (await response.json()) as SendMessageResult
    return data
  } catch (error) {
    clearTimeout(timeout)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function checkTelegramBotHealth(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5_000)
    const response = await fetch(`${TELEGRAM_BOT_API_URL}/health`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return response.ok
  } catch {
    return false
  }
}
