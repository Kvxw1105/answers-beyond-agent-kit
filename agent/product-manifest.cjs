'use strict';

const DELIVERY_TYPES = new Set(['manual_review', 'direct_delivery', 'account_activation']);
const PUBLICATIONS = new Set(['draft', 'active']);
const CODE_MODES = new Set(['none', 'generate', 'import']);

function fail(field, message) { throw new Error(`商品配置包 ${field} ${message}`); }
function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(field, '必须是对象。');
  return value;
}
function text(value, field, maxLength, { required = true, fallback = '' } = {}) {
  if (value === undefined && !required) return fallback;
  if (typeof value !== 'string') fail(field, '必须是文本。');
  const normalized = value.trim();
  if (required && !normalized) fail(field, '不能为空。');
  if (normalized.length > maxLength) fail(field, `不能超过 ${maxLength} 个字符。`);
  return normalized;
}
function httpUrl(value, field) {
  const raw = text(value, field, 2000);
  let parsed;
  try { parsed = new URL(raw); } catch { fail(field, '必须是有效 URL。'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) fail(field, '只允许 http(s) URL。');
  return parsed.toString();
}
function normalizeSources(value = []) {
  if (!Array.isArray(value) || value.length > 20) fail('sources', '必须是最多 20 个来源 URL 的数组。');
  return [...new Set(value.map((item, index) => httpUrl(item, `sources[${index}]`)))];
}
function normalizeDelivery(value) {
  const delivery = object(value, 'delivery');
  const type = text(delivery.type, 'delivery.type', 40);
  if (!DELIVERY_TYPES.has(type)) fail('delivery.type', '不是受支持的交付类型。');
  const config = object(delivery.config, 'delivery.config');
  const instructions = delivery.instructions === undefined ? [] : delivery.instructions;
  if (!Array.isArray(instructions) || instructions.length > 30) fail('delivery.instructions', '必须是最多 30 条文本的数组。');
  const normalizedInstructions = instructions.map((item, index) => text(item, `delivery.instructions[${index}]`, 500));
  if (type === 'manual_review') {
    httpUrl(config.inviteUrl, 'delivery.config.inviteUrl');
    if (!Array.isArray(config.steps) || config.steps.length === 0) fail('delivery.config.steps', '至少需要一条操作步骤。');
  }
  if (type === 'direct_delivery' && config.mode !== 'selectable_bundle' && (!Array.isArray(config.resources) || config.resources.length === 0)) {
    fail('delivery.config.resources', '至少需要一个资源。');
  }
  if (type === 'account_activation' && (!Array.isArray(config.fields) || config.fields.length === 0)) {
    fail('delivery.config.fields', '至少需要一个账号字段。');
  }
  return { type, config, instructions: normalizedInstructions };
}
function normalizeCodes(value = { mode: 'none' }) {
  const codes = object(value, 'codes');
  const mode = text(codes.mode || 'none', 'codes.mode', 20);
  if (!CODE_MODES.has(mode)) fail('codes.mode', '必须是 none、generate 或 import。');
  const result = { mode };
  if (codes.batchName !== undefined) result.batchName = text(codes.batchName, 'codes.batchName', 120, { required: false });
  if (mode === 'generate') {
    const count = Number(codes.count);
    const length = Number(codes.length ?? 12);
    if (!Number.isInteger(count) || count < 1 || count > 1000) fail('codes.count', '必须是 1–1000 的整数。');
    if (!Number.isInteger(length) || length < 8 || length > 32) fail('codes.length', '必须是 8–32 的整数。');
    const prefix = text(codes.prefix || '', 'codes.prefix', 10, { required: false }).toUpperCase();
    if (!/^[A-Z0-9_-]*$/.test(prefix)) fail('codes.prefix', '只能包含英文字母、数字、下划线或短横线。');
    Object.assign(result, { count, length, prefix, excludeAmbiguous: codes.excludeAmbiguous !== false });
  }
  if (mode === 'import') {
    const file = text(codes.file, 'codes.file', 2000);
    if (file.includes('\0')) fail('codes.file', '包含非法路径字符。');
    result.file = file;
  }
  return result;
}
function normalizeManifest(value) {
  const manifest = object(value, '根配置');
  if (manifest.manifestVersion !== 1) fail('manifestVersion', '当前只支持版本 1。');
  const product = object(manifest.product, 'product');
  const publication = text(product.publication || 'draft', 'product.publication', 20);
  if (!PUBLICATIONS.has(publication)) fail('product.publication', '必须是 draft 或 active。');
  return {
    manifestVersion: 1,
    product: {
      sku: text(product.sku, 'product.sku', 80).toUpperCase().replace(/[^A-Z0-9-_]/g, '-'),
      name: text(product.name, 'product.name', 160),
      description: text(product.description, 'product.description', 1200, { required: false }),
      coverStyle: text(product.coverStyle, 'product.coverStyle', 30, { required: false, fallback: 'indigo' }),
      publication,
    },
    sources: normalizeSources(manifest.sources),
    delivery: normalizeDelivery(manifest.delivery),
    codes: normalizeCodes(manifest.codes),
  };
}
function toProductInput(value) {
  const manifest = normalizeManifest(value);
  return {
    sku: manifest.product.sku,
    name: manifest.product.name,
    description: manifest.product.description,
    deliveryType: manifest.delivery.type,
    coverStyle: manifest.product.coverStyle,
    deliveryConfig: manifest.delivery.config,
    instructions: manifest.delivery.instructions,
  };
}

module.exports = { DELIVERY_TYPES, normalizeManifest, toProductInput };
