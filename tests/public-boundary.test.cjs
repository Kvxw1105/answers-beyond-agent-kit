'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const ignored = new Set(['.git', 'node_modules']);
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (ignored.has(entry.name)) return [];
    if (entry.name.endsWith('.tgz')) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

test('public kit excludes credentials and private backend artifacts', () => {
  const forbiddenNames = [/wrangler\.toml$/i, /migrations/i, /worker\/src/i];
  const forbiddenContent = [/abec_live_[A-Za-z0-9_-]{10,}/, /CLOUDFLARE_API_TOKEN\s*=/, /CODE_PEPPER\s*=/, /ADMIN_TOKEN\s*=/];
  for (const file of files(root)) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    assert.ok(!forbiddenNames.some((pattern) => pattern.test(relative)), `private artifact: ${relative}`);
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(!forbiddenContent.some((pattern) => pattern.test(content)), `credential pattern: ${relative}`);
  }
});
