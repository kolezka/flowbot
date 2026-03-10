import type { FullConfig } from '@playwright/test';

const API_URL = 'http://localhost:3000';

async function getToken(): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin' }),
  });
  const { token } = await res.json();
  return token;
}

async function apiDelete(token: string, path: string): Promise<void> {
  await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

async function apiGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function globalTeardown(_config: FullConfig) {
  try {
    const token = await getToken();

    // Clean up test flows
    const flows = await apiGet<{ data: { id: string; name: string }[] }>(token, '/api/flows?limit=100');
    for (const flow of flows.data ?? []) {
      if (flow.name === 'New Flow' || flow.name === 'Test Flow' || flow.name.startsWith('E2E ') || flow.name?.startsWith('Smoke Flow ')) {
        await apiDelete(token, `/api/flows/${flow.id}`);
      }
    }

    // Clean up test broadcasts (E2E test messages)
    const broadcasts = await apiGet<{ data: { id: string; text: string }[] }>(token, '/api/broadcast?limit=100');
    for (const b of broadcasts.data ?? []) {
      if (b.text?.includes('E2E test') || b.text?.includes('E2E smoke test')) {
        await apiDelete(token, `/api/broadcast/${b.id}`);
      }
    }

    // Clean up test webhooks
    const webhooksRes = await apiGet<any>(token, '/api/webhooks');
    const webhooks = Array.isArray(webhooksRes) ? webhooksRes : (webhooksRes?.data ?? []);
    for (const wh of webhooks) {
      if (wh.name?.includes('E2E Webhook') || wh.name?.includes('Lifecycle WH') || wh.name?.includes('Smoke WH')) {
        await apiDelete(token, `/api/webhooks/${wh.id}`);
      }
    }

    // Clean up test products
    const productsRes = await apiGet<any>(token, '/api/products?limit=100');
    const products = Array.isArray(productsRes) ? productsRes : (productsRes?.data ?? []);
    for (const p of products) {
      if (p.name?.includes('Test Product') || p.name?.includes('CRUD Product') || p.name?.includes('Smoke Product')) {
        await apiDelete(token, `/api/products/${p.id}`);
      }
    }

    // Clean up test categories
    const categoriesRes = await apiGet<any>(token, '/api/categories');
    const categories = Array.isArray(categoriesRes) ? categoriesRes : (categoriesRes?.data ?? []);
    for (const c of categories) {
      if (c.name?.includes('Test Cat') || c.name?.includes('Test Category') || c.name?.includes('CRUD Cat') || c.name?.includes('ProdTest Cat') || c.name?.includes('Smoke Cat')) {
        await apiDelete(token, `/api/categories/${c.id}`);
      }
    }

    console.log('[teardown] Cleaned up test data');
  } catch (e) {
    console.warn('[teardown] Cleanup failed (non-critical):', (e as Error).message);
  }
}

export default globalTeardown;
