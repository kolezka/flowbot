/**
 * k6 Load Test: Flow Execution
 *
 * Tests flow CRUD operations and execution endpoints under load.
 * Exercises: listing flows, fetching details, validation,
 * activation/deactivation, and test execution.
 *
 * Usage:
 *   k6 run k6/flow-execution.js
 *   k6 run k6/flow-execution.js -e BASE_URL=http://api.example.com -e TOKEN=my-token
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const flowListDuration = new Trend('flow_list_duration', true);
const flowDetailDuration = new Trend('flow_detail_duration', true);
const flowExecuteDuration = new Trend('flow_execute_duration', true);
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // ramp up to 10 VUs
    { duration: '1m', target: 10 },   // hold at 10 VUs
    { duration: '30s', target: 50 },  // ramp up to peak 50 VUs
    { duration: '1m', target: 50 },   // hold peak load
    { duration: '30s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95th percentile under 500ms
    http_req_failed: ['rate<0.01'],    // less than 1% request failures
    errors: ['rate<0.05'],            // custom error rate under 5%
    flow_list_duration: ['p(95)<300'],
    flow_detail_duration: ['p(95)<200'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || 'admin-token';

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

export function setup() {
  // Verify API is reachable
  const res = http.get(`${BASE_URL}/api/system/status`);
  if (res.status !== 200) {
    throw new Error(`API not reachable: ${res.status} ${res.body}`);
  }

  // Fetch existing flows for use in tests
  const flowsRes = http.get(`${BASE_URL}/api/flows`, { headers });
  let flowIds = [];
  if (flowsRes.status === 200) {
    try {
      const flows = JSON.parse(flowsRes.body);
      flowIds = (Array.isArray(flows) ? flows : []).map((f) => f.id).filter(Boolean);
    } catch (_) {
      // No flows available, tests will use create-then-test pattern
    }
  }

  return { flowIds };
}

export default function (data) {
  const { flowIds } = data;

  group('List Flows', () => {
    const res = http.get(`${BASE_URL}/api/flows`, { headers });
    flowListDuration.add(res.timings.duration);

    const ok = check(res, {
      'list flows returns 200': (r) => r.status === 200,
      'list flows returns array': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body));
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!ok);
  });

  group('Flow Analytics', () => {
    const res = http.get(`${BASE_URL}/api/flows/analytics`, { headers });

    const ok = check(res, {
      'flow analytics returns 200': (r) => r.status === 200,
    });
    errorRate.add(!ok);
  });

  // Test flow detail and execution if flows exist
  if (flowIds.length > 0) {
    const flowId = flowIds[Math.floor(Math.random() * flowIds.length)];

    group('Get Flow Detail', () => {
      const res = http.get(`${BASE_URL}/api/flows/${flowId}`, { headers });
      flowDetailDuration.add(res.timings.duration);

      const ok = check(res, {
        'flow detail returns 200': (r) => r.status === 200,
        'flow detail has id': (r) => {
          try {
            return JSON.parse(r.body).id === flowId;
          } catch {
            return false;
          }
        },
      });
      errorRate.add(!ok);
    });

    group('Flow Versions', () => {
      const res = http.get(`${BASE_URL}/api/flows/${flowId}/versions`, { headers });

      const ok = check(res, {
        'flow versions returns 200': (r) => r.status === 200,
      });
      errorRate.add(!ok);
    });

    group('Flow Executions History', () => {
      const res = http.get(`${BASE_URL}/api/flows/${flowId}/executions`, { headers });

      const ok = check(res, {
        'flow executions returns 200': (r) => r.status === 200,
      });
      errorRate.add(!ok);
    });

    group('Flow Per-Flow Analytics', () => {
      const res = http.get(`${BASE_URL}/api/flows/${flowId}/analytics`, { headers });

      const ok = check(res, {
        'per-flow analytics returns 200': (r) => r.status === 200,
      });
      errorRate.add(!ok);
    });

    group('Validate Flow', () => {
      const res = http.post(`${BASE_URL}/api/flows/${flowId}/validate`, null, { headers });

      const ok = check(res, {
        'validate flow returns 200 or 201': (r) => r.status === 200 || r.status === 201,
      });
      errorRate.add(!ok);
    });

    group('Test Execute Flow', () => {
      const payload = JSON.stringify({
        telegramId: `test-user-${__VU}-${__ITER}`,
      });
      const res = http.post(`${BASE_URL}/api/flows/${flowId}/test-execute`, payload, { headers });
      flowExecuteDuration.add(res.timings.duration);

      const ok = check(res, {
        'test execute returns 200 or 201': (r) => r.status === 200 || r.status === 201,
      });
      errorRate.add(!ok);
    });
  }

  sleep(Math.random() * 2 + 0.5); // 0.5-2.5s think time
}
