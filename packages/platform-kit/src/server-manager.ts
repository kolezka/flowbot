import { serve } from '@hono/node-server'

export function createServerManager(
  server: { fetch: (...args: any[]) => any },
  options: { host: string; port: number },
) {
  let handle: undefined | ReturnType<typeof serve>
  return {
    start() {
      return new Promise<{ url: string }>((resolve) => {
        handle = serve(
          { fetch: server.fetch, hostname: options.host, port: options.port },
          (info) => resolve({
            url: info.family === 'IPv6'
              ? `http://[${info.address}]:${info.port}`
              : `http://${info.address}:${info.port}`,
          }),
        )
      })
    },
    stop() {
      return new Promise<void>((resolve) => {
        if (handle) handle.close(() => resolve())
        else resolve()
      })
    },
  }
}
