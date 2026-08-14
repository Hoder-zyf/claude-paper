import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  MAX_CONTENT_LENGTH,
  buildArtifactSummary,
  buildMetadata,
  captureParserDiagnostics,
  writeParseArtifacts,
} from '../plugin/skills/study/scripts/parse-pdf-core.js';

test('parser diagnostics are captured without polluting JSON stdout', async () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const result = await captureParserDiagnostics(async () => {
    console.log('Warning: TT: undefined function: 3');
    console.warn('second diagnostic');
    return { text: 'parsed' };
  });

  assert.deepEqual(result.value, { text: 'parsed' });
  assert.deepEqual(result.diagnostics, [
    'Warning: TT: undefined function: 3',
    'second diagnostic',
  ]);
  assert.equal(console.log, originalLog);
  assert.equal(console.warn, originalWarn);
});

test('metadata preserves legacy fields and marks its 50k content as a preview', () => {
  const fullText = [
    'A Useful Paper',
    'Jane Doe, John Smith',
    'Abstract This is the abstract. 1. Introduction',
    'https://github.com/example/research',
    'x'.repeat(MAX_CONTENT_LENGTH + 2000),
  ].join('\n');
  const metadata = buildMetadata({ text: fullText, numpages: 12 });

  assert.equal(metadata.title, 'A Useful Paper');
  assert.deepEqual(metadata.authors, ['Jane Doe', 'John Smith']);
  assert.equal(metadata.abstract, 'This is the abstract.');
  assert.deepEqual(metadata.githubLinks, ['https://github.com/example/research']);
  assert.equal(metadata.pageCount, 12);
  assert.equal(metadata.fullTextLength, fullText.length);
  assert.equal(metadata.contentTruncated, true);
  assert.ok(metadata.content.startsWith(fullText.slice(0, MAX_CONTENT_LENGTH)));
  assert.match(metadata.content, /see paper\.txt for full text\]$/);
});

test('artifact mode writes complete text and parseable metadata atomically', async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'claude-paper-parse-test-'));
  try {
    const fullText = `Title\n${'complete text '.repeat(5000)}`;
    const metadata = buildMetadata({ text: fullText, numpages: 7 });
    const artifacts = await writeParseArtifacts(sandbox, metadata, fullText);
    const savedMetadata = JSON.parse(await readFile(artifacts.metaPath, 'utf8'));
    const savedText = await readFile(artifacts.fullTextPath, 'utf8');
    const summary = buildArtifactSummary(metadata, artifacts);

    assert.equal(savedText, fullText);
    assert.equal(savedMetadata.fullTextFile, 'paper.txt');
    assert.equal(savedMetadata.fullTextLength, fullText.length);
    assert.equal(summary.fullTextPath, path.join(sandbox, 'paper.txt'));
    assert.equal(summary.metaPath, path.join(sandbox, 'meta.json'));
    assert.equal('content' in summary, false);
    assert.deepEqual((await readdir(sandbox)).sort(), ['meta.json', 'paper.txt']);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
