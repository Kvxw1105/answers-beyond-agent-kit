'use strict';

const REVIEW_ACTIONS = new Set(['lock', 'approve', 'reject', 'abnormal', 'unlock']);

function normalizePurchaseCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function extractPurchaseCodes(value) {
  const matches = String(value || '').toUpperCase().match(/(?<![A-Z0-9])[A-Z0-9]+(?:-[A-Z0-9]+)+|(?<![A-Z0-9])[A-Z0-9]{8,64}(?![A-Z0-9])/g) || [];
  return [...new Set(matches.filter((item) => item.length >= 8 && item.length <= 64 && /[A-Z]/.test(item) && /\d/.test(item)))].slice(0, 50);
}

function normalizePurchaseCodes(values) {
  if (!Array.isArray(values)) throw new Error('请提供当前 IMA 申请中的完整长卡密。');
  const codes = [...new Set(values.map(normalizePurchaseCode).filter((item) => item.length >= 8 && item.length <= 128 && /^[A-Z0-9_-]+$/.test(item)))].slice(0, 50);
  if (!codes.length) throw new Error('没有识别到有效长卡密；请忽略日期、手机号和订单号后重试。');
  return codes;
}

function normalizePurchaseCodesFromText(value) {
  const text = Array.isArray(value) ? value.join('\n') : String(value || '');
  const extracted = extractPurchaseCodes(text);
  return normalizePurchaseCodes(extracted.length ? extracted : text.split(/\r?\n/));
}

function maskPurchaseCode(code) {
  return `•••• ${normalizePurchaseCode(code).slice(-4)}`;
}

function sanitizeReviewPayload(value, purchaseCodes = []) {
  if (Array.isArray(value)) return value.map((item) => sanitizeReviewPayload(item, purchaseCodes));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['claimToken', 'purchaseCode', 'rawCode', 'code'].includes(key))
      .map(([key, item]) => [key, sanitizeReviewPayload(item, purchaseCodes)]));
  }
  if (typeof value !== 'string') return value;
  return purchaseCodes.reduce((text, code) => text.replaceAll(code, maskPurchaseCode(code)), value);
}

function reviewActionPath(reviewCode, action) {
  const normalizedCode = String(reviewCode || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(normalizedCode)) throw new Error('审核动作必须使用服务端返回的六位审核码。');
  if (!REVIEW_ACTIONS.has(action)) throw new Error(`未知审核动作：${action}`);
  return `/api/v1/reviews/${normalizedCode}/${action}`;
}

module.exports = {
  REVIEW_ACTIONS,
  extractPurchaseCodes,
  maskPurchaseCode,
  normalizePurchaseCode,
  normalizePurchaseCodes,
  normalizePurchaseCodesFromText,
  reviewActionPath,
  sanitizeReviewPayload,
};
