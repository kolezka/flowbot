export class WhatsAppTransportError extends Error {
  public readonly original: unknown

  constructor(message: string, original?: unknown) {
    super(message)
    this.name = 'WhatsAppTransportError'
    this.original = original

    if (original instanceof Error && original.stack) {
      this.stack = `${this.stack}\nCaused by: ${original.stack}`
    }
  }
}
