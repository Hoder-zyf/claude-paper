#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adaptSkillContent, adapterSpecs } from './sync-agent-adapters.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const supportedTargets = new Set(['claude-code', 'codex', 'opencode', 'deepseek-harness']);
const claudeMarketplaceName = 'claude-paper';
const claudePluginId = 'claude-paper@claude-paper';

function printHelp() {
  console.log(`Claude Paper cross-agent installer

Usage:
  node scripts/install-agent-adapters.mjs --target all
  node scripts/install-agent-adapters.mjs --target claude-code,codex,opencode,deepseek-harness
  node scripts/install-agent-adapters.mjs --target all --dry-run

The claude-code target requires the Claude Code CLI. This installer does not install an MCP server.`);
}

function parseTargets(argv) {
  const index = argv.indexOf('--target');
  const raw = index === -1 ? 'all' : argv[index + 1];
  if (!raw) throw new Error('--target requires a value');

  const normalized = raw === 'all'
    ? [...supportedTargets]
    : raw.split(',').map((value) => value.trim()).map((value) => {
      if (value === 'claude') return 'claude-code';
      if (value === 'dsh') return 'deepseek-harness';
      return value;
    });

  const invalid = normalized.filter((value) => !supportedTargets.has(value));
  if (invalid.length > 0) {
    throw new Error(`Unsupported target(s): ${invalid.join(', ')}`);
  }
  return [...new Set(normalized)];
}

function dataHome(home) {
  if (process.env.XDG_DATA_HOME) return process.env.XDG_DATA_HOME;
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) return process.env.LOCALAPPDATA;
  return path.join(home, '.local', 'share');
}

function configHome(home) {
  if (process.env.XDG_CONFIG_HOME) return process.env.XDG_CONFIG_HOME;
  if (process.platform === 'win32' && process.env.APPDATA) return process.env.APPDATA;
  return path.join(home, '.config');
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function shouldCopy(source) {
  const ignored = new Set(['node_modules', '.nuxt', '.output', '.DS_Store', '.installed']);
  return !ignored.has(path.basename(source));
}

async function writeOwnedDirectory(target, files) {
  const parent = path.dirname(target);
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(path.join(parent, `.${path.basename(target)}-`));
  for (const [relative, content] of Object.entries(files)) {
    const destination = path.join(temporary, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }

  const backup = `${target}.previous-${process.pid}`;
  await rm(backup, { recursive: true, force: true });
  if (await exists(target)) await rename(target, backup);
  try {
    await rename(temporary, target);
    await rm(backup, { recursive: true, force: true });
  } catch (error) {
    if (await exists(backup)) await rename(backup, target);
    throw error;
  }
}

async function prepareRuntime(runtimeRoot) {
  const parent = path.dirname(runtimeRoot);
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(path.join(parent, '.claude-paper-staging-'));
  await cp(path.join(repoRoot, 'plugin'), path.join(staging, 'plugin'), {
    recursive: true,
    filter: shouldCopy,
  });
  await cp(path.join(repoRoot, '.claude-plugin'), path.join(staging, '.claude-plugin'), { recursive: true });
  await cp(path.join(repoRoot, '.codex-plugin'), path.join(staging, '.codex-plugin'), { recursive: true });
  await cp(path.join(repoRoot, 'skills'), path.join(staging, 'skills'), { recursive: true });
  await cp(path.join(repoRoot, 'LICENSE'), path.join(staging, 'LICENSE'));

  const backup = `${runtimeRoot}.previous-${process.pid}`;
  await rm(backup, { recursive: true, force: true });
  if (await exists(runtimeRoot)) await rename(runtimeRoot, backup);
  try {
    await rename(staging, runtimeRoot);
    return backup;
  } catch (error) {
    if (await exists(backup)) await rename(backup, runtimeRoot);
    throw error;
  }
}

function runClaude(args) {
  const result = spawnSync('claude', args, {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });

  if (result.error?.code === 'ENOENT') {
    throw new Error('Claude Code CLI was not found. Install Claude Code or omit the claude-code target.');
  }
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`Claude Code command failed: claude ${args.join(' ')}${detail ? `\n${detail}` : ''}`);
  }
  return result.stdout;
}

function readClaudeJson(args) {
  const output = runClaude(args).trim();
  try {
    return JSON.parse(output || '[]');
  } catch (error) {
    throw new Error(`Claude Code returned invalid JSON for: claude ${args.join(' ')}\n${output}`, { cause: error });
  }
}

async function installClaudeCode(runtimeRoot) {
  console.log('Configuring Claude Code marketplace and plugin...');
  const marketplaces = readClaudeJson(['plugin', 'marketplace', 'list', '--json']);
  if (marketplaces.some((marketplace) => marketplace.name === claudeMarketplaceName)) {
    runClaude(['plugin', 'marketplace', 'remove', claudeMarketplaceName]);
  }
  runClaude(['plugin', 'marketplace', 'add', runtimeRoot]);

  const installed = readClaudeJson(['plugin', 'list', '--json']);
  const userInstall = installed.find((plugin) => plugin.id === claudePluginId && plugin.scope === 'user');
  if (userInstall) {
    runClaude(['plugin', 'update', claudePluginId, '--scope', 'user']);
  } else {
    runClaude(['plugin', 'install', claudePluginId, '--scope', 'user']);
  }
  console.log('Claude Code plugin configured successfully.');
}

async function installSkills(skillsRoot, runtimePluginRoot) {
  for (const spec of adapterSpecs) {
    const source = await readFile(spec.source, 'utf8');
    const content = adaptSkillContent(source, spec, { runtimePluginRoot });
    await writeOwnedDirectory(path.join(skillsRoot, spec.adapterName), { 'SKILL.md': content });
  }
}

async function installOpenCodeCommands(commandsRoot) {
  const commands = {
    'claude-paper-study.md': `---\ndescription: Study a research paper with Claude Paper\n---\n\nLoad the \`claude-paper-study\` skill and follow it for this paper input:\n\n$ARGUMENTS\n`,
    'claude-paper-summary.md': `---\ndescription: Quickly summarize a research paper with Claude Paper\n---\n\nLoad the \`claude-paper-summary\` skill and follow it for this paper input:\n\n$ARGUMENTS\n`,
    'claude-paper-webui.md': `---\ndescription: Start the Claude Paper web viewer\n---\n\nLoad and follow the \`claude-paper-webui\` skill.\n`,
  };
  await mkdir(commandsRoot, { recursive: true });
  for (const [name, content] of Object.entries(commands)) {
    await writeFile(path.join(commandsRoot, name), content);
  }
}

async function initializePaperLibrary(home) {
  const library = path.join(home, 'claude-papers');
  if (await exists(library)) return;
  await mkdir(path.join(library, 'papers'), { recursive: true });
  await writeFile(path.join(library, 'index.json'), '[]\n');
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  const targets = parseTargets(argv);
  const dryRun = argv.includes('--dry-run');
  const home = process.env.HOME || os.homedir();
  const runtimeRoot = path.join(dataHome(home), 'claude-paper');
  const runtimePluginRoot = path.join(runtimeRoot, 'plugin');
  const agentsRoot = process.env.AGENTS_HOME || path.join(home, '.agents');
  const skillsRoot = path.join(agentsRoot, 'skills');
  const openCodeCommandsRoot = path.join(configHome(home), 'opencode', 'commands');
  const installsSharedSkills = targets.some((target) => target !== 'claude-code');

  console.log(`Targets: ${targets.join(', ')}`);
  console.log(`Runtime: ${runtimeRoot}`);
  if (installsSharedSkills) console.log(`Shared skills: ${skillsRoot}`);
  if (targets.includes('claude-code')) console.log(`Claude Code plugin: ${claudePluginId}`);
  if (targets.includes('opencode')) console.log(`OpenCode commands: ${openCodeCommandsRoot}`);

  if (dryRun) {
    console.log('Dry run complete; no files were written.');
    return;
  }

  const previousRuntime = await prepareRuntime(runtimeRoot);
  try {
    if (installsSharedSkills) await installSkills(skillsRoot, runtimePluginRoot);
    if (targets.includes('opencode')) await installOpenCodeCommands(openCodeCommandsRoot);
    await initializePaperLibrary(home);
    if (targets.includes('claude-code')) await installClaudeCode(runtimeRoot);

    const manifest = JSON.parse(await readFile(path.join(repoRoot, 'plugin/.claude-plugin/plugin.json'), 'utf8'));
    await writeFile(path.join(runtimeRoot, 'install-state.json'), `${JSON.stringify({
      version: manifest.version,
      installedAt: new Date().toISOString(),
      targets,
      runtimeRoot,
      skills: installsSharedSkills ? adapterSpecs.map((spec) => spec.adapterName) : [],
      claudePlugin: targets.includes('claude-code') ? claudePluginId : null,
      mcp: false,
    }, null, 2)}\n`);
    await rm(previousRuntime, { recursive: true, force: true });
  } catch (error) {
    await rm(runtimeRoot, { recursive: true, force: true });
    if (await exists(previousRuntime)) await rename(previousRuntime, runtimeRoot);
    throw error;
  }

  console.log('Claude Paper installed successfully. Restart the selected agent applications to refresh plugin and skill discovery.');
}

await main();
