import QRCode from 'qrcode'
import type { IWhatsAppTransport } from './sdk/types.js'
import type { Logger } from 'pino'

/**
 * Wires QR-code and connection-open callbacks on the transport so that auth
 * state is pushed to the NestJS API in real time.
 *
 * Call this BEFORE `transport.connect()` so the callbacks are registered
 * before Baileys starts emitting events.
 */
export function setupQrAuth(
  transport: IWhatsAppTransport,
  apiUrl: string,
  connectionId: string,
  logger: Logger,
): void {
  transport.onQrCode(async (qr: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 })
      await fetch(`${apiUrl}/api/connections/${connectionId}/qr-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'qr', qr: dataUrl, connectionId }),
        signal: AbortSignal.timeout(5_000),
      })
    } catch (err) {
      logger.error({ err, connectionId }, 'Failed to push QR code update')
    }
  })

  transport.onConnectionUpdate(async (update) => {
    if (update.connection === 'open') {
      try {
        await fetch(`${apiUrl}/api/connections/${connectionId}/qr-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'connected', connectionId }),
          signal: AbortSignal.timeout(5_000),
        })
      } catch (err) {
        logger.error({ err, connectionId }, 'Failed to push connection update')
      }
    }
  })
}
