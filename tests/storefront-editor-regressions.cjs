'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { server, fixture, editor, setup } = require('./storefront-editor-browser.cjs');
const settle = (page) =>
  page.waitForFunction(
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
const frames = (page) => page.frames().find((frame) => frame.parentFrame());
const output = process.env.EDITOR_QA_OUTPUT || path.resolve(__dirname, '../../editor-qa/screenshots');
async function run() {
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
    const raceState = fixture(origin),
      race = await editor(browser, origin, raceState),
      rp = race.page;
    await rp.locator('[data-field="content.title"]').fill('عنوان مرورشده');
    await settle(rp);
    let release, started;
    const gate = new Promise((resolve) => (release = resolve)),
      seen = new Promise((resolve) => (started = resolve));
    await rp.route('**/api/storefront/editor/home/publish', async (route) => {
      started();
      await gate;
      await route.fallback();
    });
    await rp.locator('[data-action="review"]').click();
    await rp.locator('[data-action="publish"]').click();
    await seen;
    await rp.locator('[data-action="close"]').first().click();
    await rp.locator('[data-field="content.title"]').fill('ویرایش تازه هنگام انتشار');
    raceState.failSave = true;
    release();
    await rp.waitForFunction(() => !StorefrontEditorComplete.state.publishing);
    assert.equal(await rp.locator('[data-field="content.title"]').inputValue(), 'ویرایش تازه هنگام انتشار');
    assert.equal(
      raceState.page.publishedConfig.sections.find((s) => s.id === 'best').content.title,
      'عنوان مرورشده',
    );
    assert.equal(
      await rp.evaluate(
        () =>
          JSON.parse(localStorage.getItem('crm-storefront-draft:v1:1')).snapshot.config.sections.find(
            (s) => s.id === 'best',
          ).content.title,
      ),
      'ویرایش تازه هنگام انتشار',
    );
    await rp.waitForFunction(() => !!StorefrontEditorComplete.state.error);
    raceState.failSave = false;
    await rp.locator('[data-action="save"]').click();
    await settle(rp);
    assert.equal(
      raceState.page.config.sections.find((s) => s.id === 'best').content.title,
      'ویرایش تازه هنگام انتشار',
    );
    assert.deepEqual(race.errors, []);
    await race.context.close();
    console.log('PASS edits during publish remain in draft/recovery, then save without publishing');

    const savingState = fixture(origin),
      saving = await editor(browser, origin, savingState),
      sp = saving.page;
    let releaseSave, markSave;
    const saveGate = new Promise((resolve) => (releaseSave = resolve)),
      saveSeen = new Promise((resolve) => (markSave = resolve));
    await sp.route('**/api/storefront/editor/home', async (route) => {
      if (route.request().method() === 'PUT') {
        markSave();
        await saveGate;
      }
      await route.fallback();
    });
    await sp.locator('[data-field="content.title"]').fill('برای مرور');
    await sp.locator('[data-action="review"]').click();
    await sp.locator('[data-action="publish"]').click();
    await saveSeen;
    await sp.locator('[data-action="close"]').first().click();
    await sp.locator('[data-field="content.title"]').fill('پس از مرور');
    releaseSave();
    await settle(sp);
    assert.equal(savingState.writes.filter((write) => write.name.endsWith('/publish')).length, 0);
    assert.equal(savingState.page.config.sections.find((s) => s.id === 'best').content.title, 'پس از مرور');
    await saving.context.close();
    console.log('PASS cancelling or editing during draft save cannot publish an unreviewed snapshot');

    const state = fixture(origin),
      ui = await editor(browser, origin, state),
      p = ui.page,
      frame = frames(p);
    await p.locator('[data-select="__header"]').click();
    for (const key of ['showMenu', 'showCart'])
      await p.locator('[data-field="editorHeaderV1.' + key + '"]').uncheck();
    await frame.locator('.menu-toggle').waitFor({ state: 'hidden' });
    await frame.locator('.site-header a[href="cart.html"]').waitFor({ state: 'hidden' });
    for (const key of ['showMenu', 'showCart'])
      await p.locator('[data-field="editorHeaderV1.' + key + '"]').check();
    await frame.locator('.menu-toggle').waitFor({ state: 'visible' });
    await frame.locator('.site-header a[href="cart.html"]').waitFor({ state: 'visible' });
    await p.locator('[data-select="best"]').click();
    await p.locator('[data-tab="visibility"]').click();
    await p.locator('[data-field="settings.editorOptionsV1.showAll"]').uncheck();
    await frame.locator('.sf-best-sellers .sf-section-head>a').waitFor({ state: 'hidden' });
    await p.locator('[data-field="settings.editorOptionsV1.showAll"]').check();
    await frame.locator('.sf-best-sellers .sf-section-head>a').waitFor({ state: 'visible' });
    await p.locator('[data-select="campaign"]').click();
    await p.locator('[data-tab="visibility"]').click();
    await p.locator('[data-field="settings.editorOptionsV1.showTimer"]').uncheck();
    await frame.locator('.sf-countdown').waitFor({ state: 'hidden' });
    await p.locator('[data-field="settings.editorOptionsV1.showTimer"]').check();
    await frame.locator('.sf-countdown').waitFor({ state: 'visible' });
    await p.locator('[data-field="settings.startsAt"]').fill('2030-01-01T12:00');
    await frame.locator('.sf-campaign-section').waitFor({ state: 'hidden' });
    assert.equal(
      await p.locator('[data-field="settings.editorOptionsV1.scheduleEnabled"]').isChecked(),
      true,
    );
    await p.locator('[data-field="settings.startsAt"]').fill('2020-01-01T12:00');
    await frame.locator('.sf-campaign-section').waitFor({ state: 'visible' });
    await settle(p);
    await p.evaluate(() => {
      const config = StorefrontEditorModel.clone(StorefrontEditorComplete.state.config),
        win = StorefrontEditorComplete.state.iframe.contentWindow;
      config.sections.find((s) => s.id === 'campaign').settings.startsAt = new Date(
        Date.now() + win.StorefrontHome.__editorContext.clockSkewMs + 650,
      ).toISOString();
      win.postMessage(
        { type: 'storefront-preview-config', config, theme: StorefrontEditorComplete.state.theme },
        location.origin,
      );
    });
    await frame.locator('.sf-campaign-section').waitFor({ state: 'hidden' });
    await frame.locator('.sf-campaign-section').waitFor({ state: 'visible' });
    await p.locator('[data-action="add"]').click();
    await p.locator('[data-add="product-collection"]').click();
    await p.locator('[data-action="products"]').click();
    await p.locator('[data-product-id="1"]').check();
    await p.locator('[data-product-id="2"]').check();
    await p.locator('[data-action="apply-products"]').click();
    await p.locator('[data-field="settings.limit"]').fill('1');
    await settle(p);
    await frame.waitForFunction(
      () => document.querySelectorAll('.sf-editor-block .sf-product-card').length === 1,
    );
    await p.locator('[data-action="add"]').click();
    await p.locator('[data-add="hero"]').click();
    await p.locator('[data-field="content.subtitle"]').fill('توضیح کوتاه بنر');
    await settle(p);
    await frame.waitForFunction(
      () => document.querySelector('[data-editor-subtitle]')?.textContent === 'توضیح کوتاه بنر',
    );
    await p.locator('[data-tab="visibility"]').click();
    await p.locator('[data-field="settings.editorOptionsV1.visible"]').uncheck();
    await frame.locator('.sf-hero.sf-editor-block').waitFor({ state: 'hidden' });
    await p.locator('[data-field="settings.editorOptionsV1.visible"]').check();
    await frame.locator('.sf-hero.sf-editor-block').waitFor({ state: 'visible' });
    await p.locator('[data-tab="content"]').click();
    await p.locator('[data-action="choose-image"][data-path="content.imageDesktopUrl"]').click();
    await p.locator('[data-media-kind]').selectOption('video');
    assert.equal(await p.locator('[data-action="use-media"][data-id="2"]').isDisabled(), true);
    await p.locator('[data-media-kind]').selectOption('image');
    await p.locator('[data-action="use-media"][data-id="1"]').click();
    await frame.locator('.sf-hero-art img').waitFor();
    assert.equal(await frame.locator('.sf-hero-art img').getAttribute('src'), origin + '/fixtures/1.svg');
    await p.locator('[data-action="media"]').click();
    const beforeUploads = state.writes.filter(write => write.name === '/storefront/media/upload').length;
    const chooser = p.waitForEvent('filechooser');
    await p.locator('[data-action="replace-media"][data-id="1"]').click();
    await (await chooser).setFiles({ name: 'wrong-type.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fixture') });
    await p.waitForTimeout(150);
    assert.equal(state.writes.filter(write => write.name === '/storefront/media/upload').length, beforeUploads, 'replacing an image accepted a video upload');
    assert.deepEqual(ui.errors, []);
    await ui.context.close();
    console.log(
      'PASS visibility toggles, automatic schedule boundary, collection limit, subtitles and typed media selection',
    );

    const checkState = fixture(origin);
    checkState.page.config.sections.find((s) => s.id === 'best').settings.productIds.push(999);
    const checks = await editor(browser, origin, checkState),
      cp = checks.page;
    await cp.locator('[data-action="review"]').click();
    await cp.waitForFunction(() => StorefrontEditorComplete.state.reviewReady);
    assert.equal(await cp.locator('[data-preflight-ack]').isVisible(), true);
    assert.equal(await cp.locator('[data-action="publish"]').isDisabled(), true);
    await cp.screenshot({ path: path.join(output, 'preflight-review.png'), animations: 'disabled' });
    await cp.locator('[data-preflight-ack]').check();
    assert.equal(await cp.locator('[data-action="publish"]').isDisabled(), false);
    assert.equal(checkState.writes.filter((write) => write.name.endsWith('/publish')).length, 0);
    await cp.locator('[data-action="close"]').first().click();
    await cp.locator('[data-action="add"]').click();
    await cp.locator('[data-add="hero"]').click();
    await cp.locator('[data-field="content.ctaText"]').fill('دیدن');
    await cp.locator('[data-field="content.ctaUrl"]').fill('missing-page.html');
    await settle(cp);
    await cp.route('**/missing-page.html', (route) => route.fulfill({ status: 404, body: '' }));
    await cp.locator('[data-action="review"]').click();
    await cp.waitForFunction(() => StorefrontEditorComplete.state.reviewReady);
    assert.match(await cp.locator('[data-preflight]').innerText(), /مقصد دکمه در دسترس نیست/);
    await cp.locator('[data-action="close"]').first().click();
    await checks.context.close();
    const brokenState = fixture(origin);
    brokenState.page.config.sections.push({
      id: 'bad-image',
      type: 'hero',
      enabled: true,
      content: { imageDesktopUrl: origin + '/fixtures/demo.mp4' },
      settings: { editorManagedV1: true },
    });
    const broken = await editor(browser, origin, brokenState);
    await broken.page.locator('[data-action="review"]').click();
    await broken.page.waitForFunction(() => StorefrontEditorComplete.state.reviewReady);
    assert.equal(await broken.page.locator('[data-action="publish"]').isDisabled(), true);
    assert.match(await broken.page.locator('[data-preflight]').innerText(), /باید فایل تصویر باشد/);
    await broken.page.locator('[data-action="close"]').first().click();
    await broken.page.locator('[data-select="bad-image"]').click();
    await broken.page.locator('[data-action="choose-image"][data-path="content.imageDesktopUrl"]').click();
    await broken.page.locator('[data-action="use-media"][data-id="1"]').click();
    await settle(broken.page);
    await broken.page.route('**/fixtures/1.svg', (route) => route.fulfill({ status: 404, body: '' }));
    await broken.page.locator('[data-action="review"]').click();
    await broken.page.waitForFunction(() => StorefrontEditorComplete.state.reviewReady);
    assert.match(await broken.page.locator('[data-preflight]').innerText(), /تصویر دسکتاپ بارگذاری نشد/);
    assert.equal(await broken.page.locator('[data-action="publish"]').isDisabled(), true);
    await broken.context.close();
    console.log(
      'PASS preflight warnings need acknowledgement; wrong media blocks publication; missing links are detected',
    );

    const legacyState = fixture(origin);
    legacyState.page.config.sections.find((s) => s.id === 'campaign').settings.startsAt =
      '2030-01-01T12:00:00.000Z';
    legacyState.page.publishedConfig = JSON.parse(JSON.stringify(legacyState.page.config));
    const legacy = await editor(browser, origin, legacyState);
    await frames(legacy.page).locator('.sf-campaign-section').waitFor({ state: 'visible' });
    await legacy.page.waitForTimeout(500);
    assert.equal(await frames(legacy.page).locator('.sf-campaign-section').isVisible(), true);
    assert.equal(legacyState.writes.length, 0);
    await legacy.context.close();
    console.log('PASS saved legacy dates stay inactive until scheduling is explicitly enabled');

    for (const width of [844, 1024, 1440]) {
      const searchState = fixture(origin),
        search = await editor(browser, origin, searchState, { width, height: width >= 1200 ? 900 : 390 }),
        qp = search.page;
      await qp.waitForTimeout(300);
      assert.equal(await qp.evaluate(() => scrollY), 0, 'opening the preview scrolled the outer panel');
      assert.equal(await qp.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await qp.evaluate(() => document.body.textContent.includes('\\n')), false);
      if (width < 1200) await qp.locator('button[data-pane="sections"]').click();
      await qp.locator('[data-section-query]').fill('بخش قديمي');
      assert.equal(await qp.locator('[data-outline] [data-select]').count(), 1);
      assert.equal(await qp.locator('[data-outline] [data-select="legacy-hero"]').isVisible(), true);
      await qp.locator('[data-section-query]').fill('');
      await qp.locator('[data-action="search-settings"]').click();
      await qp.locator('[data-settings-query]').fill('شماره پشتیبانی');
      await qp.locator('[data-find-field="editorFooterV1.phone"]').click();
      assert.equal(await qp.locator('[data-field="editorFooterV1.phone"]').isVisible(), true);
      await qp.locator('[data-action="search-settings"]').click();
      await qp.locator('[data-settings-query]').fill('فاصله کارت');
      assert.equal(
        await qp.locator('[data-find-section="search"],[data-find-section="legacy-hero"]').count(),
        0,
        'settings search offered card controls on sections without cards',
      );
      if (width === 844)
        await qp.screenshot({
          path: path.join(output, 'settings-search-mobile.png'),
          animations: 'disabled',
        });
      await qp.locator('[data-find-section="best"][data-find-scope="mobile"]').first().click();
      assert.equal(await qp.locator('[data-field="settings.editorOptionsV1.mobile.gap"]').isVisible(), true);
      assert.equal(
        await qp
          .locator('[data-field="settings.editorOptionsV1.mobile.gap"]')
          .evaluate((el) => el === document.activeElement),
        true,
      );
      assert.equal(searchState.writes.length, 0, 'search inserted defaults or saved a draft');
      assert.deepEqual(search.errors, []);
      await search.context.close();
    }
    console.log(
      'PASS initial viewport stability, clean HTML and read-only Persian section/settings search on mobile, tablet and desktop',
    );
  } finally {
    await browser.close();
    server.close();
  }
}
run().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
