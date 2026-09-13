'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const AMBIGUOUS_SAFE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FULL_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function normalizeOptions(input = {}) {
  const count = Number(input.count ?? 10);
  const length = Number(input.length ?? 12);
  const prefix = String(input.prefix ?? '').trim().toUpperCase();
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('count 必须是 1–1000 的整数。');
  if (!Number.isInteger(length) || length < 8 || length > 32) throw new Error('length 必须是 8–32 的整数。');
  if (!/^[A-Z0-9_-]{0,10}$/.test(prefix)) throw new Error('prefix 只能包含英文字母、数字、下划线或短横线，且不超过 10 个字符。');
  return { count, length, prefix, excludeAmbiguous: input.excludeAmbiguous !== false, randomIndex: input.randomIndex || crypto.randomInt };
}
function generateCodes(input = {}) {
  const options = normalizeOptions(input);
  const charset = options.excludeAmbiguous ? AMBIGUOUS_SAFE_CHARSET : FULL_CHARSET;
  const seen = new Set();
  while (seen.size < options.count) {
    const code = options.prefix + Array.from({ length: options.length }, () => charset[options.randomIndex(charset.length)]).join('');
    seen.add(code);
  }
  return [...seen];
}
function resolvedWithMissingTail(file) {
  let current = path.resolve(file);
  const tail = [];
  while (!fs.existsSync(current)) {
    tail.unshift(path.basename(current));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.join(fs.realpathSync.native(current), ...tail);
}
function createPrivateFiles(root) {
  const privateRoot = resolvedWithMissingTail(path.resolve(root));
  function resolve(file) {
    if (typeof file !== 'string' || !file.trim()) throw new Error('必须指定卡密文件。');
    const absolute = path.resolve(file);
    const resolved = resolvedWithMissingTail(absolute);
    const relative = path.relative(privateRoot, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`卡密文件必须位于 ABEC_PRIVATE_DIR 内：${privateRoot}`);
    return absolute;
  }
  function read(file) {
    const safe = resolve(file);
    const codes = [...new Set(fs.readFileSync(safe, 'utf8').split(/\r?\n/).map((item) => item.trim().toUpperCase()).filter(Boolean))];
    if (!codes.length) throw new Error(`卡密文件为空：${safe}`);
    return codes;
  }
  return { root: privateRoot, resolve, read };
}

module.exports = { AMBIGUOUS_SAFE_CHARSET, FULL_CHARSET, createPrivateFiles, generateCodes, normalizeOptions };
