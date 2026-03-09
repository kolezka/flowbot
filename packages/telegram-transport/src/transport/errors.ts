export class TransportError extends Error {
  public readonly original: unknown

  constructor(message: string, original?: unknown) {
    super(message)
    this.name = 'TransportError'
    this.original = original

    if (original instanceof Error && original.stack) {
      this.stack = `${this.stack}\nCaused by: ${original.stack}`
    }
  }
}
