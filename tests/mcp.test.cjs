'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('MCP exposes the complete member tool surface', () => {
  const { tools } = require('../mcp/server.cjs');
  assert.deepEqual(tools.map((tool) => tool.name), [
    'abec_whoami', 'abec_list_products', 'abec_get_product', 'abec_list_codes',
    'abec_create_product_preview', 'abec_update_product_preview',
    'abec_generate_codes_preview', 'abec_import_codes_preview', 'abec_confirm_operation',
  ]);
});

test('MCP generates inventory locally and returns no raw codes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'abec-mcp-'));
  let sentBody;
  const { createMcp } = require('../mcp/server.cjs');
  const mcp = createMcp({
    privateRoot: root,
    request: async () => ({ data: { ok: true } }),
    writeRequest: async (_endpoint, body) => {
      sentBody = body;
      return { confirmationToken: 'receipt', idempotencyKey: 'idem', impact: { created: 5 } };
    },
  });
  const result = await mcp.call('abec_generate_codes_preview', {
    productId: 'product-1', outputFile: path.join(root, 'batch.txt'), count: 5, length: 8,
  });
  assert.equal(sentBody.codes.length, 5);
  assert.equal(result.codeCount, 5);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(sentBody.codes[0]));
  assert.equal(result.confirmationInput.codesFile, path.join(root, 'batch.txt'));
});

test('MCP rejects raw codes in Agent input and requires private files', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'abec-mcp-safe-'));
  const { createMcp } = require('../mcp/server.cjs');
  const mcp = createMcp({ privateRoot: root, request: async () => ({}), writeRequest: async () => ({}) });
  await assert.rejects(() => mcp.call('abec_import_codes_preview', { productId: 'p1', input: { codes: ['LEAK'] } }), /codesFile/);
  await assert.rejects(() => mcp.call('abec_import_codes_preview', { productId: 'p1', codesFile: path.join(root, '..', 'outside.txt') }), /ABEC_PRIVATE_DIR/);
});

test('confirmation uses only the supplied receipt parameters', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'abec-confirm-'));
  let captured;
  const { createMcp } = require('../mcp/server.cjs');
  const mcp = createMcp({ privateRoot: root, writeRequest: async () => ({}), request: async (...args) => { captured = args; return { ok: true }; } });
  await mcp.call('abec_confirm_operation', { path: '/api/v1/products', method: 'POST', input: { name: 'A' }, confirmationToken: 'token-1', idempotencyKey: 'idem-1' });
  assert.equal(captured[0], '/api/v1/products');
  assert.equal(captured[1].headers['Idempotency-Key'], 'idem-1');
  assert.equal(JSON.parse(captured[1].body).confirmationToken, 'token-1');
});
