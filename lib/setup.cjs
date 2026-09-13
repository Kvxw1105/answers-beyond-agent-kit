'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SOURCE_ROOT = path.resolve(__dirname, '..');
const HARNESS_SKILL_PATHS = {
  codex: ['.codex', 'skills', 'answers-beyond'],
  claude: ['.claude', 'skills', 'answers-beyond'],
  opencode: ['.config', 'opencode', 'skills', 'answers-beyond'],
  cursor: ['.cursor', 'skills', 'answers-beyond'],
  generic: ['.agents', 'skills', 'answers-beyond'],
};
const KIT_ENTRIES = ['agent', 'cli', 'lib', 'mcp', 'schemas', 'skills', 'examples', 'package.json', 'README.md', 'AGENTS.md', 'SECURITY.md', 'LICENSE'];

function copyEntry(source, destination) {
  if (!fs.existsSync(source)) return;
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    for (const name of fs.readdirSync(source)) copyEntry(path.join(source, name), path.join(destination, name));
    return;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}
function install({ harness = 'generic', home = os.homedir(), apiUrl = 'https://ent.xince.work', privateDir, dryRun = false, skipRegister = false } = {}) {
  if (harness === 'auto') harness = process.env.CODEX_HOME ? 'codex' : 'generic';
  if (!HARNESS_SKILL_PATHS[harness]) throw new Error(`不支持的 harness：${harness}`);
  const installRoot = path.join(home, '.answers-beyond', 'agent-kit');
  const skillDir = path.join(home, ...HARNESS_SKILL_PATHS[harness]);
  const skillPath = path.join(skillDir, 'SKILL.md');
  const mcpConfig = path.join(home, '.answers-beyond', 'connections', `${harness}.mcp.json`);
  const cardsDir = path.resolve(privateDir || path.join(home, '.answers-beyond', 'private'));
  const serverPath = path.join(installRoot, 'mcp', 'server.cjs');
  const config = {
    mcpServers: {
      answersBeyond: {
        command: process.execPath,
        args: [serverPath],
        env: { ABEC_API_URL: apiUrl.replace(/\/$/, ''), ABEC_PRIVATE_DIR: cardsDir },
      },
    },
  };
  const written = [];
  if (!dryRun) {
    fs.mkdirSync(installRoot, { recursive: true });
    for (const entry of KIT_ENTRIES) copyEntry(path.join(SOURCE_ROOT, entry), path.join(installRoot, entry));
    fs.mkdirSync(path.dirname(skillDir), { recursive: true });
    copyEntry(path.join(SOURCE_ROOT, 'skills', 'answers-beyond'), skillDir);
    fs.mkdirSync(path.dirname(mcpConfig), { recursive: true });
    fs.mkdirSync(cardsDir, { recursive: true });
    fs.writeFileSync(mcpConfig, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    written.push(installRoot, skillPath, mcpConfig, cardsDir);
  }
  return { harness, apiUrl, installRoot, skillPath, mcpConfig, cardsDir, config, written, registration: skipRegister ? 'skipped' : 'manual-or-cli' };
}

module.exports = { HARNESS_SKILL_PATHS, SOURCE_ROOT, install };
