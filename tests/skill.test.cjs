'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const skillPath = path.join(__dirname, '..', 'skills', 'answers-beyond', 'SKILL.md');

test('skill has standard frontmatter and AI-native operating contract', () => {
  const body = fs.readFileSync(skillPath, 'utf8');
  assert.match(body, /^---\r?\nname: answers-beyond\r?\ndescription:/);
  for (const phrase of ['MCP', 'CLI', 'ABEC_API_KEY', 'whoami', '来源链接', '显式确认', 'confirmationToken', '## Learnings', '2026-09-13']) {
    assert.match(body, new RegExp(phrase));
  }
  assert.ok(body.split(/\r?\n/).length < 500);
});

test('skill evaluation set covers onboarding, bulk inventory, and diagnosis', () => {
  const evals = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'evals', 'evals.json'), 'utf8'));
  assert.equal(evals.evals.length, 3);
  assert.deepEqual(evals.evals.map((item) => item.id), ['source-onboarding', 'bulk-codes', 'permission-conflict']);
});
