'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const valid = () => ({
  manifestVersion: 1,
  product: { sku: 'member guide', name: '成员指南', description: '说明', publication: 'draft' },
  sources: ['https://example.com/guide'],
  delivery: { type: 'direct_delivery', config: { resources: [{ label: '入口', url: 'https://example.com' }] }, instructions: ['打开入口'] },
  codes: { mode: 'generate', count: 10, length: 12, prefix: 'AB-' },
});

test('normalizes a complete product manifest', () => {
  const { normalizeManifest, toProductInput } = require('../agent/product-manifest.cjs');
  const normalized = normalizeManifest(valid());
  assert.equal(normalized.product.sku, 'MEMBER-GUIDE');
  assert.equal(normalized.codes.count, 10);
  assert.equal(toProductInput(valid()).deliveryType, 'direct_delivery');
});

test('rejects missing required fields and unsafe source protocols', () => {
  const { normalizeManifest } = require('../agent/product-manifest.cjs');
  const missing = valid(); delete missing.product.name;
  assert.throws(() => normalizeManifest(missing), /product.name/);
  const unsafe = valid(); unsafe.sources = ['file:///etc/passwd'];
  assert.throws(() => normalizeManifest(unsafe), /http/);
});
