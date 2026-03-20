export class ConnectorError extends Error {
  public readonly code: string
  public readonly original: unknown

  constructor(message: string, code: string, original?: unknown) {
    super(message)
    this.name = 'ConnectorError'
    this.code = code
    this.original = original

    if (original instanceof Error && original.stack) {
      this.stack = `${this.stack}\nCaused by: ${original.stack}`
    }
  }
}
