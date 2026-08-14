import fs from 'node:fs';
import pdf from 'pdf-parse';
import {
  buildArtifactSummary,
  buildMetadata,
  captureParserDiagnostics,
  writeParseArtifacts,
} from './parse-pdf-core.js';

function printUsage() {
  process.stderr.write('Usage: node parse-pdf.js <pdf-path> [--output-dir <directory>]\n');
}

function parseArguments(argv) {
  let pdfPath = null;
  let outputDir = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--output-dir') {
      outputDir = argv[index + 1];
      if (!outputDir) throw new Error('--output-dir requires a directory');
      index += 1;
    } else if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (!pdfPath) {
      pdfPath = argument;
    } else {
      throw new Error(`Unexpected argument: ${argument}`);
    }
  }

  return { pdfPath, outputDir };
}

let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  printUsage();
  process.exit(1);
}

if (!options.pdfPath) {
  printUsage();
  process.exit(1);
}

(async () => {
  const dataBuffer = fs.readFileSync(options.pdfPath);
  const { value: data, diagnostics } = await captureParserDiagnostics(() => pdf(dataBuffer));
  for (const diagnostic of diagnostics) process.stderr.write(`${diagnostic}\n`);

  const metadata = buildMetadata(data);
  if (options.outputDir) {
    const artifacts = await writeParseArtifacts(options.outputDir, metadata, data.text || '');
    process.stdout.write(`${JSON.stringify(buildArtifactSummary(metadata, artifacts), null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
  }
})().catch((error) => {
  process.stderr.write(`Error parsing PDF: ${error.stack || error.message}\n`);
  process.exit(1);
});
