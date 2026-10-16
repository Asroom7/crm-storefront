'use strict';
const assert = require('node:assert/strict'),
  path = require('node:path');
const { chromium } = require('playwright');
const { server, fixture, editor, setup } = require('./storefront-editor-browser.cjs');
const output = process.env.EDITOR_QA_OUTPUT || path.resolve(__dirname, '../../editor-qa/screenshots');
const snapshot = (p) =>
  p.evaluate(() =>
    StorefrontEditorModel.snapshot(
      StorefrontEditorComplete.state.config,
      StorefrontEditorComplete.state.theme,
    ),
  );
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
async function checkSplit(p) {
  await p.waitForFunction(() => {
    const canvas = document.querySelector('.sfe-canvas').getBoundingClientRect(),
      settings = document.querySelector('.sfe-inspector').getBoundingClientRect();
    return settings.width > 0 && canvas.right <= settings.left + 1 && Math.abs(settings.top - canvas.top) < 2;
  });
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal(
    await p.locator('.sfe-statusbar').evaluate((n) => n.getBoundingClientRect().bottom <= innerHeight),
    true,
    'save status fell outside the viewport',
  );
  await p.waitForFunction(() => {
    const canvas = document.querySelector('.sfe-canvas').getBoundingClientRect(),
      stage = document.querySelector('.sfe-preview-stage').getBoundingClientRect(),
      frame = document.querySelector('[data-frame-wrap]').getBoundingClientRect();
    return frame.bottom <= stage.bottom + 1 && stage.bottom <= canvas.bottom + 1;
  });
}
async function openDrawerTool(p, action) {
  await p.locator('[data-pane="sections"]').click();
  await p.locator(`.sfe-outline [data-action="${action}"]`).click();
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
      ui = await editor(browser, origin, state, { width: 390, height: 844 }),
      p = ui.page;
    const initial = await snapshot(p);
    assert.equal(await p.locator('[data-orientation-gate]').isVisible(), true);
    assert.equal(await p.locator('.sfe-topbar').evaluate((n) => n.inert), true);
    await p.keyboard.press('Control+k');
    assert.equal(await p.locator('[data-overlay]').isVisible(), false);
    assert.equal(state.writes.length, 0);
    await p.screenshot({ path: path.join(output, 'landscape-portrait-gate.png'), animations: 'disabled' });
    await p.setViewportSize({ width: 844, height: 390 });
    await p.locator('[data-orientation-gate]').waitFor({ state: 'hidden' });
    await checkSplit(p);
    assert.deepEqual(await snapshot(p), initial);
    assert.equal(state.writes.length, 0);
    await p.locator('button[data-pane="sections"]').click();
    assert.equal(await p.locator('.sfe-outline').isVisible(), true);
    await p.locator('[data-select="best"]').click();
    assert.equal(await p.locator('.sfe-outline').isVisible(), false);
    await p.locator('[data-field="content.title"]').fill('عنوان در محیط افقی');
    await settle(p);
    const draft = await snapshot(p),
      writes = state.writes.length;
    await openDrawerTool(p, 'studio-library');
    await p.locator('[data-studio="lesson-new"]').click();
    await p.locator('[data-studio-field="title"]').fill('فرم ذخیره‌نشده هنگام چرخش');
    await p.setViewportSize({ width: 390, height: 844 });
    await p.locator('[data-orientation-gate]').waitFor({ state: 'visible' });
    await p.keyboard.press('Control+k');
    assert.equal(await p.locator('[data-overlay]').evaluate((n) => n.inert), true);
    await p.setViewportSize({ width: 844, height: 390 });
    await p.locator('[data-orientation-gate]').waitFor({ state: 'hidden' });
    assert.equal(await p.locator('[data-studio-field="title"]').inputValue(), 'فرم ذخیره‌نشده هنگام چرخش');
    assert.equal(await p.locator('[data-overlay]').evaluate((n) => n.inert), false);
    assert.deepEqual(await snapshot(p), draft);
    assert.equal(state.writes.length, writes, 'rotation wrote the draft');
    await p.locator('[data-overlay] [data-action="close"]').first().click();
    for (const viewport of [
      { width: 568, height: 320 },
      { width: 667, height: 375 },
      { width: 740, height: 360 },
      { width: 844, height: 390 },
      { width: 1024, height: 768 },
      { width: 1280, height: 720 },
      { width: 1440, height: 900 },
    ]) {
      await p.setViewportSize(viewport);
      await p.locator('button[data-pane="settings"]').click();
      await checkSplit(p);
      if ([568, 844, 1440].includes(viewport.width))
        await p.screenshot({
          path: path.join(output, 'landscape-editor-' + viewport.width + '.png'),
          animations: 'disabled',
        });
      const before = await p.locator('.sfe-canvas').evaluate((n) => n.clientWidth);
      await p.locator('button[data-pane="preview"]').click();
      assert.equal(await p.locator('.sfe-inspector').isVisible(), false);
      assert.ok((await p.locator('.sfe-canvas').evaluate((n) => n.clientWidth)) > before);
    }
    assert.deepEqual(ui.errors, []);
    await p.locator('[data-action="back"]').first().click();
    await p.waitForFunction(() => !document.querySelector('.sfe-host'));
    assert.equal(
      await p.locator('#app > .topbar').isVisible(),
      true,
      'editor fullscreen styling leaked to the panel',
    );
    console.log(
      'PASS portrait gate, landscape split, drawer, expanded preview, rotation preserves draft/form, no writes and route cleanup',
    );

    const touchState = fixture(origin),
      context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        screen: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      }),
      tp = await context.newPage();
    await setup(tp, touchState);
    await tp.addInitScript(() => {
      const query = window.matchMedia.bind(window);
      window.matchMedia = (value) => {
        const result = query(value);
        if (value === '(pointer:coarse)') Object.defineProperty(result, 'matches', { value: false });
        return result;
      };
      window.__physicalOrientation = 'portrait-primary';
      Object.defineProperty(screen.orientation, 'type', {
        configurable: true,
        get: () => window.__physicalOrientation,
      });
    });
    await tp.goto(origin + '/new/panel/index.html#/storefront-editor');
    await tp.locator('[data-orientation-gate]').waitFor();
    assert.equal(await tp.evaluate(() => matchMedia('(pointer:coarse)').matches), false);
    await tp.setViewportSize({ width: 390, height: 250 });
    assert.equal(
      await tp.locator('[data-orientation-gate]').isVisible(),
      true,
      'keyboard resize unlocked a portrait device',
    );
    await tp.evaluate(() => {
      window.__physicalOrientation = 'landscape-primary';
      dispatchEvent(new Event('orientationchange'));
    });
    await tp.setViewportSize({ width: 844, height: 390 });
    await tp.locator('[data-orientation-gate]').waitFor({ state: 'hidden' });
    await openDrawerTool(tp, 'studio-library');
    await tp.locator('[data-studio="lesson-new"]').click();
    await tp.locator('[data-studio-field="title"]').fill('حفظ فرم با بازشدن صفحه‌کلید');
    await tp.evaluate(() => {
      Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => 220 });
      visualViewport.dispatchEvent(new Event('resize'));
    });
    assert.equal(await tp.evaluate(() => innerHeight), 390, 'keyboard test resized the layout viewport');
    assert.equal(await tp.locator('[data-orientation-gate]').isVisible(), false);
    const footer = await tp.locator('.sfe-dialog > footer').boundingBox();
    assert.ok(footer.y + footer.height <= 220);
    assert.equal(await tp.locator('[data-studio-field="title"]').inputValue(), 'حفظ فرم با بازشدن صفحه‌کلید');
    assert.equal(touchState.writes.length, 0);
    await context.close();
    await ui.context.close();
    console.log(
      'PASS hardware orientation survives soft-keyboard resizing without unlocking portrait or losing forms',
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
