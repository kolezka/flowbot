import type { BaseSchema } from 'valibot'

export interface ActionResult {
  success: boolean
  data?: unknown
  error?: string
}

export interface ActionDef<TParams = unknown> {
  schema: BaseSchema<unknown, TParams, any>
  handler: (params: TParams) => Promise<unknown>
}

export interface ObservabilityHooks {
  onExecute?: (action: string, durationMs: number, success: boolean) => void
  onError?: (action: string, error: unknown) => void
}
