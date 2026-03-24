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

    // Clean up test webhooks
    const webhooksRes = await apiGet<any>(token, '/api/webhooks');
    const webhooks = Array.isArray(webhooksRes) ? webhooksRes : (webhooksRes?.data ?? []);
    for (const wh of webhooks) {
      if (wh.name?.includes('E2E Webhook') || wh.name?.includes('Lifecycle WH') || wh.name?.includes('Smoke WH')) {
        await apiDelete(token, `/api/webhooks/${wh.id}`);
      }
    }


    console.log('[teardown] Cleaned up test data');
  } catch (e) {
    console.warn('[teardown] Cleanup failed (non-critical):', (e as Error).message);
  }
}

export default globalTeardown;
