#!/usr/bin/env node
// encode-screenshots.js — bundled with generate-test-report and generate-bug-report skills
//
// Usage: node encode-screenshots.js '<json-array-of-paths>'
//   Input : JSON array of file path strings, e.g. '["a.png","b.jpg"]'
//   Output: JSON array of {path, data_uri} objects printed to stdout
//           data_uri is null when the file cannot be read (not found, permission error)
//
// Why this script exists instead of inline bash:
//   - Inline `node -e` scripts with template literals (backticks) break bash quoting
//   - python3 is not available on Windows; node.js always is
//   - A file-based script avoids all shell-quoting edge cases

const fs = require('fs');

const input = process.argv[2];
if (!input) {
  process.stderr.write('encode-screenshots: no input provided\n');
  process.exit(1);
}

let paths;
try {
  paths = JSON.parse(input);
} catch (e) {
  process.stderr.write('encode-screenshots: invalid JSON input: ' + e.message + '\n');
  process.exit(1);
}

if (!Array.isArray(paths)) {
  process.stderr.write('encode-screenshots: input must be a JSON array\n');
  process.exit(1);
}

const MIME_MAP = {
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  gif:  'image/gif',
  webp: 'image/webp',
};

function getMime(filePath) {
  const lastDot = filePath.lastIndexOf('.');
  const ext = lastDot !== -1 ? filePath.slice(lastDot + 1).toLowerCase() : '';
  return MIME_MAP[ext] || 'image/png';
}

const results = paths.map(function(item) {
  const p = item; // caller always passes plain path strings (see SKILL.md Phase 2)
  const mime = getMime(p);
  try {
    const data = fs.readFileSync(p);
    return { path: p, data_uri: 'data:' + mime + ';base64,' + data.toString('base64') };
  } catch (e) {
    return { path: p, data_uri: null };
  }
});

process.stdout.write(JSON.stringify(results) + '\n');
