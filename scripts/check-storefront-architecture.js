'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;

function read(file) {
  const target = path.join(ROOT, file);
  if (!fs.existsSync(target)) {
    fail(`${file} وجود ندارد`);
    return '';
  }
  return fs.readFileSync(target, 'utf8');
}

function ok(condition, message) {
  if (condition) console.log(`✓ ${message}`);
  else fail(message);
}

function fail(message) {
  failures += 1;
  console.error(`✗ ${message}`);
}

function includesAll(text, tokens, label) {
  tokens.forEach((token) => ok(text.includes(token), `${label}: ${token}`));
}

const index = read('index.html');
const home = read('storefront-home.js');
const editor = read('panel/storefront-editor.js');
const panel = read('panel/index.html');
const legacy = read('panel/legacy-merge.js');
const intro = read('cinematic-intro.js');
const qa = read('storefront-qa.js');

includesAll(index, [
  'id="storefront-home-root"',
  'storefront-home.js',
  'storefront-qa.css',
  'storefront-qa.js',
  'class="skip-link"',
  'rel="canonical"',
], 'Home shell');

[
  'search', 'hero', 'categories', 'product-collection', 'best-sellers',
  'campaign', 'videos', 'banner', 'support-banner', 'trust', 'footer',
].forEach((type) => ok(home.includes(`registerSection('${type}'`), `Section registry: ${type}`));

includesAll(home, [
  "apiFetch('/storefront/public/'",
  "apiFetch('/storefront-insights/public/'",
  'serverNow',
  'clockSkewMs',
  'preload="none"',
  'loading="lazy"',
  'renderFallback',
  'storefront-preview-config',
], 'Storefront runtime');

includesAll(editor, [
  'data-section-toggle',
  'data-section-up',
  'data-section-down',
  'data-section-edit',
  'data-section-duplicate',
  'data-section-delete',
  'draggable="true"',
  'data-device="desktop"',
  'data-device="tablet"',
  'data-device="mobile"',
  '/storefront/editor/home',
  '/storefront/editor/home/publish',
  '/storefront/editor/home/versions',
  '/storefront/media',
  'ذخیره پیش‌نویس',
  'انتشار روی سایت',
  'هویت بصری',
], 'Visual Editor');

includesAll(panel, [
  'legacy-merge.js',
  'neumorphism.css',
  'storefront-editor.js',
  'storefront-editor-router.js',
  'qa-accessibility.css',
], 'Panel composition');

includesAll(legacy, [
  'مرکز پیگیری',
  'renderProductDetail',
  'productRevenue',
], 'Legacy safe merge');

includesAll(intro, [
  'prefers-reduced-motion',
  'sessionStorage',
], 'Cinematic intro safeguards');

includesAll(qa, [
  'IntersectionObserver',
  'aria-expanded',
  "event.key !== 'Escape'",
], 'Runtime accessibility');

ok(!/javascript\s*:/i.test(home + editor), 'Dynamic storefront/editor do not emit javascript: URLs');
ok(!/document\.write\s*\(/.test(home + editor + qa), 'No document.write in dynamic runtime');

const ids = [...index.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
ok(duplicates.length === 0, `Home HTML has no duplicate ids${duplicates.length ? `: ${duplicates.join(', ')}` : ''}`);

if (failures) {
  console.error(`\n${failures} storefront architecture check(s) failed.`);
  process.exit(1);
}
console.log('\nStorefront architecture regression checks passed.');
