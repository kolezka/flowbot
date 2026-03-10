# Issue #003: WebSocket Connection Fails on Dashboard

## Severity: Medium
## Status: Fixed
## Date Found: 2026-03-10
## Component: Frontend WebSocket / Real-time Updates

## Description
The WebSocket connection to the API server fails immediately on dashboard load, preventing real-time updates from working.

## Steps to Reproduce
1. Navigate to http://localhost:3001
2. Log in with valid credentials
3. Open browser developer console (F12)
4. Observe WebSocket connection warning

## Expected Behavior
WebSocket should connect successfully to enable real-time updates for:
- Activity feed
- System health status
- Live notifications

## Actual Behavior
Console shows:
```
WebSocket connection to 'ws://localhost:3000/socket.io/?EIO=4&transport=websocket' failed:
WebSocket is closed before the connection is established.
```

## Root Cause Analysis
1. The API server may not have Socket.IO properly configured
2. WebSocket endpoint may not be enabled
3. CORS configuration may be blocking WebSocket connections

## Impact
- Real-time features on dashboard don't work
- Activity feed shows "No recent activity" even when events occur
- System health status may be stale

## Recommended Fix
1. Verify Socket.IO is properly configured in the API
2. Check CORS settings allow WebSocket connections from frontend origin
3. Ensure WebSocket gateway is properly initialized in NestJS

## Related Files
- `apps/frontend/src/lib/websocket.tsx`
- `apps/api/src/events/events.gateway.ts`
- `apps/api/src/events/events.module.ts`

## Console Output
```
[WARNING] WebSocket connection to 'ws://localhost:3000/socket.io/?EIO=4&transport=websocket' failed:
WebSocket is closed before the connection is established.
```
