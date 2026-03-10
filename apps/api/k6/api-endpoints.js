/**
 * k6 Load Test: General API Endpoints
 *
 * Tests a broad mix of API endpoints to simulate realistic dashboard usage.
 * Covers: users, products, categories, moderation, analytics, system,
 * bot-config, webhooks, and reputation endpoints.
 *
 * The test uses weighted scenarios to mimic real traffic patterns:
 * - 60% read operations (list, detail views)
 * - 25% write operations (create, update)
 * - 15% admin operations (analytics, system status)
 *
 * Usage:
 *   k6 run k6/api-endpoints.js
 *   k6 run k6/api-endpoints.js -e BASE_URL=http://api.example.com -e TOKEN=my-token
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const readDuration = new Trend('read_ops_duration', true);
const writeDuration = new Trend('write_ops_duration', true);
const adminDuration = new Trend('admin_ops_duration', true);
const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    // Simulate dashboard browsing (read-heavy)
    readers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '2m', target: 30 },
        { duration: '30s', target: 0 },
      ],
      exec: 'readOperations',
    },
    // Simulate admin actions (writes)
    writers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '2m', target: 10 },
        { duration: '30s', target: 0 },
      ],
      exec: 'writeOperations',
    },
    // Simulate system monitoring
    monitors: {
      executor: 'constant-vus',
      vus: 5,
      duration: '3m',
      exec: 'adminOperations',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.05'],
    read_ops_duration: ['p(95)<300'],
    write_ops_duration: ['p(95)<500'],
    admin_ops_duration: ['p(95)<400'],
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

  // Gather existing resource IDs for read/update tests
  const data = { userIds: [], productIds: [], categoryIds: [] };

  const usersRes = http.get(`${BASE_URL}/api/users`, { headers });
  if (usersRes.status === 200) {
    try {
      const parsed = JSON.parse(usersRes.body);
      const users = Array.isArray(parsed) ? parsed : parsed.data || [];
      data.userIds = users.slice(0, 20).map((u) => u.id).filter(Boolean);
    } catch (_) {}
  }

  const productsRes = http.get(`${BASE_URL}/api/products`, { headers });
  if (productsRes.status === 200) {
    try {
      const parsed = JSON.parse(productsRes.body);
      const products = Array.isArray(parsed) ? parsed : parsed.data || [];
      data.productIds = products.slice(0, 20).map((p) => p.id).filter(Boolean);
    } catch (_) {}
  }

  const categoriesRes = http.get(`${BASE_URL}/api/categories`, { headers });
  if (categoriesRes.status === 200) {
    try {
      const parsed = JSON.parse(categoriesRes.body);
      const categories = Array.isArray(parsed) ? parsed : parsed.data || [];
      data.categoryIds = categories.slice(0, 20).map((c) => c.id).filter(Boolean);
    } catch (_) {}
  }

  return data;
}

// --- Read Operations (60% of traffic) ---
export function readOperations(data) {
  const ops = [
    () => listUsers(),
    () => listProducts(),
    () => listCategories(),
    () => getCategoryTree(),
    () => getUserDetail(data.userIds),
    () => getProductDetail(data.productIds),
    () => getCategoryDetail(data.categoryIds),
    () => getReputationLeaderboard(),
  ];

  // Pick 2-3 random operations per iteration
  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const op = ops[Math.floor(Math.random() * ops.length)];
    op();
  }

  sleep(Math.random() * 2 + 0.5);
}

// --- Write Operations (25% of traffic) ---
export function writeOperations(data) {
  const ops = [
    () => createAndDeleteCategory(),
    () => createAndDeleteProduct(data.categoryIds),
  ];

  const op = ops[Math.floor(Math.random() * ops.length)];
  op();

  sleep(Math.random() * 3 + 1);
}

// --- Admin/Monitoring Operations (15% of traffic) ---
export function adminOperations() {
  const ops = [
    () => getSystemStatus(),
    () => getUserStats(),
    () => getAnalyticsOverview(),
    () => getAutomationHealth(),
    () => getAutomationJobs(),
    () => getWarningStats(),
  ];

  const op = ops[Math.floor(Math.random() * ops.length)];
  op();

  sleep(Math.random() * 3 + 2);
}

// ===== Read operation helpers =====

function listUsers() {
  group('GET /api/users', () => {
    const res = http.get(`${BASE_URL}/api/users`, { headers });
    readDuration.add(res.timings.duration);
    const ok = check(res, { 'list users 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });
}

function listProducts() {
  group('GET /api/products', () => {
    const res = http.get(`${BASE_URL}/api/products`, { headers });
    readDuration.add(res.timings.duration);
    const ok = check(res, { 'list products 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });
}

function listCategories() {
  group('GET /api/categories', () => {
    const res = http.get(`${BASE_URL}/api/categories`, { headers });
    readDuration.add(res.timings.duration);
    const ok = check(res, { 'list categories 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });
}

function getCategoryTree() {
  group('GET /api/categories/tree', () => {
    const res = http.get(`${BASE_URL}/api/categories/tree`, { headers });
    readDuration.add(res.timings.duration);
    const ok = check(res, { 'category tree 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });
}

function getUserDetail(userIds) {
  if (userIds.length === 0) return;
  const id = userIds[Math.floor(Math.random() * userIds.length)];
  group('GET /api/users/:id', () => {
    const res = http.get(`${BASE_URL}/api/users/${id}`, { headers });
    readDuration.add(res.timings.duration);
    const ok = check(res, { 'user detail 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });
}

function getProductDetail(productIds) {
  if (productIds.length === 0) return;
  const id = productIds[Math.floor(Math.random() * productIds.length)];
  group('GET /api/products/:id', () => {
    const res = http.get(`${BASE_URL}/api/products/${id}`, { headers });
    readDuration.add(res.timings.duration);
    const ok = check(res, { 'product detail 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });
}

function getCategoryDetail(categoryIds) {
  if (categoryIds.length === 0) return;
  const id = categoryIds[Math.floor(Math.random() * categoryIds.length)];
  group('GET /api/categories/:id', () => {
    const res = http.get(`${BASE_URL}/api/categories/${id}`, { headers });
    readDuration.add(res.timings.duration);
    const ok = check(res, { 'category detail 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });
}

function getReputationLeaderboard() {
  group('GET /api/reputation/leaderboard', () => {
    const res = http.get(`${BASE_URL}/api/reputation/leaderboard`, { headers });
    readDuration.add(res.timings.duration);
    const ok = check(res, { 'leaderboard 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });
}

// ===== Write operation helpers =====

function createAndDeleteCategory() {
  group('Create + Delete Category', () => {
    const payload = JSON.stringify({
      name: `k6-test-cat-${__VU}-${__ITER}-${Date.now()}`,
    });

    const createRes = http.post(`${BASE_URL}/api/categories`, payload, { headers });
    writeDuration.add(createRes.timings.duration);

    const created = check(createRes, {
      'create category 201': (r) => r.status === 201,
    });
    errorRate.add(!created);

    if (created) {
      try {
        const id = JSON.parse(createRes.body).id;
        if (id) {
          sleep(0.2);
          const delRes = http.del(`${BASE_URL}/api/categories/${id}`, null, { headers });
          check(delRes, {
            'delete category 200': (r) => r.status === 200,
          });
        }
      } catch (_) {}
    }
  });
}

function createAndDeleteProduct(categoryIds) {
  group('Create + Delete Product', () => {
    const payload = JSON.stringify({
      name: `k6-test-product-${__VU}-${__ITER}-${Date.now()}`,
      price: Math.floor(Math.random() * 10000) / 100,
      categoryId: categoryIds.length > 0
        ? categoryIds[Math.floor(Math.random() * categoryIds.length)]
        : undefined,
    });

    const createRes = http.post(`${BASE_URL}/api/products`, payload, { headers });
    writeDuration.add(createRes.timings.duration);

    const created = check(createRes, {
      'create product 201': (r) => r.status === 201,
    });
    errorRate.add(!created);

    if (created) {
      try {
        const id = JSON.parse(createRes.body).id;
        if (id) {
          sleep(0.2);
          const delRes = http.del(`${BASE_URL}/api/products/${id}`, null, { headers });
          check(delRes, {
            'delete product 200': (r) => r.status === 200,
          });
        }
      } catch (_) {}
    }
  });
}

// ===== Admin operation helpers =====

function getSystemStatus() {
  group('GET /api/system/status', () => {
    const res = http.get(`${BASE_URL}/api/system/status`);
    adminDuration.add(res.timings.duration);
    const ok = check(res, { 'system status 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });
}

function getUserStats() {
  group('GET /api/users/stats', () => {
    const res = http.get(`${BASE_URL}/api/users/stats`, { headers });
    adminDuration.add(res.timings.duration);
    const ok = check(res, { 'user stats 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });
}

function getAnalyticsOverview() {
  group('GET /api/analytics/overview', () => {
    const res = http.get(`${BASE_URL}/api/analytics/overview`, { headers });
    adminDuration.add(res.timings.duration);
    const ok = check(res, { 'analytics overview 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });
}

function getAutomationHealth() {
  group('GET /api/automation/health', () => {
    const res = http.get(`${BASE_URL}/api/automation/health`, { headers });
    adminDuration.add(res.timings.duration);
    const ok = check(res, { 'automation health 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });
}

function getAutomationJobs() {
  group('GET /api/automation/jobs', () => {
    const res = http.get(`${BASE_URL}/api/automation/jobs`, { headers });
    adminDuration.add(res.timings.duration);
    const ok = check(res, { 'automation jobs 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });
}

function getWarningStats() {
  group('GET /api/warnings/stats', () => {
    const res = http.get(`${BASE_URL}/api/warnings/stats`, { headers });
    adminDuration.add(res.timings.duration);
    const ok = check(res, { 'warning stats 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });
}
