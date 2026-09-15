#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { request, writeRequest } = require('../lib/client.cjs');
const { toProductInput } = require('../agent/product-manifest.cjs');
const { createPrivateFiles, generateCodes } = require('../agent/local-codes.cjs');
const { normalizePurchaseCodes, reviewActionPath, sanitizeReviewPayload } = require('../agent/reviews.cjs');

function parser(argv) {
  return {
    argv,
    has: (name) => argv.includes(name),
    value: (name) => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : undefined; },
  };
}
function readJson(file, label) {
  if (!file) throw new Error(`缺少 ${label} 文件。`);
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}
async function run(argv = process.argv.slice(2), dependencies = { request, writeRequest }) {
  const args = parser(argv);
  const [command, resource, id] = argv;
  if (command === 'whoami') return dependencies.request('/api/v1/me');
  if (command === 'products' && resource === 'list') return dependencies.request('/api/v1/products');
  if (command === 'products' && resource === 'get' && id) return dependencies.request(`/api/v1/products/${encodeURIComponent(id)}`);
  if (command === 'codes' && resource === 'list') return dependencies.request(`/api/v1/codes${args.value('--product') ? `?productId=${encodeURIComponent(args.value('--product'))}` : ''}`);
  if (command === 'reviews' && resource === 'list') {
    const limit = Math.min(100, Math.max(1, Number(args.value('--limit') || 40)));
    return sanitizeReviewPayload(await dependencies.request(`/api/v1/reviews?limit=${limit}`));
  }
  if (command === 'reviews' && resource === 'match') {
    const privateRoot = process.env.ABEC_PRIVATE_DIR || path.join(require('node:os').homedir(), '.answers-beyond', 'private');
    const files = createPrivateFiles(privateRoot);
    const codes = normalizePurchaseCodes(files.read(args.value('--file')));
    const result = await dependencies.request('/api/v1/reviews/match', {
      method: 'POST',
      body: JSON.stringify({ codes }),
    });
    return sanitizeReviewPayload(result, codes);
  }

  let endpoint;
  let method = 'POST';
  let input;
  if (command === 'products' && resource === 'create') {
    endpoint = '/api/v1/products';
    input = args.value('--manifest') ? toProductInput(readJson(args.value('--manifest'), '--manifest')) : readJson(args.value('--file'), '--file');
  } else if (command === 'products' && resource === 'update' && id) {
    endpoint = `/api/v1/products/${encodeURIComponent(id)}`;
    method = 'PATCH';
    input = readJson(args.value('--file'), '--file');
  } else if (command === 'codes' && ['generate', 'import'].includes(resource)) {
    endpoint = '/api/v1/codes/import';
    const privateRoot = process.env.ABEC_PRIVATE_DIR || path.join(require('node:os').homedir(), '.answers-beyond', 'private');
    const files = createPrivateFiles(privateRoot);
    const file = files.resolve(args.value(resource === 'generate' ? '--out' : '--file'));
    let codes;
    if (resource === 'generate' && !fs.existsSync(file)) {
      codes = generateCodes({ count: Number(args.value('--count') || 10), length: Number(args.value('--length') || 12), prefix: args.value('--prefix') || '' });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${codes.join('\n')}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    } else codes = files.read(file);
    input = { productId: args.value('--product'), codes, ...(args.value('--batch-name') ? { batchName: args.value('--batch-name') } : {}) };
  } else if (command === 'reviews' && resource === 'action' && id && argv[3]) {
    endpoint = reviewActionPath(id, argv[3]);
    input = {};
  } else {
    throw new Error('用法：abec whoami | products list|get ID|create|update | codes list|generate|import | reviews list|match --file FILE|action REVIEW_CODE ACTION；写操作需 --receipt FILE，确认时再加 --confirm。');
  }

  const receiptFile = args.value('--receipt');
  if (!receiptFile) throw new Error('写操作必须指定 --receipt FILE；先预览，再显式确认。');
  const receiptPath = path.resolve(receiptFile);
  if (!args.has('--confirm')) {
    if (fs.existsSync(receiptPath)) throw new Error(`receipt 已存在，不覆盖：${receiptPath}`);
    const preview = await dependencies.writeRequest(endpoint, input, { preview: true, method });
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, `${JSON.stringify({ version: 1, path: endpoint, method, confirmationToken: preview.confirmationToken, idempotencyKey: preview.idempotencyKey }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    return { preview: true, ...preview, receipt: receiptPath };
  }
  const receipt = readJson(receiptPath, '--receipt');
  if (receipt.version !== 1 || receipt.path !== endpoint || receipt.method !== method || !receipt.confirmationToken || !receipt.idempotencyKey) throw new Error('receipt 无效、过期或与当前操作不匹配。');
  const result = await dependencies.writeRequest(endpoint, { ...input, confirmationToken: receipt.confirmationToken }, { method, idempotencyKey: receipt.idempotencyKey });
  return command === 'reviews' ? sanitizeReviewPayload(result) : result;
}

if (require.main === module) {
  run().then((data) => console.log(JSON.stringify(data, null, 2))).catch((error) => {
    console.error(JSON.stringify({ error: error.message, code: error.code, requestId: error.requestId }, null, 2));
    process.exitCode = 1;
  });
}

module.exports = { run };
