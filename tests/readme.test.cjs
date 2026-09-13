'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('README documents the complete member journey and authorization boundary', () => {
  const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  for (const phrase of ['npx', 'ABEC_API_KEY', 'doctor --check', 'Skill', 'MCP', 'CLI', 'preview', '显式确认', '权限']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
});
