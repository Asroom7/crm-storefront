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
const educationJs = read('storefront-education.js');
const educationCss = read('storefront-education.css');
const editor = read('panel/storefront-editor.js');
const panel = read('panel/index.html');
const legacy = read('panel/legacy-merge.js');
const intro = read('cinematic-intro.js');
const qa = read('storefront-qa.js');
const qaCss = read('storefront-qa.css');

includesAll(index, [
  'id="storefront-home-root"',
  'storefront-home.js',
  'storefront-education.css',
  'storefront-education.js',
  'storefront-qa.css',
  'storefront-qa.js',
  'class="skip-link"',
  'rel="canonical"',
], 'Home shell');

// The current requested primary flow intentionally omits the legacy hero and
// generic product collection. Keep this list in sync with REQUESTED in
// storefront-home.js instead of requiring retired section types.
[
  'search', 'videos', 'best-sellers', 'campaign', 'categories',
].forEach((type) => ok(home.includes(`registerSection('${type}'`), `Section registry: ${type}`));

ok(home.includes('function footer(') && home.includes('sf-footer'), 'Home footer renderer');

includesAll(home, [
  "apiFetch('/storefront/public/'",
  "apiFetch('/storefront-insights/public/'",
  'serverNow',
  'clockSkewMs',
  'preload="metadata"',
  'loading="lazy"',
  'sf-load-error',
  'storefront-preview-config',
], 'Storefront runtime');

includesAll(educationCss, [
  'min-height:33svh',
  'grid-auto-columns:min(65vw,270px)',
  'scroll-snap-type:x mandatory',
  'aspect-ratio:9/16',
], 'Education rail CSS');

includesAll(educationJs, [
  "allLink.href='education.html'",
  'video.autoplay=false',
  "video.preload='metadata'",
  'other.pause()',
], 'Education rail runtime');

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

includesAll(intro, ['sessionStorage', 'HANDOFF_MS = 1000'], 'Cinematic intro safeguards');
includesAll(qaCss, ['prefers-reduced-motion', 'focus-visible', 'forced-colors'], 'Accessibility CSS');

includesAll(qa, [
  'IntersectionObserver',
  'aria-expanded',
  "event.key !== 'Escape'",
], 'Runtime accessibility');

ok(!/javascript\s*:/i.test(home + educationJs + editor), 'Dynamic storefront/editor do not emit javascript: URLs');
ok(!/document\.write\s*\(/.test(home + educationJs + editor + qa), 'No document.write in dynamic runtime');

const ids = [...index.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
ok(duplicates.length === 0, `Home HTML has no duplicate ids${duplicates.length ? `: ${duplicates.join(', ')}` : ''}`);

if (failures) {
  console.error(`\n${failures} storefront architecture check(s) failed.`);
  process.exit(1);
}
console.log('\nStorefront architecture regression checks passed.');
