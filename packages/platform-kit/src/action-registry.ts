import * as v from 'valibot'
import type { ActionDef, ActionResult, ObservabilityHooks } from './types.js'

export class ActionRegistry {
  private readonly actions = new Map<string, ActionDef<unknown>>()
  private readonly hooks: ObservabilityHooks

  constructor(hooks: ObservabilityHooks = {}) {
    this.hooks = hooks
  }

  register<TParams>(name: string, def: ActionDef<TParams>): void {
    if (this.actions.has(name)) {
      throw new Error(`Action "${name}" is already registered`)
    }
    this.actions.set(name, def as ActionDef<unknown>)
  }

  async execute(action: string, rawParams: unknown): Promise<ActionResult> {
    const def = this.actions.get(action)
    if (def === undefined) {
      return { success: false, error: `Action "${action}" is not registered` }
    }

    const start = Date.now()

    let parsed: unknown
    try {
      parsed = v.parse(def.schema, rawParams)
    } catch (err) {
      if (err instanceof v.ValiError) {
        const message = err.issues.map((i) => i.message).join(', ')
        return { success: false, error: `Invalid params: ${message}` }
      }
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }

    try {
      const data = await def.handler(parsed)
      const durationMs = Date.now() - start
      this.hooks.onExecute?.(action, durationMs, true)
      return { success: true, data }
    } catch (err) {
      const durationMs = Date.now() - start
      this.hooks.onExecute?.(action, durationMs, false)
      const error = err instanceof Error ? err : new Error(String(err))
      this.hooks.onError?.(action, error)
      return { success: false, error: error.message }
    }
  }

  getActions(): string[] {
    return Array.from(this.actions.keys())
  }

  supports(action: string): boolean {
    return this.actions.has(action)
  }
}
