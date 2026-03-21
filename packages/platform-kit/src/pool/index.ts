// packages/platform-kit/src/pool/index.ts
export { createPoolServer } from './pool-server.js'
export type { PoolServerConfig } from './pool-server.js'
export { runWorker } from './worker-entry.js'
export { WorkerWrapper } from './worker-wrapper.js'
export type { WorkerWrapperConfig } from './worker-wrapper.js'
export { Reconciler } from './reconciler.js'
export type { ReconcilerConfig } from './reconciler.js'
export type { WorkerWrapper as IWorkerWrapper } from './reconciler.js'
export type {
  PoolConnector,
  PoolConfig,
  InstanceRecord,
  BotInstanceRecord,
  UserConnectionRecord,
  WorkerInitMessage,
  WorkerReadyMessage,
  WorkerErrorMessage,
  WorkerExecuteMessage,
  WorkerResultMessage,
  WorkerHealthMessage,
  WorkerShutdownMessage,
  MainToWorkerMessage,
  WorkerToMainMessage,
  WorkerState,
} from './types.js'
