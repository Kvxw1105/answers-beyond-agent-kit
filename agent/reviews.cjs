'use strict';

const REVIEW_ACTIONS = new Set(['lock', 'approve', 'reject', 'abnormal', 'unlock']);
const DEFAULT_API_URL = 'https://ent.xince.work';
const NOT_REDEEMED_MESSAGE = '卡密已找到，但买家尚未在答案之外完成权益认领，所以还没有可锁定的审核记录。请让买家打开领取页，输入原购买卡密完成认领；完成后重新匹配。不要重新导入该卡密，也不要让 Agent 代替买家认领。';

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

function addReviewMatchGuidance(value, apiUrl = DEFAULT_API_URL) {
  const fallback = {
    action: 'buyer_redeem',
    redeemUrl: `${String(apiUrl || DEFAULT_API_URL).replace(/\/+$/, '')}/redeem`,
    retry: 'match_after_redeem',
    message: NOT_REDEEMED_MESSAGE,
  };
  const add = (item) => {
    if (!item || typeof item !== 'object' || item.verdict !== 'not_redeemed') return item;
    const nextStep = item.nextStep && typeof item.nextStep === 'object' ? item.nextStep : fallback;
    return { ...item, nextStep, operatorMessage: typeof nextStep.message === 'string' ? nextStep.message : NOT_REDEEMED_MESSAGE };
  };
  if (Array.isArray(value)) return value.map(add);
  if (value && typeof value === 'object' && Array.isArray(value.data)) return { ...value, data: value.data.map(add) };
  return value;
}

function reviewActionPath(reviewCode, action) {
  if (typeof reviewCode === 'object' && reviewCode !== null) {
    const reviewId = String(reviewCode.reviewId || reviewCode.id || '').trim();
    if (!reviewId) throw new Error('审核动作必须使用服务端返回的 reviewId 或六位审核码。');
    if (!REVIEW_ACTIONS.has(action)) throw new Error(`未知审核动作：${action}`);
    return `/api/v1/reviews/cases/${encodeURIComponent(reviewId)}/${action}`;
  }
  const normalizedCode = String(reviewCode || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(normalizedCode)) throw new Error('审核动作必须使用服务端返回的六位审核码。');
  if (!REVIEW_ACTIONS.has(action)) throw new Error(`未知审核动作：${action}`);
  return `/api/v1/reviews/${normalizedCode}/${action}`;
}

module.exports = {
  REVIEW_ACTIONS,
  addReviewMatchGuidance,
  extractPurchaseCodes,
  maskPurchaseCode,
  normalizePurchaseCode,
  normalizePurchaseCodes,
  normalizePurchaseCodesFromText,
  reviewActionPath,
  sanitizeReviewPayload,
};
