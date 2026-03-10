/**
 * k6 Load Test: Broadcast
 *
 * Tests broadcast message creation and status polling under load.
 * Simulates the dashboard workflow: create broadcast, poll status,
 * list all broadcasts.
 *
 * Usage:
 *   k6 run k6/broadcast.js
 *   k6 run k6/broadcast.js -e BASE_URL=http://api.example.com -e TOKEN=my-token
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const broadcastCreateDuration = new Trend('broadcast_create_duration', true);
const broadcastPollDuration = new Trend('broadcast_poll_duration', true);
const broadcastListDuration = new Trend('broadcast_list_duration', true);
const errorRate = new Rate('errors');
const broadcastsCreated = new Counter('broadcasts_created');

export const options = {
  stages: [
    { duration: '30s', target: 5 },   // ramp up slowly (broadcasts are heavy)
    { duration: '1m', target: 10 },   // hold moderate load
    { duration: '30s', target: 20 },  // ramp to peak
    { duration: '1m', target: 20 },   // hold peak
    { duration: '30s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // broadcasts can be slower
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.1'],
    broadcast_list_duration: ['p(95)<500'],
    broadcast_create_duration: ['p(95)<1000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || 'admin-token';

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

export function setup() {
  const res = http.get(`${BASE_URL}/api/system/status`);
  if (res.status !== 200) {
    throw new Error(`API not reachable: ${res.status}`);
  }
  return {};
}

export default function () {
  // Scenario 1: List all broadcasts (read-heavy operation)
  group('List Broadcasts', () => {
    const res = http.get(`${BASE_URL}/api/broadcast`, { headers });
    broadcastListDuration.add(res.timings.duration);

    const ok = check(res, {
      'list broadcasts returns 200': (r) => r.status === 200,
    });
    errorRate.add(!ok);
  });

  // Scenario 2: Create a broadcast message (write operation)
  let broadcastId = null;

  group('Create Broadcast', () => {
    const payload = JSON.stringify({
      message: `Load test broadcast ${__VU}-${__ITER} at ${new Date().toISOString()}`,
      targetType: 'all',
    });

    const res = http.post(`${BASE_URL}/api/broadcast`, payload, { headers });
    broadcastCreateDuration.add(res.timings.duration);

    const ok = check(res, {
      'create broadcast returns 201': (r) => r.status === 201,
      'create broadcast returns id': (r) => {
        try {
          const body = JSON.parse(r.body);
          broadcastId = body.id;
          return !!body.id;
        } catch {
          return false;
        }
      },
    });

    if (ok) {
      broadcastsCreated.add(1);
    }
    errorRate.add(!ok);
  });

  // Scenario 3: Poll broadcast status (simulates dashboard polling)
  if (broadcastId) {
    group('Poll Broadcast Status', () => {
      // Simulate polling 3 times with short intervals
      for (let i = 0; i < 3; i++) {
        const res = http.get(`${BASE_URL}/api/broadcast/${broadcastId}`, { headers });
        broadcastPollDuration.add(res.timings.duration);

        const ok = check(res, {
          'poll broadcast returns 200': (r) => r.status === 200,
          'poll broadcast has status': (r) => {
            try {
              const body = JSON.parse(r.body);
              return body.status !== undefined;
            } catch {
              return false;
            }
          },
        });
        errorRate.add(!ok);

        sleep(0.5); // 500ms polling interval
      }
    });

    // Scenario 4: Delete the test broadcast to clean up
    group('Cleanup Broadcast', () => {
      const res = http.del(`${BASE_URL}/api/broadcast/${broadcastId}`, null, { headers });

      check(res, {
        'delete broadcast returns 200': (r) => r.status === 200,
      });
    });
  }

  sleep(Math.random() * 2 + 1); // 1-3s think time
}
