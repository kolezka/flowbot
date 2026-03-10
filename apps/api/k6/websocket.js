/**
 * k6 Load Test: WebSocket (Socket.IO)
 *
 * Tests WebSocket connection handling, room join/leave, and event
 * reception under concurrent connection load. The API uses Socket.IO
 * with namespace /events and rooms: moderation, automation, system.
 *
 * Note: k6 WebSocket support uses the raw WS protocol. Socket.IO
 * uses an HTTP upgrade path, so this test uses the Engine.IO/Socket.IO
 * handshake protocol to simulate real clients.
 *
 * Usage:
 *   k6 run k6/websocket.js
 *   k6 run k6/websocket.js -e WS_URL=ws://api.example.com -e BASE_URL=http://api.example.com
 */

import { check } from 'k6';
import ws from 'k6/ws';
import { Rate, Counter, Trend } from 'k6/metrics';
import http from 'k6/http';

const connectionErrors = new Rate('ws_connection_errors');
const messagesReceived = new Counter('ws_messages_received');
const connectionDuration = new Trend('ws_connection_duration', true);

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // ramp up connections
    { duration: '2m', target: 50 },   // hold 50 concurrent connections
    { duration: '30s', target: 0 },   // ramp down
  ],
  thresholds: {
    ws_connection_errors: ['rate<0.1'],  // less than 10% connection failures
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';

export function setup() {
  // Verify the API is reachable before starting WS tests
  const res = http.get(`${BASE_URL}/api/system/status`);
  if (res.status !== 200) {
    throw new Error(`API not reachable: ${res.status}`);
  }
  return {};
}

export default function () {
  // Socket.IO uses Engine.IO under the hood.
  // Step 1: Perform Engine.IO handshake via HTTP polling to get session ID
  const handshakeUrl = `${BASE_URL}/events/?EIO=4&transport=polling`;
  const handshakeRes = http.get(handshakeUrl);

  // Engine.IO responses are prefixed with a length, e.g., "0{"sid":"xxx",...}"
  let sid = null;
  if (handshakeRes.status === 200 && handshakeRes.body) {
    const body = String(handshakeRes.body);
    const jsonStart = body.indexOf('{');
    if (jsonStart >= 0) {
      try {
        const parsed = JSON.parse(body.substring(jsonStart));
        sid = parsed.sid;
      } catch (_) {
        // handshake parse failed
      }
    }
  }

  if (!sid) {
    // Fallback: try raw WebSocket connection without Socket.IO protocol
    const rawWsUrl = `${WS_URL}/events/?EIO=4&transport=websocket`;

    const res = ws.connect(rawWsUrl, {}, function (socket) {
      const startTime = Date.now();

      socket.on('open', () => {
        // Send Socket.IO connect packet for /events namespace
        socket.send('40/events,');
      });

      socket.on('message', (msg) => {
        messagesReceived.add(1);

        // Socket.IO connect confirmation starts with "40"
        if (typeof msg === 'string' && msg.startsWith('40')) {
          // Successfully connected, now join rooms
          // Socket.IO event: ["join", "moderation"]
          socket.send('42/events,["join","moderation"]');
          socket.send('42/events,["join","automation"]');
          socket.send('42/events,["join","system"]');
        }

        // Handle ping (Socket.IO sends "2" for ping, respond with "3" pong)
        if (msg === '2') {
          socket.send('3');
        }
      });

      socket.on('error', (e) => {
        connectionErrors.add(1);
      });

      // Keep connection alive for a period, then disconnect
      socket.setTimeout(() => {
        // Leave rooms before disconnecting
        socket.send('42/events,["leave","moderation"]');
        socket.send('42/events,["leave","automation"]');
        socket.send('42/events,["leave","system"]');

        connectionDuration.add(Date.now() - startTime);
        socket.close();
      }, 10000 + Math.random() * 5000); // 10-15s connection duration
    });

    const ok = check(res, {
      'WebSocket connection successful': (r) => r && r.status === 101,
    });
    connectionErrors.add(!ok);
    return;
  }

  // Step 2: Upgrade to WebSocket with the session ID
  const wsUrl = `${WS_URL}/events/?EIO=4&transport=websocket&sid=${sid}`;

  const res = ws.connect(wsUrl, {}, function (socket) {
    const startTime = Date.now();

    socket.on('open', () => {
      // Engine.IO upgrade probe
      socket.send('2probe');
    });

    socket.on('message', (msg) => {
      messagesReceived.add(1);

      if (msg === '3probe') {
        // Upgrade confirmed, send upgrade packet
        socket.send('5');
        // Connect to /events namespace
        socket.send('40/events,');
      }

      // Namespace connected
      if (typeof msg === 'string' && msg.startsWith('40/events')) {
        // Join all available rooms
        socket.send('42/events,["join","moderation"]');
        socket.send('42/events,["join","automation"]');
        socket.send('42/events,["join","system"]');
      }

      // Handle Engine.IO ping
      if (msg === '2') {
        socket.send('3');
      }
    });

    socket.on('error', () => {
      connectionErrors.add(1);
    });

    socket.setTimeout(() => {
      socket.send('42/events,["leave","moderation"]');
      socket.send('42/events,["leave","automation"]');
      socket.send('42/events,["leave","system"]');

      connectionDuration.add(Date.now() - startTime);
      socket.close();
    }, 10000 + Math.random() * 5000);
  });

  const ok = check(res, {
    'WebSocket upgrade successful': (r) => r && r.status === 101,
  });
  connectionErrors.add(!ok);
}
