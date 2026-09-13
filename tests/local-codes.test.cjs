'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('generates unique codes without ambiguous characters', () => {
  const { generateCodes } = require('../agent/local-codes.cjs');
  const values = generateCodes({ count: 20, length: 10, prefix: 'X-' });
  assert.equal(new Set(values).size, 20);
  assert.ok(values.every((value) => /^X-[A-HJ-NP-Z2-9]{10}$/.test(value)));
});

test('private file resolver blocks paths outside ABEC_PRIVATE_DIR', () => {
  const { createPrivateFiles } = require('../agent/local-codes.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'abec-private-'));
  const files = createPrivateFiles(root);
  assert.throws(() => files.resolve(path.join(root, '..', 'leak.txt')), /ABEC_PRIVATE_DIR/);
  assert.equal(files.resolve(path.join(root, 'batch', 'codes.txt')), path.join(root, 'batch', 'codes.txt'));
});
