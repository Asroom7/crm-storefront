'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const C = require('../storefront-content-core.js');
const p = {
  id: 1,
  name: 'محصول نمونه',
  stockQty: 4,
  isPublished: true,
  prices: [
    { id: 1, label: 'تکی', price: 100000 },
    { id: 2, label: 'دوم', price: 120000 },
  ],
};
const campaign = (rule = { type: 'percent', value: 20 }) => ({
  sections: [
    {
      id: 'pink',
      type: 'campaign',
      enabled: true,
      settings: { productIds: [1], offerV1: { enabled: true, ...rule } },
    },
  ],
});
test('legacy product payload is unchanged when no explicit offer exists', () => {
  const input = [structuredClone(p)];
  assert.equal(C.decorateProducts(input, { sections: [] })[0], input[0]);
  assert.equal(C.offerFor({ sections: [] }, p), null);
});
test('offers apply only to selected enabled published campaign settings in their time interval', () => {
  const config = campaign();
  const st = config.sections[0].settings;
  st.startsAt = '2030-01-01T00:00:00Z';
  st.endsAt = '2030-01-02T00:00:00Z';
  assert.equal(C.offerFor(config, p, Date.parse(st.startsAt) - 1), null);
  assert.equal(C.offerFor(config, p, Date.parse(st.startsAt)).unitPrice, 80000);
  assert.equal(C.offerFor(config, p, Date.parse(st.endsAt)), null);
  assert.equal(C.offerFor(config, { ...p, id: 2 }, Date.parse(st.startsAt)), null);
  config.sections[0].enabled = false;
  assert.equal(C.offerFor(config, p, Date.parse(st.startsAt)), null);
});
test('percentage and per-product fixed overrides use the same authoritative base prices', () => {
  const config = campaign();
  config.sections[0].settings.offerV1.overrides = { 1: { type: 'fixed', value: 5000 } };
  const result = C.decorateProducts([p], config)[0];
  assert.equal(result.salePrice, 95000);
  assert.deepEqual(
    result.prices.map((r) => r.price),
    [95000, 115000],
  );
  assert.equal(result.price, 100000);
  assert.equal(result.storefrontOffer.allowCoupons, false);
  assert.equal(p.prices[0].price, 100000);
});
test('previewing an existing live offer never compounds the discount and removing it restores base prices', () => {
  const first = C.decorateProducts([p], campaign())[0];
  const again = C.decorateProducts([first], campaign())[0];
  assert.equal(again.salePrice, 80000);
  const removed = C.decorateProducts([again], { sections: [] })[0];
  assert.deepEqual(removed.prices, p.prices);
  assert.equal(removed.storefrontOffer, undefined);
});
test('invalid or excessive discounts never create zero, negative or increased prices', () => {
  for (const rule of [
    { type: 'percent', value: 100 },
    { type: 'percent', value: -1 },
    { type: 'fixed', value: 100000 },
    { type: 'fixed', value: 200000 },
    { type: 'fixed', value: 1.5 },
  ])
    assert.equal(C.discounted(100000, rule), 100000);
  assert.equal(C.validateContent(campaign({ type: 'percent', value: 100 }), {}).length, 1);
});
test('manual and hybrid selection preserve priority, remove duplicates and obey exclusions and stock', () => {
  const products = [p, { ...p, id: 2, stockQty: 0 }, { ...p, id: 3 }, { ...p, id: 4, isPublished: false }];
  const section = {
    settings: {
      productIds: [3, 1, 3],
      excludedProductIds: [2],
      editorOptionsV1: { selectionMode: 'hybrid', inStockOnly: true },
    },
  };
  assert.deepEqual(
    C.selectProducts(section, products, [2, 1, 4, 3]).map((p) => p.id),
    [3, 1],
  );
  section.settings.editorOptionsV1.selectionMode = 'auto';
  assert.deepEqual(
    C.selectProducts(section, products, [2, 1, 4, 3]).map((p) => p.id),
    [1, 3],
  );
});
test('automatic fallback and category collection are explicit and bounded', () => {
  const products = [
    { ...p, id: 1, categoryId: 1 },
    { ...p, id: 2, categoryId: 2 },
    { ...p, id: 3, categoryId: 1 },
  ];
  assert.deepEqual(
    C.selectProducts({ settings: { editorOptionsV1: { selectionMode: 'auto' } } }, products, []),
    [],
  );
  assert.deepEqual(
    C.selectProducts(
      { settings: { fallbackMode: 'newest', limit: 2, editorOptionsV1: { selectionMode: 'auto' } } },
      products,
      [],
    ).map((p) => p.id),
    [1, 2],
  );
  assert.deepEqual(
    C.selectProducts({ settings: { collectionMode: 'category', categoryId: 1 } }, products).map((p) => p.id),
    [1, 3],
  );
});
test('education publishing excludes drafts, archives and future records without modifying the library', () => {
  const now = Date.parse('2030-01-01T00:00:00Z'),
    theme = {
      educationLibraryV1: {
        enabled: true,
        items: [
          { id: 'a', status: 'published' },
          { id: 'b', status: 'draft' },
          { id: 'c', status: 'archived' },
          { id: 'd', status: 'published', publishAt: '2031-01-01T00:00:00Z' },
        ],
      },
    };
  const before = structuredClone(theme);
  assert.deepEqual(
    C.lessons(theme, now).map((r) => r.id),
    ['a'],
  );
  assert.equal(C.lessons(theme, now, true).length, 4);
  assert.deepEqual(theme, before);
});
test('home education priority remains independent from the library order and newest/hybrid selection is deterministic', () => {
  const theme = {
    educationLibraryV1: {
      enabled: true,
      items: [
        { id: 'a', status: 'published', createdAt: '2029-01-01' },
        { id: 'b', status: 'published', createdAt: '2030-01-01' },
        { id: 'c', status: 'published', createdAt: '2028-01-01' },
      ],
    },
  };
  const s = { settings: { lessonIds: ['c', 'a'], educationMode: 'manual' } };
  assert.deepEqual(
    C.selectLessons(s, theme).map((r) => r.id),
    ['c', 'a'],
  );
  s.settings.educationMode = 'hybrid';
  assert.deepEqual(
    C.selectLessons(s, theme).map((r) => r.id),
    ['c', 'a', 'b'],
  );
  s.settings.educationMode = 'newest';
  assert.deepEqual(
    C.selectLessons(s, theme).map((r) => r.id),
    ['b', 'a', 'c'],
  );
  assert.deepEqual(
    theme.educationLibraryV1.items.map((r) => r.id),
    ['a', 'b', 'c'],
  );
});
test('content validation rejects duplicate lesson IDs, missing videos and invalid scheduling', () => {
  const lesson = { id: 'a', title: 'آموزش', url: 'https://media.example.test/one.mp4', status: 'published' };
  assert.deepEqual(
    C.validateContent({ sections: [] }, { educationLibraryV1: { enabled: true, items: [lesson] } }),
    [],
  );
  assert.ok(
    C.validateContent(
      { sections: [] },
      {
        educationLibraryV1: {
          items: [lesson, { ...lesson, url: 'javascript:alert(1)', publishAt: 'invalid' }],
        },
      },
    ).length >= 3,
  );
});

test('explicit section visibility is authoritative for campaign activation', () => {
  const c = campaign();
  c.sections[0].enabled = false;
  c.sections[0].settings.editorOptionsV1 = { visible: true };
  assert.equal(C.offerFor(c, p).unitPrice, 80000);
  c.sections[0].settings.editorOptionsV1.visible = false;
  assert.equal(C.offerFor(c, p), null);
});
