import assert from 'node:assert';
import crypto from 'node:crypto';
import { spawn, ChildProcess } from 'node:child_process';

class IsolatedClient {
  private cookies = new Map<string, string>();
  public csrfToken: string | null = null;

  private storeCookies(res: Response) {
    const hdrs = res.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = typeof hdrs.getSetCookie === 'function' ? hdrs.getSetCookie() : [];
    const fallback = res.headers.get('set-cookie');
    const all = setCookies.length > 0 ? setCookies : fallback ? [fallback] : [];
    for (const raw of all) {
      const [nv] = raw.split(';');
      const idx = nv.indexOf('=');
      if (idx > 0) {
        const name = nv.slice(0, idx).trim();
        const val = nv.slice(idx + 1).trim();
        if (!val || /Max-Age=0/i.test(raw)) this.cookies.delete(name);
        else this.cookies.set(name, val);
      }
    }
  }

  async req<T = Record<string, unknown>>(
    baseUrl: string,
    method: string,
    urlPath: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<{ status: number; data: T; rawText: string }> {
    const headers: Record<string, string> = { ...(extraHeaders || {}) };
    const cookieStr = Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    if (cookieStr) headers['cookie'] = cookieStr;
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && this.csrfToken) {
      headers['x-csrf-token'] = this.csrfToken;
    }

    const res = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    this.storeCookies(res);
    const rawText = await res.text();
    let data = {} as T & { csrfToken?: string };
    try {
      data = rawText ? (JSON.parse(rawText) as T & { csrfToken?: string }) : ({} as T & { csrfToken?: string });
    } catch {
      data = {} as T & { csrfToken?: string };
    }
    if (data && typeof data === 'object' && typeof data.csrfToken === 'string') {
      this.csrfToken = data.csrfToken;
    }
    return { status: res.status, data, rawText };
  }
}

async function waitForReady(baseUrl: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${baseUrl}/api/auth/admin-bootstrap/status`);
      if (r.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Isolated test server at ${baseUrl} did not become ready`);
}

function stopChild(proc: ChildProcess) {
  try {
    if (proc.pid) process.kill(-proc.pid, 'SIGTERM');
  } catch {
    try {
      proc.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
}

async function testUnsetAdminPinFailClosed() {
  const port = 3197;
  const baseUrl = `http://127.0.0.1:${port}`;
  const runtimeSetupSecret = crypto.randomBytes(24).toString('hex');
  let logs = '';

  const proc = spawn('npx', ['tsx', 'server.ts'], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'development',
      SKIP_VITE: '1',
      SQL_HOST: '',
      SQL_DB_NAME: '',
      SQL_USER: '',
      SQL_PASSWORD: '',
      DATABASE_URL: '',
      REQUIRE_POSTGRES: '',
      ADMIN_PIN: '',
      NONOLAND_ADMIN_SETUP_SECRET: runtimeSetupSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout?.on('data', (d) => (logs += String(d)));
  proc.stderr?.on('data', (d) => (logs += String(d)));

  try {
    await waitForReady(baseUrl);
    const anon = new IsolatedClient();

    // 1. Default PIN '2026' MUST be rejected (401 Fail-Closed) on all ADMIN_PIN-protected routes
    const pinHeaders = { 'x-admin-pin': '2026' };
    const protectedEndpoints: Array<[string, string, unknown?]> = [
      ['GET', '/api/admin/diagnostics'],
      ['GET', '/api/admin/overview'],
      ['GET', '/api/admin/overview-stats'],
      ['GET', '/api/admin/security-logs'],
      ['GET', '/api/admin/parents'],
      ['POST', '/api/admin/lessons', { title: 'Test' }],
    ];

    for (const [method, urlPath, body] of protectedEndpoints) {
      const r = await anon.req(baseUrl, method, urlPath, body, pinHeaders);
      assert.strictEqual(
        r.status,
        401,
        `${method} ${urlPath} with '2026' when ADMIN_PIN is unset MUST return 401, got ${r.status}`,
      );
      assert.ok(!r.rawText.includes('2026'), `Response for ${urlPath} must not echo PIN`);
      assert.ok(!r.rawText.includes(runtimeSetupSecret), `Response for ${urlPath} must not leak setup secret`);
    }

    // 2. Valid Admin session in isolated in-memory store MUST still work cleanly (200 OK)
    const adminClient = new IsolatedClient();
    const email = `adm.test.${crypto.randomBytes(4).toString('hex')}@example.com`;
    const pw = `Adm1n!${crypto.randomBytes(8).toString('hex')}9Z`;
    const boot = await adminClient.req(baseUrl, 'POST', '/api/auth/admin-bootstrap', {
      setupSecret: runtimeSetupSecret,
      displayName: 'Isolated Admin',
      email,
      password: pw,
      confirmPassword: pw,
    });
    assert.strictEqual(boot.status, 201, `Isolated admin bootstrap failed: ${boot.rawText}`);

    for (const urlPath of [
      '/api/admin/diagnostics',
      '/api/admin/overview',
      '/api/admin/overview-stats',
      '/api/admin/security-logs',
      '/api/admin/parents',
    ]) {
      const okRes = await adminClient.req(baseUrl, 'GET', urlPath);
      assert.strictEqual(okRes.status, 200, `Authenticated admin GET ${urlPath} expected 200, got ${okRes.status}`);
    }

    assert.ok(!logs.includes(runtimeSetupSecret), 'Server logs must never expose setup secret');
    console.log('PASS [A]: Unset ADMIN_PIN rejects "2026" (401 Fail-Closed) while authenticated Admin session returns 200.');
  } finally {
    stopChild(proc);
  }
}

async function testExplicitAdminPinRejects2026() {
  const port = 3196;
  const baseUrl = `http://127.0.0.1:${port}`;
  const explicitPin = `pin_${crypto.randomBytes(12).toString('hex')}`;
  let logs = '';

  const proc = spawn('npx', ['tsx', 'server.ts'], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'development',
      SKIP_VITE: '1',
      SQL_HOST: '',
      SQL_DB_NAME: '',
      SQL_USER: '',
      SQL_PASSWORD: '',
      DATABASE_URL: '',
      REQUIRE_POSTGRES: '',
      ADMIN_PIN: explicitPin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout?.on('data', (d) => (logs += String(d)));
  proc.stderr?.on('data', (d) => (logs += String(d)));

  try {
    await waitForReady(baseUrl);
    const anon = new IsolatedClient();

    // Even when ADMIN_PIN is configured, '2026' is rejected (401)
    const badDiag = await anon.req(baseUrl, 'GET', '/api/admin/diagnostics', undefined, { 'x-admin-pin': '2026' });
    assert.strictEqual(badDiag.status, 401);
    const badStats = await anon.req(baseUrl, 'GET', '/api/admin/overview-stats', undefined, { 'x-admin-pin': '2026' });
    assert.strictEqual(badStats.status, 401);
    const badOverview = await anon.req(baseUrl, 'GET', '/api/admin/overview', undefined, { 'x-admin-pin': '2026' });
    assert.strictEqual(badOverview.status, 401);

    // Explicit configured ADMIN_PIN works without leaking into logs or responses
    const okStats = await anon.req(baseUrl, 'GET', '/api/admin/overview-stats', undefined, {
      'x-admin-pin': explicitPin,
    });
    assert.strictEqual(okStats.status, 200);
    assert.ok(!okStats.rawText.includes(explicitPin), 'Response must never expose ADMIN_PIN');
    assert.ok(!logs.includes(explicitPin), 'Server logs must never expose ADMIN_PIN');
    console.log('PASS [B]: Explicit ADMIN_PIN still works without fallback to "2026" and without leaking PIN.');
  } finally {
    stopChild(proc);
  }
}

(async () => {
  await testUnsetAdminPinFailClosed();
  await testExplicitAdminPinRejects2026();
})();
