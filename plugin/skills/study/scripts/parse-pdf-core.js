import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'node:util';

export const MAX_CONTENT_LENGTH = 50000;

export async function captureParserDiagnostics(operation) {
  const diagnostics = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const capture = (...args) => diagnostics.push(format(...args));

  console.log = capture;
  console.warn = capture;
  try {
    return { value: await operation(), diagnostics };
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

export function buildMetadata(data) {
  const fullText = typeof data.text === 'string' ? data.text : '';
  const lines = fullText.split('\n').filter((line) => line.trim());
  const title = lines[0] || 'Untitled';
  const abstractMatch = fullText.match(/Abstract\s+(.+?)\s+(?=1\. Introduction|Introduction|$)/is);
  const abstract = abstractMatch ? abstractMatch[1].trim() : '';
  const githubMatch = fullText.match(/https?:\/\/github\.com\/[^\s\)]+/g);
  const githubLinks = githubMatch || [];
  const codeUrlPatterns = [
    /https?:\/\/(?:www\.)?arxiv\.org\/(?:code|src)\/[^\s\)]+/gi,
    /https?:\/\/(?:www\.)?codeocean\.com\/[^\s\)]+/gi,
    /https?:\/\/(?:www\.)?openreview\.net\/code[^\s\)]+/gi,
    /https?:\/\/(?:www\.)?paperswithcode\.com\/[^\s\)]+/gi,
    /\[code[\^\]]*\]\(https?:\/\/[^\)]+\)/gi,
  ];

  const codeLinks = [];
  for (const pattern of codeUrlPatterns) {
    const matches = fullText.match(pattern);
    if (matches) codeLinks.push(...matches.filter((link) => !githubLinks.includes(link)));
  }

  const authorMatch = fullText.match(/^([A-Z][a-z]+ [A-Z][a-z]+(?:,\s*[A-Z][a-z]+ [A-Z][a-z]+)*)/m);
  const authors = authorMatch ? authorMatch[1].split(',').map((author) => author.trim()) : [];
  const contentTruncated = fullText.length > MAX_CONTENT_LENGTH;
  const content = contentTruncated
    ? `${fullText.substring(0, MAX_CONTENT_LENGTH)}... [content truncated; see paper.txt for full text]`
    : fullText;

  return {
    title,
    authors,
    abstract,
    content,
    contentTruncated,
    fullTextLength: fullText.length,
    githubLinks,
    codeLinks: [...new Set(codeLinks)],
    pageCount: data.numpages,
  };
}

export async function writeParseArtifacts(outputDir, metadata, fullText) {
  const resolvedOutputDir = path.resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });

  const metaPath = path.join(resolvedOutputDir, 'meta.json');
  const fullTextPath = path.join(resolvedOutputDir, 'paper.txt');
  const unique = `${process.pid}-${randomUUID()}`;
  const temporaryMetaPath = path.join(resolvedOutputDir, `.meta.json.${unique}.tmp`);
  const temporaryTextPath = path.join(resolvedOutputDir, `.paper.txt.${unique}.tmp`);
  const persistedMetadata = { ...metadata, fullTextFile: 'paper.txt' };

  try {
    await Promise.all([
      writeFile(temporaryMetaPath, `${JSON.stringify(persistedMetadata, null, 2)}\n`, 'utf8'),
      writeFile(temporaryTextPath, fullText, 'utf8'),
    ]);
    await rename(temporaryTextPath, fullTextPath);
    await rename(temporaryMetaPath, metaPath);
  } finally {
    await Promise.all([
      rm(temporaryMetaPath, { force: true }),
      rm(temporaryTextPath, { force: true }),
    ]);
  }

  return { metaPath, fullTextPath };
}

export function buildArtifactSummary(metadata, artifacts) {
  return {
    title: metadata.title,
    authors: metadata.authors,
    abstract: metadata.abstract,
    githubLinks: metadata.githubLinks,
    codeLinks: metadata.codeLinks,
    pageCount: metadata.pageCount,
    contentTruncated: metadata.contentTruncated,
    contentPreviewLength: metadata.content.length,
    fullTextLength: metadata.fullTextLength,
    metaPath: artifacts.metaPath,
    fullTextPath: artifacts.fullTextPath,
  };
}
