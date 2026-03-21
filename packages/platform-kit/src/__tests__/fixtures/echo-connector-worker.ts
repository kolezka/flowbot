// Echo connector worker fixture for pool integration tests.
// Uses runWorker() with a fake in-memory connector that supports two actions:
//   - echo: returns the input text and the worker's instanceId
//   - fail: always throws an intentional error
import { runWorker } from '../../pool/worker-entry.ts'
import { ActionRegistry } from '../../action-registry.ts'
import * as v from 'valibot'

runWorker((config) => {
  const registry = new ActionRegistry()
  return {
    registry,
    async connect() {
      registry.register('echo', {
        schema: v.object({ text: v.string() }),
        handler: async (params) => ({ echoed: params.text, instanceId: config['instanceId'] }),
      })
      registry.register('fail', {
        schema: v.object({}),
        handler: async () => {
          throw new Error('Intentional failure')
        },
      })
    },
    async disconnect() {},
    isConnected() {
      return true
    },
  }
})
