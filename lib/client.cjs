'use strict';

const crypto = require('node:crypto');

const DEFAULT_API_URL = 'https://ent.xince.work';

function createClient({ env = process.env, fetchImpl = globalThis.fetch, randomUUID = crypto.randomUUID } = {}) {
  function config() {
    const key = env.ABEC_API_KEY;
    if (!key) throw new Error('请设置 ABEC_API_KEY；不要把 Key 写入项目文件、提示词或 MCP 配置。');
    return { key, base: (env.ABEC_API_URL || DEFAULT_API_URL).replace(/\/$/, '') };
  }

  async function request(apiPath, options = {}) {
    const { key, base } = config();
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${key}`,
      'X-Request-ID': randomUUID(),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    };
    const response = await fetchImpl(`${base}${apiPath}`, { ...options, headers });
    const headerRequestId = response.headers.get('X-Request-ID');
    let body;
    try {
      body = await response.json();
    } catch {
      body = { error: { code: 'INVALID_RESPONSE', message: '服务返回了无效 JSON。' } };
    }
    if (!response.ok) {
      const payload = body?.error || body || {};
      const error = new Error(payload.message || `请求失败：HTTP ${response.status}`);
      error.code = payload.code || `HTTP_${response.status}`;
      error.requestId = payload.requestId || headerRequestId || undefined;
      throw error;
    }
    return { ...body, requestId: body?.requestId || headerRequestId || undefined };
  }

  function writeRequest(apiPath, body, { preview = false, idempotencyKey = randomUUID(), method = 'POST' } = {}) {
    return request(apiPath, {
      method,
      body: JSON.stringify(body),
      headers: {
        'Idempotency-Key': idempotencyKey,
        ...(preview ? { 'X-Preview': 'true' } : {}),
      },
    });
  }

  return { config, request, writeRequest };
}

const defaultClient = createClient();

module.exports = {
  DEFAULT_API_URL,
  createClient,
  getConfig: defaultClient.config,
  request: defaultClient.request,
  writeRequest: defaultClient.writeRequest,
};
