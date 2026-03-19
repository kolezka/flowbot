import type { Context } from 'hono'
import type { IWhatsAppTransport } from '@flowbot/whatsapp-transport'
import type { Logger } from '../logger.js'

/**
 * Creates a Hono route handler that:
 * 1. Accepts a `connectionId` in the POST body.
 * 2. Registers a QR-code listener on the transport.
 * 3. Pushes the generated QR to the NestJS API whenever the transport
 *    emits a new QR code.
 */
export function createQrAuthHandler(
  transport: IWhatsAppTransport,
  apiUrl: string,
  logger: Logger,
) {
  return async (c: Context) => {
    let body: { connectionId?: string }
    try {
      body = await c.req.json<{ connectionId?: string }>()
    }
    catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400)
    }

    const { connectionId } = body
    if (!connectionId) {
      return c.json({ success: false, error: 'connectionId is required' }, 400)
    }

    transport.onQrCode((qr) => {
      const endpoint = `${apiUrl}/api/connections/${connectionId}/qr-update`
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr }),
      }).catch((err: unknown) => {
        logger.error({ err, connectionId }, 'Failed to push QR code to API')
      })
    })

    return c.json({ success: true, connectionId })
  }
}
