# Issue #004: Trigger.dev Worker Not Running - Tasks Stay Queued

## Severity: High
## Status: Open
## Date Found: 2026-03-10
## Component: Trigger.dev Background Jobs

## Description
Trigger.dev tasks can be triggered successfully via the API, but they remain in QUEUED status indefinitely because no worker process is running to execute them.

## Steps to Reproduce
1. Trigger a task via API:
   ```bash
   curl -X POST "https://trigger.raqz.link/api/v1/tasks/broadcast/trigger" \
     -H "Authorization: Bearer tr_dev_xxx" \
     -H "Content-Type: application/json" \
     -d '{"payload": {"broadcastId": "test-broadcast-id"}}'
   ```
2. Check the run status via API:
   ```bash
   curl "https://trigger.raqz.link/api/v3/runs/{run_id}" \
     -H "Authorization: Bearer tr_dev_xxx"
   ```
3. Observe that status remains "QUEUED" indefinitely

## Expected Behavior
- Tasks should be picked up by a worker and executed
- Status should progress from QUEUED -> EXECUTING -> COMPLETED/FAILED

## Actual Behavior
```json
{
  "status": "QUEUED",
  "isQueued": true,
  "isExecuting": false,
  "attemptCount": 0,
  "attempts": []
}
```
The task remains in QUEUED status with 0 attempts even after waiting 5+ seconds.

## Root Cause Analysis
The Trigger.dev worker process (`pnpm trigger dev`) is not running. The self-hosted Trigger.dev instance at trigger.raqz.link is operational (can queue tasks), but without a worker, tasks never execute.

## Impact
- All background jobs (broadcasts, scheduled messages, health checks, flow execution) are non-functional
- Tasks accumulate in the queue without processing
- System appears to work but silently fails to process background work

## Recommended Fix
Start the Trigger.dev worker process:
```bash
pnpm trigger dev
```

For production, ensure the worker is:
1. Running as a systemd service or container
2. Configured with proper environment variables
3. Monitored for crashes and auto-restarted

## Related Files
- `apps/trigger/src/index.ts` - Main entry point
- `apps/trigger/trigger.config.ts` - Configuration
- `apps/trigger/src/trigger/*.ts` - Task definitions

## Verification
After starting the worker:
1. Check worker appears in Trigger.dev dashboard
2. Trigger a test task
3. Verify task status changes to EXECUTING then COMPLETED
