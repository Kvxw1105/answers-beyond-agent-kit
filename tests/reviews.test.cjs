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

test('review match guidance tells operators to wait for buyer redemption and never reimport the proof', () => {
  const { addReviewMatchGuidance } = require('../agent/reviews.cjs');
  const result = addReviewMatchGuidance({
    data: [{
      candidateTail: 'T5P8',
      found: true,
      verdict: 'not_redeemed',
      product: { name: 'IMA 知识库年度版' },
      review: null,
    }],
  }, 'https://ent.example');

  assert.deepEqual(result.data[0].nextStep, {
    action: 'buyer_redeem',
    redeemUrl: 'https://ent.example/redeem',
    retry: 'match_after_redeem',
    message: '卡密已找到，但买家尚未在答案之外完成权益认领，所以还没有可锁定的审核记录。请让买家打开领取页，输入原购买卡密完成认领；完成后重新匹配。不要重新导入该卡密，也不要让 Agent 代替买家认领。',
  });
  assert.equal(result.data[0].operatorMessage, result.data[0].nextStep.message);
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

test('CLI review action accepts an external review id and keeps the legacy review code form', async () => {
  const { run } = require('../cli/abec.cjs');
  const privateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'abec-review-action-'));
  const captured = [];
  const writeRequest = async (endpoint, body, options) => {
    captured.push({ endpoint, options });
    return { confirmationToken: 'token-only-in-test', idempotencyKey: 'key-only-in-test' };
  };

  const externalReceipt = path.join(privateRoot, 'external.receipt.json');
  const external = await run(['reviews', 'action', '--review-id', 'case-123', 'lock', '--receipt', externalReceipt], {
    request: async () => ({}),
    writeRequest,
  });
  assert.equal(captured[0].endpoint, '/api/v1/reviews/cases/case-123/lock');
  assert.equal(captured[0].options.preview, true);
  assert.equal(external.preview, true);

  const legacyReceipt = path.join(privateRoot, 'legacy.receipt.json');
  await run(['reviews', 'action', '482731', 'lock', '--receipt', legacyReceipt], {
    request: async () => ({}),
    writeRequest,
  });
  assert.equal(captured[1].endpoint, '/api/v1/reviews/482731/lock');

  await assert.rejects(
    () => run(['reviews', 'action', '--review-id', 'case-123', '--receipt', path.join(privateRoot, 'missing.receipt.json')], {
      request: async () => ({}),
      writeRequest,
    }),
    /用法：abec reviews action/,
  );
});
