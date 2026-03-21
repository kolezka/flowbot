// packages/platform-kit/src/pool/types.ts
import type { ActionRegistry } from '../action-registry.js'
import type { Logger } from 'pino'

// --- Connector interface that pool manages ---

export interface PoolConnector {
  readonly registry: ActionRegistry
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
}

// --- Instance records from DB ---

export interface BotInstanceRecord {
  id: string
  botToken: string | null
  platform: string
  apiUrl: string | null
  metadata: Record<string, unknown> | null
}

export interface UserConnectionRecord {
  id: string
  platform: string
  credentials: Record<string, unknown>
  botInstanceId: string | null
  metadata: Record<string, unknown> | null
}

export type InstanceRecord = BotInstanceRecord | UserConnectionRecord

// --- Pool configuration ---

export interface PoolConfig {
  platform: string
  type: 'bot' | 'user'
  workerScript: string
  getInstances(): Promise<InstanceRecord[]>
  toWorkerData(instance: InstanceRecord): Record<string, unknown>
  batchSize?: number              // default 20
  batchDelayMs?: number           // default 1000
  reconcileIntervalMs?: number    // default 30_000
  maxWorkersPerProcess?: number   // default 50
  poolUrl: string                 // this pool's URL for DB apiUrl updates
  logger: Logger
  updateApiUrl?(instanceId: string, apiUrl: string): Promise<void>
}

// --- MessagePort protocol ---

export interface WorkerInitMessage {
  type: 'init'
  config: Record<string, unknown>
}

export interface WorkerReadyMessage {
  type: 'ready'
}

export interface WorkerErrorMessage {
  type: 'error'
  code: string
  message: string
  fatal: boolean
}

export interface WorkerExecuteMessage {
  type: 'execute'
  requestId: string
  action: string
  params: Record<string, unknown>
}

export interface WorkerResultMessage {
  type: 'result'
  requestId: string
  success: boolean
  data?: unknown
  error?: string
}

export interface WorkerHealthMessage {
  type: 'health'
  connected: boolean
  uptime: number
  actionCount: number
  errorCount: number
}

export interface WorkerShutdownMessage {
  type: 'shutdown'
}

export type MainToWorkerMessage = WorkerInitMessage | WorkerExecuteMessage | WorkerShutdownMessage
export type WorkerToMainMessage = WorkerReadyMessage | WorkerErrorMessage | WorkerResultMessage | WorkerHealthMessage

// --- Worker state tracked by main thread ---

export interface WorkerState {
  instanceId: string
  worker: import('node:worker_threads').Worker
  status: 'starting' | 'ready' | 'draining' | 'dead'
  pendingRequests: Map<string, {
    resolve: (result: WorkerResultMessage) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>
  lastHealth: WorkerHealthMessage | null
  startedAt: number
}
