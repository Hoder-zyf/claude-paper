#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installer = path.join(packageRoot, 'scripts/install-agent-adapters.mjs');
const manifest = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

function printHelp() {
  console.log(`Claude Paper ${manifest.version}

Install or upgrade Claude Paper for Claude Code, Codex, OpenCode, and DeepSeek Harness.

Usage:
  claude-paper install [--target all|claude-code,codex,opencode,deepseek-harness] [--dry-run]
  claude-paper upgrade [--target all|claude-code,codex,opencode,deepseek-harness] [--dry-run]
  claude-paper --version
  claude-paper --help

Examples:
  claude-paper install
  claude-paper install --target claude-code
  claude-paper install --target codex
  claude-paper upgrade --target opencode,deepseek-harness

This package installs the existing Skills-based capabilities. It does not install an MCP server.`);
}

function runInstaller(args) {
  const result = spawnSync(process.execPath, [installer, ...args], {
    cwd: packageRoot,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.signal) {
    process.kill(process.pid, result.signal);
    return;
  }
  process.exitCode = result.status ?? 1;
}

const [command, ...args] = process.argv.slice(2);

if (!command || command === '--help' || command === '-h' || command === 'help') {
  printHelp();
} else if (command === '--version' || command === '-v' || command === 'version') {
  console.log(manifest.version);
} else if (command === 'install' || command === 'upgrade') {
  runInstaller(args);
} else {
  console.error(`Unknown command: ${command}\n`);
  printHelp();
  process.exitCode = 1;
}
