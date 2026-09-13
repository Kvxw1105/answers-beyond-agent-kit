'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('client requires ABEC_API_KEY and never includes its value in errors', async () => {
  const { createClient } = require('../lib/client.cjs');
  const client = createClient({ env: {}, fetchImpl: async () => { throw new Error('should not run'); } });
  await assert.rejects(() => client.request('/api/v1/me'), /ABEC_API_KEY/);
});

test('client sends bearer auth and request id', async () => {
  const { createClient } = require('../lib/client.cjs');
  let captured;
  const client = createClient({
    env: { ABEC_API_KEY: 'secret-value', ABEC_API_URL: 'https://example.test/' },
    randomUUID: () => 'request-123',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({ data: { ok: true } }), { status: 200, headers: { 'X-Request-ID': 'server-456' } });
    },
  });
  const result = await client.request('/api/v1/me');
  assert.equal(captured.url, 'https://example.test/api/v1/me');
  assert.equal(captured.options.headers.Authorization, 'Bearer secret-value');
  assert.equal(captured.options.headers['X-Request-ID'], 'request-123');
  assert.equal(result.requestId, 'server-456');
});

test('API errors preserve safe code and request id without leaking key', async () => {
  const { createClient } = require('../lib/client.cjs');
  const client = createClient({
    env: { ABEC_API_KEY: 'do-not-leak' },
    fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: '无权限', requestId: 'req-x' } }), { status: 403 }),
  });
  await assert.rejects(async () => {
    try { await client.request('/api/v1/products'); } catch (error) {
      assert.equal(error.code, 'FORBIDDEN');
      assert.equal(error.requestId, 'req-x');
      assert.doesNotMatch(JSON.stringify(error), /do-not-leak/);
      throw error;
    }
  }, /无权限/);
});
