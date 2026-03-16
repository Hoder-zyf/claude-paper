import fs from 'fs';
import pdf from 'pdf-parse';

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: node parse-pdf.js <pdf-path>');
  process.exit(1);
}

const SECTION_NAMES = [
  'abstract', 'introduction', 'related work', 'background',
  'preliminary', 'preliminaries', 'method', 'methods', 'methodology',
  'approach', 'proposed method', 'model', 'framework',
  'experiment', 'experiments', 'experimental setup', 'evaluation',
  'results', 'result', 'analysis', 'ablation',
  'discussion', 'limitation', 'limitations',
  'conclusion', 'conclusions', 'conclusion and future work',
  'future work', 'acknowledgement', 'acknowledgements', 'acknowledgment',
  'references', 'bibliography', 'appendix'
];

const SECTION_REGEX = new RegExp(
  '^\\s*(?:(\\d+\\.?(?:\\d+\\.?)*)?\\s*)(' +
  SECTION_NAMES.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') +
  ')\\s*$',
  'im'
);

function detectSections(text) {
  const lines = text.split('\n');
  const sections = [];
  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    const match = line.match(SECTION_REGEX);
    if (match) {
      if (currentSection) {
        sections.push({
          name: currentSection,
          content: currentContent.join('\n').trim()
        });
      }
      currentSection = (match[1] ? match[1] + ' ' : '') + match[2];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentSection) {
    sections.push({
      name: currentSection,
      content: currentContent.join('\n').trim()
    });
  }

  return sections;
}

function extractTitle(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const candidates = lines.slice(0, 15);
  if (candidates.length === 0) return 'Untitled';

  let best = candidates[0];
  for (const line of candidates) {
    const trimmed = line.trim();
    if (trimmed.length > best.trim().length && trimmed.length < 200 &&
        !trimmed.match(/^(arxiv|submitted|accepted|published|copyright|\d{4})/i) &&
        !trimmed.match(/^(university|department|institute|school)/i) &&
        !trimmed.match(/@|\.edu|\.com|\.org/)) {
      best = trimmed;
    }
  }
  return best;
}

function extractAuthors(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const authorLines = lines.slice(0, 20);

  const patterns = [
    /^([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)*[A-Z][a-z]+(?:\s*[,;∗†‡\d]+)*(?:,\s*[A-Z][a-z]+(?:\s+[A-Z]\.?\s*)*[A-Z][a-z]+(?:\s*[,;∗†‡\d]+)*)*)/m,
    /^([A-Z]\.\s*[A-Z][a-z]+(?:,\s*[A-Z]\.\s*[A-Z][a-z]+)*)/m,
    /^([A-Z][a-z]+-[A-Z][a-z]+\s+[A-Z][a-z]+(?:,\s*[A-Z][a-z]+-?[A-Z]?[a-z]*\s+[A-Z][a-z]+)*)/m,
  ];

  for (const line of authorLines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1].length > 5 && match[1].length < 500) {
        return match[1]
          .split(/[,;]/)
          .map(a => a.replace(/[∗†‡\d]/g, '').trim())
          .filter(a => a.length > 2);
      }
    }
  }
  return [];
}

function extractAbstract(text) {
  const match = text.match(/Abstract[:\s—–-]*\n?([\s\S]+?)(?=\n\s*(?:\d+\.?\s*)?(?:Introduction|1\s+Introduction|Keywords|Index Terms))/i);
  if (match) return match[1].replace(/\s+/g, ' ').trim();

  const fallback = text.match(/Abstract[:\s—–-]*\n?([\s\S]{100,2000}?)(?=\n\n)/i);
  if (fallback) return fallback[1].replace(/\s+/g, ' ').trim();

  return '';
}

function extractReferences(text) {
  const refMatch = text.match(/(?:^|\n)\s*(?:References|Bibliography)\s*\n([\s\S]+?)(?=\n\s*(?:Appendix|$))/i);
  if (!refMatch) return [];

  const refText = refMatch[1];
  const refs = refText
    .split(/\n\s*\[(\d+)\]/)
    .filter(r => r.trim() && r.trim().length > 10)
    .map(r => r.replace(/\s+/g, ' ').trim())
    .filter(r => !r.match(/^\d+$/));

  return refs.slice(0, 100);
}

// Suppress pdf-parse internal warnings that pollute stdout
const originalWarn = console.warn;
const originalLog = console.log;

(async () => {
  console.warn = () => {};
  console.log = () => {};

  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdf(dataBuffer);

  console.warn = originalWarn;
  console.log = originalLog;

  const title = extractTitle(data.text);
  const authors = extractAuthors(data.text);
  const abstract = extractAbstract(data.text);
  const sections = detectSections(data.text);
  const references = extractReferences(data.text);

  const githubMatch = data.text.match(/https?:\/\/github\.com\/[^\s\)]+/g);
  const githubLinks = githubMatch || [];

  const codeUrlPatterns = [
    /https?:\/\/(?:www\.)?arxiv\.org\/(?:code|src)\/[^\s\)]+/gi,
    /https?:\/\/(?:www\.)?codeocean\.com\/[^\s\)]+/gi,
    /https?:\/\/(?:www\.)?openreview\.net\/code[^\s\)]+/gi,
    /https?:\/\/(?:www\.)?paperswithcode\.com\/[^\s\)]+/gi,
    /\[code[\^\]]*\]\(https?:\/\/[^\)]+\)/gi
  ];

  const codeLinks = [];
  for (const pattern of codeUrlPatterns) {
    const matches = data.text.match(pattern);
    if (matches) {
      codeLinks.push(...matches.filter(l => !githubLinks.includes(l)));
    }
  }

  const MAX_CONTENT_LENGTH = 150000;
  const truncatedContent = data.text.length > MAX_CONTENT_LENGTH
    ? data.text.substring(0, MAX_CONTENT_LENGTH) + '... [content truncated]'
    : data.text;

  const metadata = {
    title,
    authors,
    abstract,
    content: truncatedContent,
    sections: sections.map(s => ({ name: s.name, contentLength: s.content.length })),
    references,
    githubLinks,
    codeLinks: [...new Set(codeLinks)],
    pageCount: data.numpages
  };

  console.log(JSON.stringify(metadata, null, 2));
})().catch(err => {
  console.error('Error parsing PDF:', err);
  process.exit(1);
});
