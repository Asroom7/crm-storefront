'use strict';
const assert = require('node:assert/strict'),
  path = require('node:path');
const { chromium } = require('playwright');
const { server, fixture, editor, setup } = require('./storefront-editor-browser.cjs');
const output = process.env.EDITOR_QA_OUTPUT || path.resolve(__dirname, '../../editor-qa/screenshots');
const settle = (p) =>
  p.waitForFunction(
    () =>
      !StorefrontEditorComplete.state.saving &&
      StorefrontEditorModel.equal(
        StorefrontEditorComplete.state.server,
        StorefrontEditorModel.snapshot(
          StorefrontEditorComplete.state.config,
          StorefrontEditorComplete.state.theme,
        ),
      ),
  );
const frame = (p) => p.frames().find((f) => f.parentFrame());
const close = (p) => p.locator('[data-overlay] [data-action="close"]').first().click();
async function addLesson(p, title) {
  await p.locator('[data-action="studio-library"]').click();
  await p.locator('[data-studio="lesson-new"]').click();
  await p.locator('[data-studio-field="title"]').fill(title);
  await p.locator('[data-studio-field="topic"]').fill('روش استفاده');
  await p.locator('[data-studio-field="description"]').fill('توضیح **مهم** آموزش');
  await p.locator('[data-studio="lesson-video"]').click();
  await close(p);
  assert.equal(await p.locator('[data-studio-field="title"]').inputValue(), title);
  await p.locator('[data-studio="lesson-video"]').click();
  if (title === 'آموزش اول') {
    await p.locator('[data-media-file]').setInputFiles({
      name: 'training.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('isolated upload fixture'),
    });
    await p.locator('[data-upload-status]').filter({ hasText: 'فایل آپلود شد' }).waitFor();
    await p.locator('[data-action="use-media"][data-id="3"]').click();
  } else await p.locator('[data-action="use-media"][data-id="2"]').click();
  assert.equal(await p.locator('[data-studio-field="title"]').inputValue(), title);
  await p.locator('[data-studio="lesson-poster"]').click();
  await p.locator('[data-action="use-media"][data-id="1"]').click();
  await p.locator('[data-studio-field="status"]').selectOption('published');
  await p.locator('[data-studio="lesson-products"]').click();
  await p.locator('[data-studio-pick="1"]').check();
  await p.locator('[data-studio="pick-apply"]').click();
  await p.locator('[data-studio="lesson-save"]').click();
  await close(p);
  await settle(p);
}
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({
    executablePath: process.env.EDITOR_CHROMIUM_PATH || undefined,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
    ],
  });
  try {
    const state = fixture(origin),
      ui = await editor(browser, origin, state),
      p = ui.page;
    const original = JSON.stringify({ config: state.page.config, theme: state.page.theme });
    for (const action of ['studio-library', 'studio-categories', 'studio-menu']) {
      await p.locator('[data-action="' + action + '"]').click();
      await close(p);
    }
    assert.equal(state.writes.length, 0);
    assert.equal(JSON.stringify({ config: state.page.config, theme: state.page.theme }), original);
    await p.route('https://crm-backend-apj4.onrender.com/api/storefront/media/upload', async (route) => {
      const asset = {
        id: 3,
        kind: 'video',
        url: origin + '/fixtures/training.mp4',
        altText: 'آموزش آپلودشده',
        bytes: 2000,
        duration: 20,
      };
      state.assets.push(asset);
      state.writes.push({ method: 'POST', name: '/storefront/media/upload' });
      await route.fulfill({ json: asset });
    });
    await addLesson(p, 'آموزش اول');
    await addLesson(p, 'آموزش دوم');
    const ids = state.page.theme.educationLibraryV1.items.map((r) => r.id);
    assert.equal(
      state.page.publishedTheme.educationLibraryV1,
      undefined,
      'saving lessons changed the live library',
    );
    await p.locator('[data-select="videos"]').click();
    await p.locator('[data-tab="content"]').click();
    await p.locator('[data-action="studio-choose-lessons"]').click();
    for (const id of ids) await p.locator('[data-studio-pick="' + id + '"]').check();
    await p.locator('[data-studio-priority="1"]').fill('1');
    await p.locator('[data-studio-priority="1"]').press('Tab');
    await p.locator('[data-studio="pick-apply"]').click();
    await settle(p);
    await frame(p)
      .locator('[data-lesson-id="' + ids[1] + '"]')
      .waitFor();
    assert.deepEqual(
      await frame(p)
        .locator('[data-lesson-id]')
        .evaluateAll((nodes) => nodes.map((n) => n.dataset.lessonId)),
      [ids[1], ids[0]],
    );
    assert.deepEqual(
      state.page.theme.educationLibraryV1.items.map((r) => r.id),
      ids,
      'homepage ordering changed the library order',
    );
    assert.match(await frame(p).locator('[data-lesson-id]').first().innerText(), /آموزش دوم/);
    await p.locator('[data-action="review"]').click();
    await p.waitForFunction(() => StorefrontEditorComplete.state.reviewReady);
    if (await p.locator('[data-preflight-ack]').count()) await p.locator('[data-preflight-ack]').check();
    await p.locator('[data-action="publish"]').click();
    await p.waitForFunction(
      () =>
        !StorefrontEditorComplete.state.publishing &&
        StorefrontEditorComplete.state.published.theme.educationLibraryV1?.items.length === 2,
    );
    await frame(p).locator('[data-education-nav]').waitFor({ state: 'attached' });
    const otherPage = await ui.context.newPage();
    await setup(otherPage, state);
    await otherPage.goto(origin + '/new/products.html');
    await otherPage.locator('[data-education-nav]').waitFor({ state: 'attached' });
    await otherPage.close();
    const education = await ui.context.newPage();
    await setup(education, state);
    await education.goto(origin + '/new/education.html');
    await education.locator('[data-lesson-id]').first().waitFor();
    assert.equal(await education.locator('[data-lesson-id]').count(), 2);
    await education.locator('[data-education-query]').fill('دوم');
    assert.equal(await education.locator('[data-lesson-id]').count(), 1);
    assert.equal(await education.locator('[data-lesson-id]').getAttribute('data-lesson-id'), ids[1]);
    await education.close();
    console.log(
      'PASS read-only management, independent library, media selection, related products, priority, publication and education search',
    );

    await p.locator('[data-action="add"]').click();
    await p.locator('[data-action="studio-new"][data-template="text"]').click();
    const builderId = await p.evaluate(() => StorefrontEditorComplete.state.activeSection);
    await p.locator('[data-field="content.title"]').fill('بخش اختصاصی');
    await p.locator('[data-action="studio-element"][data-index="1"]').click();
    await p.locator('[data-studio-field="text"]').fill('متن **برجسته**\nخط دوم');
    await p.locator('[data-studio="element-save"]').click();
    await frame(p)
      .locator('[data-editor-section="' + builderId + '"] strong')
      .waitFor();
    await p.locator('[data-action="studio-element-add"][data-kind="image"]').click();
    await p.locator('[data-studio="element-media"]').click();
    await p.locator('[data-action="use-media"][data-id="1"]').click();
    await p.locator('[data-studio-field="alt"]').fill('عکس نمونه');
    await p.locator('[data-studio="element-save"]').click();
    await frame(p)
      .locator('[data-editor-section="' + builderId + '"] img[alt="عکس نمونه"]')
      .waitFor();
    await p.locator('[data-action="studio-position"]').click();
    await p.locator('[data-studio-field="after"]').selectOption('videos');
    await p.locator('[data-studio="position-save"]').click();
    await p.waitForFunction((id) => {
      const doc = StorefrontEditorComplete.state.iframe.contentDocument;
      return doc.querySelector('.sf-video-section')?.nextElementSibling?.dataset.editorSection === id;
    }, builderId);
    await settle(p);
    await p.waitForTimeout(350);
    await p.evaluate(() => {
      window.studioMutations = 0;
      new MutationObserver((rows) => (window.studioMutations += rows.length)).observe(
        StorefrontEditorComplete.state.iframe.contentDocument.getElementById('storefront-home-root'),
        { childList: true },
      );
    });
    await p.waitForTimeout(900);
    assert.ok(
      (await p.evaluate(() => studioMutations)) < 5,
      'custom insertion created a primary-flow mutation loop',
    );
    await p.locator('[data-tab="layout"]').click();
    await p.locator('[data-scope="mobile"]').click();
    await p.locator('[data-field="settings.builderDesignV1.mobile.background"]').fill('#114455');
    await settle(p);
    assert.equal(
      state.page.config.sections.find((s) => s.id === builderId).settings.builderDesignV1.desktop,
      undefined,
    );
    await p.locator('[data-tab="content"]').click();
    await p.locator('[data-action="studio-template-save"]').click();
    await p.locator('[data-studio-field="name"]').fill('قالب من');
    await p.locator('[data-studio="template-save"]').click();
    await p.locator('[data-action="add"]').click();
    assert.equal(await p.locator('[data-action="studio-use-template"]').count(), 1);
    await close(p);
    assert.ok(
      await p.locator('.sfe-topbar').evaluate((el) => el.getBoundingClientRect().top >= 70),
      'editor toolbar was hidden behind the app header',
    );
    await p.screenshot({ path: path.join(output, 'content-studio-desktop.png'), animations: 'disabled' });
    console.log(
      'PASS custom content, escaped formatting, images, fixed section positions, device-scoped design and reusable templates',
    );

    await p.locator('[data-select="campaign"]').click();
    await p.locator('[data-tab="content"]').click();
    await p.locator('[data-action="studio-offer"]').click();
    await p.locator('[data-studio-field="enabled"]').check();
    await p.locator('[data-studio-field="value"]').fill('20');
    await p.locator('[data-offer-id="1"]').fill('10');
    assert.match(await p.locator('[data-offer-price="1"]').innerText(), /۶۲۱/);
    await p.locator('[data-studio="offer-save"]').click();
    await settle(p);
    await frame(p).locator('.sf-pink-product-card .sf-product-price').filter({ hasText: '۶۲۱' }).waitFor();
    assert.equal(
      state.page.publishedConfig.sections.find((s) => s.type === 'campaign').settings.offerV1,
      undefined,
    );
    console.log('PASS actual-offer preview, per-product overrides and draft/live isolation');

    await p.locator('[data-action="studio-menu"]').click();
    await p.locator('[data-studio-field="enabled"]').check();
    await p.locator('[data-studio="menu-save"]').click();
    await frame(p).locator('[data-editor-menu] a[href$="education.html"]').waitFor({ state: 'attached' });
    await p.locator('[data-action="studio-menu"]').click();
    await p.locator('[data-studio-field="enabled"]').uncheck();
    await p.locator('[data-studio="menu-save"]').click();
    await p.waitForFunction(
      () => !StorefrontEditorComplete.state.iframe.contentDocument.querySelector('[data-editor-menu]'),
    );
    assert.equal(
      await frame(p)
        .locator('.side-menu>a[href="products.html"]')
        .evaluate((el) => el.style.display),
      '',
    );
    assert.deepEqual(ui.errors, []);
    await ui.context.close();
    console.log('PASS custom menu opt-in and exact restoration');

    const cats = fixture(origin),
      cu = await editor(browser, origin, cats),
      cp = cu.page;
    await cp.route('https://crm-backend-apj4.onrender.com/api/categories**', async (route) => {
      const req = route.request(),
        u = new URL(req.url());
      if (req.method() === 'GET') return route.fallback();
      const body = req.postDataJSON();
      cats.writes.push({ name: u.pathname, method: req.method(), body });
      if (req.method() === 'POST') {
        const c = { id: 5, ...body, updatedAt: '2026-10-16T00:00:00.000Z' };
        cats.categories.push(c);
        return route.fulfill({ json: c });
      }
      const c = cats.categories.find((c) => c.id === Number(u.pathname.split('/')[3]));
      Object.assign(c, body);
      return route.fulfill({ json: c });
    });
    await cp.locator('[data-action="studio-categories"]').click();
    await cp.locator('[data-studio="category-new"]').click();
    await cp.locator('[data-studio-field="name"]').fill('دستهٔ تصویری');
    await cp.locator('[data-studio="category-image"]').click();
    await cp.locator('[data-action="use-media"][data-id="1"]').click();
    await cp.locator('[data-studio="category-save"]').click();
    await cp.locator('[data-studio="category-edit"][data-id="5"]').waitFor();
    assert.equal(cats.categories[4].imageUrl, origin + '/fixtures/1.svg');
    assert.equal(cats.categories[4].name, 'دستهٔ تصویری');
    await close(cp);
    await cp.locator('[data-select="categories"]').click();
    await cp.locator('[data-tab="content"]').click();
    await cp.locator('[data-action="studio-choose-categories"]').click();
    await cp.locator('[data-studio-pick="2"]').check();
    await cp.locator('[data-studio-pick="1"]').check();
    await cp.locator('[data-studio="pick-apply"]').click();
    await settle(cp);
    await cp.waitForFunction(
      () =>
        StorefrontEditorComplete.state.iframe.contentDocument.querySelectorAll('.sf-category-showcase-card')
          .length === 2,
    );
    assert.deepEqual(
      await frame(cp)
        .locator('.sf-category-showcase-card')
        .evaluateAll((nodes) => nodes.map((n) => Number(new URL(n.href).searchParams.get('category')))),
      [2, 1],
    );
    assert.deepEqual(cu.errors, []);
    await cu.context.close();
    console.log('PASS category creation with photo, global-save labelling and homepage-only selection order');

    for (const width of [390, 899]) {
      const mobileState = fixture(origin),
        mu = await editor(browser, origin, mobileState, { width, height: 900 }),
        mp = mu.page;
      await mp.locator('[data-action="studio-library"]').click();
      await mp.locator('[data-studio="lesson-new"]').click();
      assert.equal(await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const overflow = await mp.locator('.sfe-dialog').evaluate((el) => el.scrollWidth > el.clientWidth);
      assert.equal(overflow, false);
      await mp.screenshot({
        path: path.join(output, 'content-studio-' + width + '.png'),
        animations: 'disabled',
      });
      await close(mp);
      assert.deepEqual(mu.errors, []);
      assert.equal(mobileState.writes.length, 0);
      await mu.context.close();
    }
    console.log('PASS mobile/tablet forms, no overflow and no implicit writes');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  server.close();
});
