import type { Config } from './config.js'
import { pino } from 'pino'

export function createLogger(config: Config) {
  return pino({
    level: config.logLevel,
    redact: ['*.session', '*.sessionString', 'session'],
    transport: {
      targets: [
        ...(config.isDebug
          ? [
              {
                target: 'pino-pretty',
                level: config.logLevel,
                options: {
                  ignore: 'pid,hostname',
                  colorize: true,
                  translateTime: true,
                },
              },
            ]
          : [
              {
                target: 'pino/file',
                level: config.logLevel,
                options: {},
              },
            ]),
      ],
    },
  })
}

export function createAuditLogger(logger: Logger) {
  return logger.child({}, { level: 'info' })
}

export type Logger = ReturnType<typeof createLogger>
