#!/usr/bin/env node

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const adapterSpecs = [
  {
    source: path.join(repoRoot, 'plugin/skills/study/SKILL.md'),
    targets: [
      { path: path.join(repoRoot, 'skills/claude-paper-study/SKILL.md'), relativePluginRoot: '../../plugin' },
      { path: path.join(repoRoot, '.agents/skills/claude-paper-study/SKILL.md'), relativePluginRoot: '../../../plugin' },
    ],
    sourceName: 'study',
    adapterName: 'claude-paper-study',
    replacesWebuiCommand: true,
  },
  {
    source: path.join(repoRoot, 'plugin/skills/webui/SKILL.md'),
    targets: [
      { path: path.join(repoRoot, 'skills/claude-paper-webui/SKILL.md'), relativePluginRoot: '../../plugin' },
      { path: path.join(repoRoot, '.agents/skills/claude-paper-webui/SKILL.md'), relativePluginRoot: '../../../plugin' },
    ],
    sourceName: 'webui',
    adapterName: 'claude-paper-webui',
    replacesWebuiCommand: false,
  },
  {
    source: path.join(repoRoot, 'plugin/skills/summary/SKILL.md'),
    targets: [
      { path: path.join(repoRoot, 'skills/claude-paper-summary/SKILL.md'), relativePluginRoot: '../../plugin' },
      { path: path.join(repoRoot, '.agents/skills/claude-paper-summary/SKILL.md'), relativePluginRoot: '../../../plugin' },
    ],
    sourceName: 'summary',
    adapterName: 'claude-paper-summary',
    replacesWebuiCommand: true,
    crossSkillReferences: [
      { source: '`/claude-paper:study`', target: '`claude-paper-study` skill' },
    ],
  },
];

function replaceFrontmatterName(content, sourceName, adapterName) {
  if (!content.startsWith('---\n')) {
    throw new Error('SKILL.md must start with YAML frontmatter');
  }

  const end = content.indexOf('\n---\n', 4);
  if (end === -1) {
    throw new Error('SKILL.md frontmatter is not terminated');
  }

  const frontmatter = content.slice(0, end);
  const expected = new RegExp(`^name:\\s*${sourceName}\\s*$`, 'm');
  if (!expected.test(frontmatter)) {
    throw new Error(`Expected frontmatter name ${sourceName}`);
  }

  return `${frontmatter.replace(expected, `name: ${adapterName}`)}${content.slice(end)}`;
}

function compatibilityNotice(runtimePluginRoot, packageRelativePluginRoot) {
  const rootInstruction = runtimePluginRoot
    ? `The installed plugin root is \`${runtimePluginRoot}\`. Each Bash block that needs it already sets \`CLAUDE_PAPER_PLUGIN_ROOT\` in the same shell invocation.`
    : `Resolve \`CLAUDE_PAPER_PLUGIN_ROOT\` to the absolute \`plugin/\` directory in this package before each shell invocation. From this \`SKILL.md\`, that directory is \`${packageRelativePluginRoot}\`.`;

  return [
    '## Cross-Agent Compatibility',
    '',
    '> This file is generated from the existing Claude Paper Skill. Its workflow and output requirements are unchanged; only equivalent host metadata, the plugin-root variable, and cross-skill invocation are adapted.',
    '',
    rootInstruction,
    'Treat every `${CLAUDE_PAPER_PLUGIN_ROOT}` reference below as that resolved absolute directory. Do not substitute the current workspace root.',
    '',
    'When this workflow asks to launch the viewer, load and follow the `claude-paper-webui` skill.',
    '',
    '---',
    '',
  ].join('\n');
}

function insertAfterFrontmatter(content, addition) {
  const end = content.indexOf('\n---\n', 4);
  return `${content.slice(0, end + 5)}\n${addition}${content.slice(end + 5)}`;
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function injectInstalledRoot(content, runtimePluginRoot) {
  return content.replace(/```bash\n([\s\S]*?)```/g, (block, body) => {
    if (!body.includes('${CLAUDE_PAPER_PLUGIN_ROOT}')) {
      return block;
    }
    return `\`\`\`bash\nCLAUDE_PAPER_PLUGIN_ROOT=${shellQuote(runtimePluginRoot)}\n${body}\`\`\``;
  });
}

export function adaptSkillContent(source, spec, options = {}) {
  const { runtimePluginRoot, packageRelativePluginRoot = '../../../plugin' } = options;
  let adapted = replaceFrontmatterName(source, spec.sourceName, spec.adapterName);

  const invocationSetting = 'disable-model-invocation: false\n';
  if (!adapted.includes(invocationSetting)) {
    throw new Error('Expected model invocation setting was not found');
  }
  adapted = adapted.replace(invocationSetting, '');
  adapted = adapted.replaceAll('${CLAUDE_PLUGIN_ROOT}', '${CLAUDE_PAPER_PLUGIN_ROOT}');
  adapted = insertAfterFrontmatter(adapted, compatibilityNotice(runtimePluginRoot, packageRelativePluginRoot));

  if (spec.replacesWebuiCommand) {
    const claudeInvocation = 'Invoke:\n\n```\n/claude-paper:webui\n```';
    const portableInvocation = 'Load and follow the `claude-paper-webui` skill.';
    if (!adapted.includes(claudeInvocation)) {
      throw new Error('Expected Claude web UI invocation was not found');
    }
    adapted = adapted.replace(claudeInvocation, portableInvocation);
  }

  for (const reference of spec.crossSkillReferences || []) {
    if (!adapted.includes(reference.source)) {
      throw new Error(`Expected cross-skill reference ${reference.source} was not found`);
    }
    adapted = adapted.replaceAll(reference.source, reference.target);
  }

  if (runtimePluginRoot) {
    adapted = injectInstalledRoot(adapted, runtimePluginRoot);
  }

  return adapted;
}

export async function renderRepoAdapters() {
  const rendered = [];
  for (const spec of adapterSpecs) {
    const source = await readFile(spec.source, 'utf8');
    for (const target of spec.targets) {
      rendered.push({
        ...spec,
        target: target.path,
        content: adaptSkillContent(source, spec, { packageRelativePluginRoot: target.relativePluginRoot }),
      });
    }
  }
  return rendered;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const rendered = await renderRepoAdapters();
  const stale = [];

  for (const item of rendered) {
    let current = null;
    try {
      current = await readFile(item.target, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    if (current === item.content) continue;
    stale.push(path.relative(repoRoot, item.target));
    if (!checkOnly) {
      await mkdir(path.dirname(item.target), { recursive: true });
      await writeFile(item.target, item.content);
    }
  }

  if (checkOnly && stale.length > 0) {
    console.error(`Agent adapters are stale: ${stale.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log(stale.length === 0 ? 'Agent adapters are up to date.' : `Updated ${stale.length} agent adapter(s).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
