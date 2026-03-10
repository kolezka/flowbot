# ISSUE-018 — WebSocket gateway has no authentication

**Severity:** medium
**Area:** api
**Discovered in phase:** Phase 3 — API Testing (Security Scan)

---

## Description

The WebSocket gateway (`WsGateway`) accepts connections from any client without verifying authentication tokens. Any unauthenticated client can connect and join rooms (`moderation`, `automation`, `system`) to receive all real-time events including moderation actions, broadcast status, and system health data.

---

## Steps to Reproduce

1. Start the API server
2. Open a browser console and connect without auth:
   ```javascript
   const socket = io('http://localhost:3000');
   socket.on('connect', () => {
     socket.emit('join', 'moderation');
     socket.on('moderation:warning', (data) => console.log(data));
   });
   ```
3. Observe: connection succeeds and events are received without any token.

**Environment:** localhost:3000

---

## Actual Result

WebSocket connections are accepted without authentication. All real-time events are accessible to unauthenticated clients.

---

## Expected Result

The `handleConnection` method should verify the Bearer token (from handshake auth or query params) and reject unauthorized connections.

---

## Acceptance Criteria

- [ ] WebSocket `handleConnection` verifies auth token before accepting the connection
- [ ] Unauthenticated connection attempts are rejected with an error event
- [ ] Existing dashboard WebSocket connections continue working with valid tokens

---

## Notes

File: `apps/api/src/events/ws.gateway.ts` line 46 — `handleConnection()` does no auth check. The global `AuthGuard` applies to HTTP controllers only, not WebSocket gateways.
