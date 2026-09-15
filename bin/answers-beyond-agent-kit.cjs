#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { install } = require('../lib/setup.cjs');
const { request } = require('../lib/client.cjs');
const { run: runAbec } = require('../cli/abec.cjs');

const HELP = `Answers Beyond Agent Kit

Usage:
  answers-beyond-agent-kit setup [--harness auto|codex|claude|opencode|cursor|generic] [--register] [--dry-run]
  answers-beyond-agent-kit doctor [--check] [--json]
  answers-beyond-agent-kit print-config [--harness NAME]
  answers-beyond-agent-kit abec <command...>

Security: set ABEC_API_KEY through your harness secret store or local environment. The kit never accepts it as a command argument or writes it to MCP JSON.`;

function parse(argv) {
  return {
    argv,
    has: (name) => argv.includes(name),
    value: (name) => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : undefined; },
  };
}
function detectHarness(requested) {
  if (requested && requested !== 'auto') return requested;
  if (process.env.CODEX_HOME || fs.existsSync(path.join(os.homedir(), '.codex'))) return 'codex';
  if (fs.existsSync(path.join(os.homedir(), '.claude'))) return 'claude';
  if (fs.existsSync(path.join(os.homedir(), '.config', 'opencode'))) return 'opencode';
  if (fs.existsSync(path.join(os.homedir(), '.cursor'))) return 'cursor';
  return 'generic';
}
function registerMcp(result) {
  const envArgs = ['--env', `ABEC_API_URL=${result.apiUrl}`, '--env', `ABEC_PRIVATE_DIR=${result.cardsDir}`];
  let command;
  let args;
  if (result.harness === 'codex') {
    command = 'codex'; args = ['mcp', 'add', 'answers-beyond', ...envArgs, '--', process.execPath, path.join(result.installRoot, 'mcp', 'server.cjs')];
  } else if (result.harness === 'claude') {
    command = 'claude'; args = ['mcp', 'add', 'answers-beyond', '--scope', 'user', ...envArgs, '--', process.execPath, path.join(result.installRoot, 'mcp', 'server.cjs')];
  } else return { attempted: false, reason: `请把 ${result.mcpConfig} 导入 ${result.harness} 的 MCP 设置。` };
  if (process.platform === 'win32') {
    const located = spawnSync('where.exe', [command], { encoding: 'utf8' });
    const executable = located.status === 0
      ? located.stdout.split(/\r?\n/).map((item) => item.trim()).find((item) => item.toLowerCase().endsWith('.exe'))
      : '';
    if (!executable) return { attempted: false, reason: `未找到可安全直调的 ${command}.exe；请把 ${result.mcpConfig} 导入 MCP 设置。` };
    command = executable;
  }
  const run = spawnSync(command, args, { encoding: 'utf8', shell: false });
  return { attempted: true, ok: run.status === 0, command, message: (run.status === 0 ? run.stdout : run.stderr).trim() };
}
function safeDoctor() {
  const major = Number(process.versions.node.split('.')[0]);
  return {
    node: process.versions.node,
    nodeSupported: major >= 20,
    apiUrl: (process.env.ABEC_API_URL || 'https://ent.xince.work').replace(/\/$/, ''),
    apiKeyConfigured: Boolean(process.env.ABEC_API_KEY),
    privateDir: process.env.ABEC_PRIVATE_DIR || path.join(os.homedir(), '.answers-beyond', 'private'),
  };
}
async function main(argv = process.argv.slice(2), dependencies = {}) {
  const log = dependencies.log || console.log;
  const runRegistration = dependencies.registerMcp || registerMcp;
  const [command] = argv;
  const args = parse(argv);
  if (!command || args.has('--help') || command === 'help') return log(HELP);
  if (command === 'abec') return log(JSON.stringify(await runAbec(argv.slice(1)), null, 2));
  if (command === 'setup' || command === 'print-config') {
    const harness = detectHarness(args.value('--harness') || 'auto');
    const result = install({
      harness,
      home: args.value('--home') ? path.resolve(args.value('--home')) : os.homedir(),
      apiUrl: args.value('--api-url') || process.env.ABEC_API_URL || 'https://ent.xince.work',
      privateDir: args.value('--private-dir'),
      dryRun: command === 'print-config' || args.has('--dry-run'),
      skipRegister: !args.has('--register'),
    });
    if (command === 'setup' && args.has('--register')) {
      result.registration = args.has('--dry-run')
        ? { attempted: false, reason: 'dry-run' }
        : runRegistration(result);
    }
    return log(JSON.stringify(result, null, 2));
  }
  if (command === 'doctor') {
    const result = safeDoctor();
    if (args.has('--check')) {
      const me = await request('/api/v1/me');
      result.connection = {
        ok: true,
        role: me?.data?.member?.role || me?.member?.role,
        scopes: me?.data?.scopes || me?.scopes || [],
        requestId: me.requestId,
      };
    }
    if (args.has('--json')) return log(JSON.stringify(result));
    return log(JSON.stringify(result, null, 2));
  }
  throw new Error(`未知命令：${command}\n\n${HELP}`);
}

if (require.main === module) main().catch((error) => {
  console.error(JSON.stringify({ error: error.message, code: error.code, requestId: error.requestId }, null, 2));
  process.exitCode = 1;
});

module.exports = { detectHarness, main, registerMcp, safeDoctor };
