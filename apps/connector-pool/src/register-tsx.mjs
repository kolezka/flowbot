/**
 * Shim for worker threads to register tsx's ESM hooks.
 *
 * tsx's auto-registration only runs on the main thread. Worker threads need
 * to call register() explicitly. This file is used as the --import target
 * in worker execArgv.
 */
import { register } from 'tsx/esm/api'
register()
