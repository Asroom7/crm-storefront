'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../panel/storefront-editor-model');
const data = () => ({
  config: {
    sections: [
      {
        id: 'videos',
        type: 'videos',
        enabled: true,
        content: { title: 'ویدیو' },
        settings: { videoUrls: ['https://media.test/original.mp4'], legacyFlag: 'keep' },
      },
      {
        id: 'best',
        type: 'best-sellers',
        enabled: true,
        content: { title: 'پرفروش' },
        settings: { productIds: [3, 1] },
      },
      { id: 'categories', type: 'categories', enabled: true, content: {}, settings: {} },
    ],
  },
  theme: { primaryColor: '#cf4772', unknownToken: { keep: true } },
});
test('opening/snapshot preserves order, missing fields and opaque metadata exactly', () => {
  const raw = data(),
    copy = M.snapshot(raw.config, raw.theme);
  assert.deepEqual(copy, raw);
  assert.equal(copy.config.sections.length, 3);
  assert.equal('paddingTop' in copy.config.sections[0].settings, false);
  copy.config.sections[0].content.title = 'edited';
  assert.equal(raw.config.sections[0].content.title, 'ویدیو');
});
test('saved draft can be clean while still differing from the published snapshot', () => {
  const live = data(),
    draft = data();
  draft.config.sections[1].content.title = 'جدید';
  const saved = M.clone(draft);
  assert.equal(M.equal(draft, saved), true);
  assert.equal(M.diff(live, draft).length, 1);
  assert.equal(M.diff(live, draft)[0].fields[0].path, 'content.title');
});
test('restoring a section preserves the other sections, their metadata and order', () => {
  const current = data(),
    old = data();
  old.config.sections.reverse();
  old.config.sections.find((s) => s.id === 'best').content.title = 'قدیمی';
  const restored = M.restoreSection(current, old, 'best');
  assert.deepEqual(
    restored.config.sections.map((s) => s.id),
    ['videos', 'best', 'categories'],
  );
  assert.deepEqual(restored.config.sections[0], current.config.sections[0]);
  assert.equal(restored.config.sections[1].content.title, 'قدیمی');
});
test('media references include live data even after its draft reference is removed', () => {
  const live = data(),
    draft = data();
  draft.config.sections[0].settings.videoUrls = [];
  const refs = M.references('https://media.test/original.mp4', [
    { scope: 'draft', data: draft },
    { scope: 'live', data: live },
  ]);
  assert.equal(refs.length, 1);
  assert.equal(refs[0].scope, 'live');
  assert.equal(refs[0].owner, 'videos');
});
test('replacement updates exact image/video references in draft without touching input', () => {
  const raw = data();
  raw.config.sections[0].content.imageMobileUrl = 'https://media.test/original.mp4';
  const next = M.replaceMedia(raw.config, 'https://media.test/original.mp4', 'https://media.test/new.mp4');
  assert.equal(next.sections[0].settings.videoUrls[0], 'https://media.test/new.mp4');
  assert.equal(next.sections[0].content.imageMobileUrl, 'https://media.test/new.mp4');
  assert.equal(raw.config.sections[0].settings.videoUrls[0], 'https://media.test/original.mp4');
});
test('changing independent mobile controls does not fill desktop/shared defaults', () => {
  const raw = data();
  M.setPath(raw.config.sections[1], 'settings.editorOptionsV1.mobile.gap', 18);
  assert.deepEqual(raw.config.sections[1].settings.editorOptionsV1, { mobile: { gap: 18 } });
  assert.equal(raw.theme.unknownToken.keep, true);
});
test('validation rejects duplicate ids, reversed campaign dates and unsafe links', () => {
  const raw = data();
  raw.config.sections[1].id = 'videos';
  raw.config.sections[0].content.ctaUrl = 'javascript:alert(1)';
  raw.config.sections[0].settings.startsAt = '2026-10-16';
  raw.config.sections[0].settings.endsAt = '2026-10-15';
  assert.equal(M.validate(raw).length, 3);
  assert.equal(M.safeUrl('product-detail.html?id=3'), true);
  assert.equal(M.safeUrl('data:text/html,<script>'), false);
});
test('field paths cannot modify prototypes', () => {
  assert.throws(() => M.setPath({}, '__proto__.polluted', true));
  assert.equal({}.polluted, undefined);
});
test('replacing a video keeps the poster mapped to its new URL', () => {
  const raw = data(),
    oldUrl = 'https://media.test/original.mp4',
    newUrl = 'https://media.test/new.mp4';
  raw.config.sections[0].settings.videoPosters = { [oldUrl]: 'https://media.test/poster.webp' };
  const updated = M.replaceMedia(raw.config, oldUrl, newUrl);
  assert.equal(updated.sections[0].settings.videoPosters[newUrl], 'https://media.test/poster.webp');
  assert.equal(updated.sections[0].settings.videoPosters[oldUrl], undefined);
  assert.equal(M.references(oldUrl, [{ scope: 'draft', data: raw }]).length, 2);
});
test('recovery is page-scoped, expires and never applies automatically', () => {
  const raw = data(),
    entry = { version: 1, pageId: 4, savedAt: Date.now(), server: raw, snapshot: raw },
    storage = { getItem: () => JSON.stringify(entry) };
  assert.deepEqual(M.readBackup(storage, 'key', 4), entry);
  assert.equal(M.readBackup(storage, 'key', 5), null);
  entry.savedAt = Date.now() - 8 * 86400000;
  assert.equal(M.readBackup(storage, 'key', 4), null);
});
