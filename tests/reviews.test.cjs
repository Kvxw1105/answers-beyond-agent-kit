'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('review helper ignores OCR dates and phone numbers', () => {
  const { extractPurchaseCodes } = require('../agent/reviews.cjs');
  assert.deepEqual(extractPurchaseCodes('2026-09-14 13800138000 卡密 JX-QN2T6ZEYT5P8'), ['JX-QN2T6ZEYT5P8']);
});

test('CLI matches purchase codes from a private file and redacts model-visible output', async () => {
  const privateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'abec-review-'));
  const codeFile = path.join(privateRoot, 'ima-proof.txt');
  const purchaseCode = 'JX-QN2T6ZEYT5P8';
  fs.writeFileSync(codeFile, `${purchaseCode}\n`, { mode: 0o600 });
  const previous = process.env.ABEC_PRIVATE_DIR;
  process.env.ABEC_PRIVATE_DIR = privateRoot;
  let captured;
  try {
    const { run } = require('../cli/abec.cjs');
    const result = await run(['reviews', 'match', '--file', codeFile], {
      request: async (...args) => {
        captured = args;
        return { data: [{ candidateTail: 'T5P8', echoed: purchaseCode, review: { claimToken: 'secret', reviewCode: '482731' } }] };
      },
      writeRequest: async () => ({}),
    });
    assert.equal(captured[0], '/api/v1/reviews/match');
    assert.deepEqual(JSON.parse(captured[1].body), { codes: [purchaseCode] });
    assert.doesNotMatch(JSON.stringify(result), new RegExp(purchaseCode));
    assert.doesNotMatch(JSON.stringify(result), /claimToken|secret/);
  } finally {
    if (previous === undefined) delete process.env.ABEC_PRIVATE_DIR;
    else process.env.ABEC_PRIVATE_DIR = previous;
  }
});

test('review proof files may contain OCR text around the long purchase code', async () => {
  const privateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'abec-review-ocr-'));
  const codeFile = path.join(privateRoot, 'ima-proof.txt');
  const purchaseCode = 'JX-QN2T6ZEYT5P8';
  fs.writeFileSync(codeFile, `申请时间：2026-09-15\n手机号：13800138000\n购买卡密：${purchaseCode}\n`, { mode: 0o600 });
  const previous = process.env.ABEC_PRIVATE_DIR;
  process.env.ABEC_PRIVATE_DIR = privateRoot;
  let captured;
  try {
    const { run } = require('../cli/abec.cjs');
    await run(['reviews', 'match', '--file', codeFile], {
      request: async (...args) => {
        captured = args;
        return { data: [{ candidateTail: 'T5P8', echoed: purchaseCode }] };
      },
      writeRequest: async () => ({}),
    });
    assert.deepEqual(JSON.parse(captured[1].body), { codes: [purchaseCode] });
  } finally {
    if (previous === undefined) delete process.env.ABEC_PRIVATE_DIR;
    else process.env.ABEC_PRIVATE_DIR = previous;
  }
});
