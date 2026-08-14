import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function createFakeClaude(sandbox) {
  const bin = path.join(sandbox, 'bin');
  const state = path.join(sandbox, 'fake-claude-state');
  const executable = path.join(bin, 'claude');
  await mkdir(bin, { recursive: true });
  await writeFile(executable, `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const state = process.env.FAKE_CLAUDE_STATE;
const marketplace = path.join(state, 'marketplace');
const installed = path.join(state, 'installed');
fs.mkdirSync(state, { recursive: true });
fs.appendFileSync(path.join(state, 'commands.jsonl'), JSON.stringify(args) + '\\n');

if (args.join(' ') === 'plugin marketplace list --json') {
  console.log(JSON.stringify(fs.existsSync(marketplace) ? [{ name: 'claude-paper' }] : []));
} else if (args[0] === 'plugin' && args[1] === 'marketplace' && args[2] === 'remove') {
  fs.rmSync(marketplace, { force: true });
} else if (args[0] === 'plugin' && args[1] === 'marketplace' && args[2] === 'add') {
  fs.writeFileSync(marketplace, args[3]);
} else if (args.join(' ') === 'plugin list --json') {
  console.log(JSON.stringify(fs.existsSync(installed) ? [{ id: 'claude-paper@claude-paper', scope: 'user', version: '1.2.1' }] : []));
} else if (args[0] === 'plugin' && args[1] === 'install') {
  fs.writeFileSync(installed, '1.2.1');
} else if (args[0] === 'plugin' && args[1] === 'update' && fs.existsSync(installed)) {
  fs.writeFileSync(installed, '1.2.1');
} else {
  console.error('Unexpected fake Claude command: ' + args.join(' '));
  process.exitCode = 1;
}
`);
  await chmod(executable, 0o755);
  return { bin, state };
}

test('canonical Claude skills match reviewed checksums', async () => {
  const study = await readFile(path.join(repoRoot, 'plugin/skills/study/SKILL.md'));
  const summary = await readFile(path.join(repoRoot, 'plugin/skills/summary/SKILL.md'));
  const webui = await readFile(path.join(repoRoot, 'plugin/skills/webui/SKILL.md'));
  assert.equal(sha256(study), 'fbaeecaf2e18d868bd2ab9d5fa4f9d11e9a0ee898926ba02b1921aa0317efa17');
  assert.equal(sha256(summary), 'e0fbee3e3cf4fb60a21212bf2f32ea647d088e5b5802d1d1f3781de995fdbd9b');
  assert.equal(sha256(webui), '9bc692188e03d5a031bb52d9ecd1b2c46c39792aa6c3308d744437819fed5232');
});

test('web UI uses reproducible local-only startup without the unused content module', async () => {
  const webui = await readFile(path.join(repoRoot, 'plugin/skills/webui/SKILL.md'), 'utf8');
  assert.match(webui, /if \[ ! -d "node_modules" \]; then/);
  assert.match(webui, /npm ci/);
  assert.doesNotMatch(webui, /rm -rf node_modules package-lock\.json/);
  assert.match(webui, /HOST=127\.0\.0\.1 PORT=5815 node \.output\/server\/index\.mjs/);

  const webPackage = JSON.parse(await readFile(path.join(repoRoot, 'plugin/src/web/package.json'), 'utf8'));
  const webLock = JSON.parse(await readFile(path.join(repoRoot, 'plugin/src/web/package-lock.json'), 'utf8'));
  const nuxtConfig = await readFile(path.join(repoRoot, 'plugin/src/web/nuxt.config.ts'), 'utf8');
  assert.equal(webPackage.dependencies['@nuxt/content'], undefined);
  assert.equal(webLock.packages['node_modules/@nuxt/content'], undefined);
  assert.doesNotMatch(nuxtConfig, /@nuxt\/content/);
});

test('checked-in cross-agent skills match their canonical generated form', () => {
  const result = spawnSync(process.execPath, ['scripts/sync-agent-adapters.mjs', '--check'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('each packaged adapter points to the correct plugin root', async () => {
  const codexStudy = await readFile(path.join(repoRoot, 'skills/claude-paper-study/SKILL.md'), 'utf8');
  const codexSummary = await readFile(path.join(repoRoot, 'skills/claude-paper-summary/SKILL.md'), 'utf8');
  const sharedStudy = await readFile(path.join(repoRoot, '.agents/skills/claude-paper-study/SKILL.md'), 'utf8');
  const sharedSummary = await readFile(path.join(repoRoot, '.agents/skills/claude-paper-summary/SKILL.md'), 'utf8');
  assert.match(codexStudy, /directory is `\.\.\/\.\.\/plugin`/);
  assert.match(codexSummary, /directory is `\.\.\/\.\.\/plugin`/);
  assert.match(sharedStudy, /directory is `\.\.\/\.\.\/\.\.\/plugin`/);
  assert.match(sharedSummary, /directory is `\.\.\/\.\.\/\.\.\/plugin`/);
});

test('all plugin manifests publish the same release version', async () => {
  const files = [
    'package.json',
    '.codex-plugin/plugin.json',
    'plugin/.claude-plugin/plugin.json',
    '.claude-plugin/marketplace.json',
    'plugin/package.json',
  ];
  const documents = await Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(repoRoot, file), 'utf8'))));
  assert.equal(documents[0].name, '@zlzliqing/claude-paper');
  const versions = [documents[0].version, documents[1].version, documents[2].version, documents[3].plugins[0].version, documents[4].version];
  assert.deepEqual(versions, ['1.2.1', '1.2.1', '1.2.1', '1.2.1', '1.2.1']);
});

test('published CLI installs and upgrades without changing the runtime skill or paper library', async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'claude-paper-adapter-test-'));
  const fakeClaude = await createFakeClaude(sandbox);
  const env = {
    ...process.env,
    HOME: path.join(sandbox, 'home'),
    XDG_DATA_HOME: path.join(sandbox, 'data'),
    XDG_CONFIG_HOME: path.join(sandbox, 'config'),
    AGENTS_HOME: path.join(sandbox, 'agents'),
    FAKE_CLAUDE_STATE: fakeClaude.state,
    PATH: `${fakeClaude.bin}${path.delimiter}${process.env.PATH || ''}`,
  };
  const result = spawnSync(process.execPath, ['bin/claude-paper.mjs', 'install', '--target', 'all'], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const installedStudy = await readFile(path.join(env.AGENTS_HOME, 'skills/claude-paper-study/SKILL.md'), 'utf8');
  const installedSummary = await readFile(path.join(env.AGENTS_HOME, 'skills/claude-paper-summary/SKILL.md'), 'utf8');
  const installedWebui = await readFile(path.join(env.AGENTS_HOME, 'skills/claude-paper-webui/SKILL.md'), 'utf8');
  assert.match(installedStudy, /^name: claude-paper-study$/m);
  assert.doesNotMatch(installedStudy, /^disable-model-invocation:/m);
  assert.match(installedStudy, /CLAUDE_PAPER_PLUGIN_ROOT='/);
  assert.doesNotMatch(installedStudy, /\$\{CLAUDE_PLUGIN_ROOT\}/);
  assert.match(installedStudy, /Load and follow the `claude-paper-webui` skill/);
  assert.match(installedStudy, /--output-dir "\$PARSE_OUTPUT_DIR"/);
  assert.match(installedStudy, /paper\.txt/);
  assert.match(installedSummary, /^name: claude-paper-summary$/m);
  assert.doesNotMatch(installedSummary, /\/claude-paper:(?:study|webui)/);
  assert.match(installedSummary, /--output-dir "\$PARSE_OUTPUT_DIR"/);
  assert.match(installedSummary, /paper\.txt/);
  assert.match(installedWebui, /npm ci/);
  assert.match(installedWebui, /HOST=127\.0\.0\.1 PORT=5815/);

  const sourceStudy = await readFile(path.join(repoRoot, 'plugin/skills/study/SKILL.md'));
  const sourceSummary = await readFile(path.join(repoRoot, 'plugin/skills/summary/SKILL.md'));
  const runtimeStudy = await readFile(path.join(env.XDG_DATA_HOME, 'claude-paper/plugin/skills/study/SKILL.md'));
  const runtimeSummary = await readFile(path.join(env.XDG_DATA_HOME, 'claude-paper/plugin/skills/summary/SKILL.md'));
  assert.equal(sha256(runtimeStudy), sha256(sourceStudy));
  assert.equal(sha256(runtimeSummary), sha256(sourceSummary));
  await readFile(path.join(env.XDG_DATA_HOME, 'claude-paper/plugin/skills/study/scripts/parse-pdf-core.js'));
  await readFile(path.join(env.XDG_DATA_HOME, 'claude-paper/.claude-plugin/marketplace.json'));

  await readFile(path.join(env.XDG_CONFIG_HOME, 'opencode/commands/claude-paper-study.md'));
  await readFile(path.join(env.XDG_CONFIG_HOME, 'opencode/commands/claude-paper-summary.md'));
  const indexPath = path.join(env.HOME, 'claude-papers/index.json');
  assert.equal(await readFile(indexPath, 'utf8'), '[]\n');

  await writeFile(indexPath, '[{"slug":"existing-paper"}]\n');
  const upgrade = spawnSync(process.execPath, ['bin/claude-paper.mjs', 'upgrade', '--target', 'all'], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  });
  assert.equal(upgrade.status, 0, `${upgrade.stdout}\n${upgrade.stderr}`);
  assert.equal(await readFile(indexPath, 'utf8'), '[{"slug":"existing-paper"}]\n');

  const commands = (await readFile(path.join(fakeClaude.state, 'commands.jsonl'), 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.ok(commands.some((args) => args.join(' ') === 'plugin install claude-paper@claude-paper --scope user'));
  assert.ok(commands.some((args) => args.join(' ') === 'plugin marketplace remove claude-paper'));
  assert.ok(commands.some((args) => args.join(' ') === 'plugin update claude-paper@claude-paper --scope user'));
});

test('claude-code target installs only the Claude plugin and accepts the claude alias', async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'claude-paper-claude-only-test-'));
  const fakeClaude = await createFakeClaude(sandbox);
  const env = {
    ...process.env,
    HOME: path.join(sandbox, 'home'),
    XDG_DATA_HOME: path.join(sandbox, 'data'),
    XDG_CONFIG_HOME: path.join(sandbox, 'config'),
    AGENTS_HOME: path.join(sandbox, 'agents'),
    FAKE_CLAUDE_STATE: fakeClaude.state,
    PATH: `${fakeClaude.bin}${path.delimiter}${process.env.PATH || ''}`,
  };
  const result = spawnSync(process.execPath, ['bin/claude-paper.mjs', 'install', '--target', 'claude'], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  await readFile(path.join(fakeClaude.state, 'installed'));
  await assert.rejects(readFile(path.join(env.AGENTS_HOME, 'skills/claude-paper-study/SKILL.md')), { code: 'ENOENT' });
  const installState = JSON.parse(await readFile(path.join(env.XDG_DATA_HOME, 'claude-paper/install-state.json'), 'utf8'));
  assert.deepEqual(installState.targets, ['claude-code']);
  assert.deepEqual(installState.skills, []);
  assert.equal(installState.claudePlugin, 'claude-paper@claude-paper');
});

test('published CLI reports the package version', () => {
  const result = spawnSync(process.execPath, ['bin/claude-paper.mjs', '--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '1.2.1');
});
