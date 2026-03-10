import { test as base, expect } from '@playwright/test';

const API_URL = 'http://localhost:3000';

interface ApiHelper {
  token: string;
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body: unknown) => Promise<T>;
  delete: (path: string) => Promise<void>;
}

export const test = base.extend<{ api: ApiHelper }>({
  api: async ({}, use) => {
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin' }),
    });
    const { token } = await loginRes.json();

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const helper: ApiHelper = {
      token,
      get: async <T>(path: string) => {
        const res = await fetch(`${API_URL}${path}`, { headers });
        return res.json() as T;
      },
      post: async <T>(path: string, body: unknown) => {
        const res = await fetch(`${API_URL}${path}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        return res.json() as T;
      },
      delete: async (path: string) => {
        await fetch(`${API_URL}${path}`, { method: 'DELETE', headers });
      },
    };

    await use(helper);
  },
});

export { expect };
