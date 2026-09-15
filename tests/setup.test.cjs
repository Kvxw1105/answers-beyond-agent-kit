'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const expectedSkill = {
  codex: ['.codex', 'skills', 'answers-beyond', 'SKILL.md'],
  claude: ['.claude', 'skills', 'answers-beyond', 'SKILL.md'],
  opencode: ['.config', 'opencode', 'skills', 'answers-beyond', 'SKILL.md'],
  cursor: ['.cursor', 'skills', 'answers-beyond', 'SKILL.md'],
  generic: ['.agents', 'skills', 'answers-beyond', 'SKILL.md'],
};

for (const [harness, parts] of Object.entries(expectedSkill)) {
  test(`setup installs ${harness} skill and key-free MCP config`, () => {
    const { install } = require('../lib/setup.cjs');
    const home = fs.mkdtempSync(path.join(os.tmpdir(), `abec-${harness}-`));
    const result = install({ harness, home, skipRegister: true });
    assert.ok(fs.existsSync(path.join(home, ...parts)));
    assert.ok(fs.existsSync(result.mcpConfig));
    const config = fs.readFileSync(result.mcpConfig, 'utf8');
    assert.match(config, /ABEC_API_URL/);
    assert.doesNotMatch(config, /ABEC_API_KEY/);
  });
}

test('setup is idempotent and dry-run does not write', () => {
  const { install } = require('../lib/setup.cjs');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'abec-idempotent-'));
  const dry = install({ harness: 'codex', home, dryRun: true, skipRegister: true });
  assert.equal(dry.written.length, 0);
  const first = install({ harness: 'codex', home, skipRegister: true });
  const second = install({ harness: 'codex', home, skipRegister: true });
  assert.equal(first.skillPath, second.skillPath);
});

test('setup dry-run never attempts MCP registration', async () => {
  const { main } = require('../bin/answers-beyond-agent-kit.cjs');
  const logs = [];
  let registrationCalls = 0;

  await main(
    ['setup', '--harness', 'generic', '--register', '--dry-run'],
    {
      log: (value) => logs.push(value),
      registerMcp: () => {
        registrationCalls += 1;
        return { attempted: true, ok: true };
      },
    },
  );

  assert.equal(registrationCalls, 0);
  assert.equal(logs.length, 1);
  const result = JSON.parse(logs[0]);
  assert.deepEqual(result.registration, { attempted: false, reason: 'dry-run' });
});
