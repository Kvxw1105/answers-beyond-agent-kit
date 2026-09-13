'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const bin = path.join(__dirname, '..', 'bin', 'answers-beyond-agent-kit.cjs');

test('top-level CLI presents setup, doctor, config, and ABEC commands', () => {
  const run = spawnSync(process.execPath, [bin, '--help'], { encoding: 'utf8' });
  assert.equal(run.status, 0);
  for (const command of ['setup', 'doctor', 'print-config', 'abec']) assert.match(run.stdout, new RegExp(command));
});

test('doctor reports configuration without exposing key value', () => {
  const run = spawnSync(process.execPath, [bin, 'doctor', '--json'], { encoding: 'utf8', env: { ...process.env, ABEC_API_KEY: 'very-secret-value' } });
  assert.equal(run.status, 0);
  const result = JSON.parse(run.stdout);
  assert.equal(result.apiKeyConfigured, true);
  assert.doesNotMatch(run.stdout, /very-secret-value/);
});

test('ABEC command fails safely when key is absent', () => {
  const env = { ...process.env }; delete env.ABEC_API_KEY;
  const run = spawnSync(process.execPath, [bin, 'abec', 'whoami'], { encoding: 'utf8', env });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /ABEC_API_KEY/);
});
