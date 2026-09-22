'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules']);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function fail(messages) {
  messages.forEach((message) => console.error(`ERROR: ${message}`));
  process.exitCode = 1;
}

const errors = [];
const files = walk(ROOT);

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const label = rel(file);

  const ids = new Map();
  for (const match of html.matchAll(/\bid=["']([^"']+)["']/gi)) {
    ids.set(match[1], (ids.get(match[1]) || 0) + 1);
  }
  for (const [id, count] of ids) {
    if (count > 1) errors.push(`${label}: duplicate id "${id}" (${count} times)`);
  }

  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  let scriptIndex = 0;
  while ((scriptMatch = scriptRe.exec(html))) {
    scriptIndex += 1;
    if (/\bsrc\s*=/i.test(scriptMatch[1])) continue;
    const code = scriptMatch[2].trim();
    if (!code) continue;
    try {
      // Parse only. The code is not executed.
      new Function(code);
    } catch (error) {
      errors.push(`${label}: inline script #${scriptIndex} syntax error: ${error.message}`);
    }
  }

  const refRe = /<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(refRe)) {
    const ref = match[1].trim();
    if (!ref || ref.startsWith('#') || /^(?:https?:|data:|\/\/)/i.test(ref)) continue;
    const clean = ref.split(/[?#]/)[0];
    if (!clean || !/\.(?:js|css)$/i.test(clean)) continue;
    const resolved = path.resolve(path.dirname(file), clean);
    if (!fs.existsSync(resolved)) errors.push(`${label}: missing local asset ${ref}`);
  }
}

if (errors.length) {
  fail(errors);
} else {
  console.log(`Checked ${files.length} HTML files: inline scripts, duplicate IDs, and local JS/CSS references look valid.`);
}
