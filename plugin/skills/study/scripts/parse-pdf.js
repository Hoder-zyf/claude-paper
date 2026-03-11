import fs from 'fs';
import pdf from 'pdf-parse';

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: node parse-pdf.js <pdf-path>');
  process.exit(1);
}

// Suppress pdf-parse internal warnings (e.g. "Warning: TT: undefined function")
// that pollute stdout and break JSON parsing by callers
const originalWarn = console.warn;
const originalLog = console.log;

(async () => {
  // Mute console during PDF parsing to capture only our JSON output
  console.warn = () => {};
  console.log = () => {};

  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdf(dataBuffer);

  // Restore console after parsing
  console.warn = originalWarn;
  console.log = originalLog;

  // Extract title (first line of text)
  const lines = data.text.split('\n').filter(l => l.trim());
  const title = lines[0] || 'Untitled';

  // Extract abstract
  const abstractMatch = data.text.match(/Abstract\s+(.+?)\s+(?=1\. Introduction|Introduction|$)/is);
  const abstract = abstractMatch ? abstractMatch[1].trim() : '';

  // Detect GitHub URLs
  const githubMatch = data.text.match(/https?:\/\/github\.com\/[^\s\)]+/g);
  const githubLinks = githubMatch || [];

  // Detect other code links (arXiv, CodeOcean, etc.)
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

  // Extract authors (basic pattern)
  const authorMatch = data.text.match(/^([A-Z][a-z]+ [A-Z][a-z]+(?:,\s*[A-Z][a-z]+ [A-Z][a-z]+)*)/m);
  const authors = authorMatch ? authorMatch[1].split(',').map(a => a.trim()) : [];

  // Truncate content if too large (max 150000 chars ≈ 37k-50k tokens)
  const MAX_CONTENT_LENGTH = 150000;
  const truncatedContent = data.text.length > MAX_CONTENT_LENGTH
    ? data.text.substring(0, MAX_CONTENT_LENGTH) + '... [content truncated]'
    : data.text;

  const metadata = {
    title,
    authors,
    abstract,
    content: truncatedContent,
    githubLinks,
    codeLinks: [...new Set(codeLinks)], // Remove duplicates
    pageCount: data.numpages
  };

  console.log(JSON.stringify(metadata, null, 2));
})().catch(err => {
  console.error('Error parsing PDF:', err);
  process.exit(1);
});
