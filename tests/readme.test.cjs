'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('README documents the complete member journey and authorization boundary', () => {
  const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  for (const phrase of ['npx', 'ABEC_API_KEY', 'doctor --check', 'Skill', 'MCP', 'CLI', 'preview', '显式确认', '权限', 'IMA', '长卡密', '人工同意']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
});

test('Windows installer is pinned to the current public kit version', () => {
  const installer = fs.readFileSync(path.join(__dirname, '..', 'install.ps1'), 'utf8');
  assert.match(installer, /answers-beyond-agent-kit#v1\.1\.1/g);
  assert.doesNotMatch(installer, /answers-beyond-agent-kit#v1\.1\.0/);
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(pkg.version, '1.1.1');
});
