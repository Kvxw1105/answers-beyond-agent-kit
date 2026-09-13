#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const client = require('../lib/client.cjs');
const { createPrivateFiles, generateCodes } = require('../agent/local-codes.cjs');

const tools = [
  { name: 'abec_whoami', description: '读取当前 Answers Beyond API Key 的成员身份、角色与 scopes。', inputSchema: { type: 'object', properties: {} } },
  { name: 'abec_list_products', description: '读取当前成员有权查看的商品。', inputSchema: { type: 'object', properties: {} } },
  { name: 'abec_get_product', description: '读取当前成员有权查看的指定商品。', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'abec_list_codes', description: '读取当前成员有权查看的脱敏卡密列表。', inputSchema: { type: 'object', properties: { productId: { type: 'string' } } } },
  { name: 'abec_create_product_preview', description: '预览创建商品，不写入。', inputSchema: { type: 'object', properties: { input: { type: 'object' } }, required: ['input'] } },
  { name: 'abec_update_product_preview', description: '预览更新商品，不写入。', inputSchema: { type: 'object', properties: { id: { type: 'string' }, input: { type: 'object' } }, required: ['id', 'input'] } },
  { name: 'abec_generate_codes_preview', description: '在 ABEC_PRIVATE_DIR 内生成卡密文件并预览导入；只返回路径和数量。', inputSchema: { type: 'object', properties: { productId: { type: 'string' }, outputFile: { type: 'string' }, count: { type: 'integer', minimum: 1, maximum: 1000 }, length: { type: 'integer', minimum: 8, maximum: 32 }, prefix: { type: 'string' }, batchName: { type: 'string' }, excludeAmbiguous: { type: 'boolean' } }, required: ['productId', 'outputFile'] } },
  { name: 'abec_import_codes_preview', description: '从 ABEC_PRIVATE_DIR 内的文件预览导入卡密；只返回路径和数量。', inputSchema: { type: 'object', properties: { productId: { type: 'string' }, codesFile: { type: 'string' }, batchName: { type: 'string' } }, required: ['productId', 'codesFile'] } },
  { name: 'abec_confirm_operation', description: '显式确认后，执行服务端最新预览返回的精确 receipt；不得自造 token。', inputSchema: { type: 'object', properties: { path: { type: 'string' }, method: { type: 'string', enum: ['POST', 'PATCH'] }, input: { type: 'object' }, confirmationToken: { type: 'string' }, idempotencyKey: { type: 'string' } }, required: ['path', 'method', 'input', 'confirmationToken', 'idempotencyKey'] } },
];

function createMcp({ request = client.request, writeRequest = client.writeRequest, privateRoot = process.env.ABEC_PRIVATE_DIR || path.join(os.homedir(), '.answers-beyond', 'private') } = {}) {
  const files = createPrivateFiles(privateRoot);
  function cleanCodeInput(input, codes) {
    const result = { ...input };
    for (const key of ['outputFile', 'codesFile', 'count', 'length', 'prefix', 'excludeAmbiguous']) delete result[key];
    if (Object.prototype.hasOwnProperty.call(result, 'codes')) throw new Error('完整卡密不得进入 Agent tool input；请使用 codesFile。');
    if (codes) result.codes = codes;
    return result;
  }
  function confirmationInput(input, file) {
    const result = cleanCodeInput(input);
    result.codesFile = files.resolve(file);
    return result;
  }
  async function call(name, args = {}) {
    if (name === 'abec_whoami') return request('/api/v1/me');
    if (name === 'abec_list_products') return request('/api/v1/products');
    if (name === 'abec_get_product') return request(`/api/v1/products/${encodeURIComponent(args.id)}`);
    if (name === 'abec_list_codes') return request(`/api/v1/codes${args.productId ? `?productId=${encodeURIComponent(args.productId)}` : ''}`);
    if (name === 'abec_create_product_preview') return writeRequest('/api/v1/products', args.input, { preview: true });
    if (name === 'abec_update_product_preview') return writeRequest(`/api/v1/products/${encodeURIComponent(args.id)}`, args.input, { preview: true, method: 'PATCH' });
    if (name === 'abec_generate_codes_preview') {
      const outputFile = files.resolve(args.outputFile);
      let codes;
      let reusedFile = false;
      if (fs.existsSync(outputFile)) {
        codes = files.read(outputFile);
        reusedFile = true;
        if (args.count !== undefined && codes.length !== Number(args.count)) throw new Error(`已有卡密文件包含 ${codes.length} 张，与 count 不一致。`);
      } else {
        codes = generateCodes(args);
        fs.mkdirSync(path.dirname(outputFile), { recursive: true });
        fs.writeFileSync(outputFile, `${codes.join('\n')}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      }
      const preview = await writeRequest('/api/v1/codes/import', cleanCodeInput(args, codes), { preview: true });
      return { ...preview, localCodeFile: outputFile, codeCount: codes.length, reusedFile, confirmationInput: confirmationInput(args, outputFile) };
    }
    if (name === 'abec_import_codes_preview') {
      if (!args.codesFile) throw new Error('MCP 导入必须指定 codesFile；完整卡密不得进入 Agent tool input。');
      const codes = files.read(args.codesFile);
      const preview = await writeRequest('/api/v1/codes/import', cleanCodeInput(args, codes), { preview: true });
      return { ...preview, localCodeFile: files.resolve(args.codesFile), codeCount: codes.length, confirmationInput: confirmationInput(args, args.codesFile) };
    }
    if (name === 'abec_confirm_operation') {
      const input = { ...(args.input || {}) };
      let body = input;
      if (input.codesFile) body = cleanCodeInput(input, files.read(input.codesFile));
      return request(args.path, {
        method: args.method,
        body: JSON.stringify({ ...body, confirmationToken: args.confirmationToken }),
        headers: { 'Idempotency-Key': args.idempotencyKey },
      });
    }
    throw new Error(`未知工具：${name}`);
  }
  return { tools, call };
}

function startStdio(mcp = createMcp()) {
  let buffer = '';
  const send = (payload) => process.stdout.write(`${JSON.stringify(payload)}\n`);
  async function handle(message) {
    try {
      if (message.method === 'initialize') return send({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'answers-beyond', version: '1.0.0' } } });
      if (message.method === 'notifications/initialized') return;
      if (message.method === 'tools/list') return send({ jsonrpc: '2.0', id: message.id, result: { tools } });
      if (message.method === 'tools/call') return send({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: JSON.stringify(await mcp.call(message.params.name, message.params.arguments || {}), null, 2) }] } });
      return send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: '方法不存在' } });
    } catch (error) {
      return send({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: error.message, data: { code: error.code, requestId: error.requestId } } });
    }
  }
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let split;
    while ((split = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, split); buffer = buffer.slice(split + 1);
      if (line.trim()) void handle(JSON.parse(line));
    }
  });
}

if (require.main === module) startStdio();

module.exports = { createMcp, startStdio, tools };
