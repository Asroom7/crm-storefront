'use strict';
const assert = require('node:assert/strict'),
  path = require('node:path');
const { chromium } = require('playwright');
const { server, fixture, setup } = require('./storefront-editor-browser.cjs');
const output = process.env.EDITOR_QA_OUTPUT || path.resolve(__dirname, '../../editor-qa/screenshots');
const box = (p, selector) => p.locator(selector).evaluate((node) => {
  const r = node.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
});
async function openStandalone(browser, origin, state, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await setup(page, state);
  await page.goto(origin + '/new/panel/index.html#/settings');
  const link = page.locator('[data-storefront-editor-link]');
  await link.waitFor({ timeout: 60000 });
  assert.match(await link.getAttribute('href'), /storefront-editor\.html#\/storefront-editor$/);
  await link.click();
  await page.locator('[data-storefront-workbench]').waitFor();
  await page.waitForFunction(
    () => window.StorefrontEditorComplete.state.iframe?.contentWindow?.StorefrontHome?.__editorContext,
  );
  assert.match(new URL(page.url()).pathname, /\/panel\/storefront-editor\.html$/);
  assert.equal(await page.locator('script[src*="customer-crm-features"]').count(), 0);
  assert.equal(await page.locator('script[src*="analytics-dashboard"]').count(), 0);
  assert.equal(await page.locator('.topbar,.bottom-nav').count(), 0);
  return { context, page, errors };
}
async function assertTwoColumnOrder(page) {
  const canvas = await box(page, '.sfe-canvas'), inspector = await box(page, '.sfe-inspector');
  assert.ok(canvas.right <= inspector.x + 1, 'preview is not physically left of inspector');
  assert.ok(Math.abs(canvas.y - inspector.y) < 2, 'preview and inspector are not aligned');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  return { canvas, inspector };
}
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({
    executablePath: process.env.EDITOR_CHROMIUM_PATH || undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    const state = fixture(origin), ui = await openStandalone(browser, origin, state, { width: 1440, height: 900 }), p = ui.page;
    const initial = await assertTwoColumnOrder(p), workspace = await box(p, '.sfe-workspace');
    assert.ok(initial.canvas.width / workspace.width > 0.63 && initial.canvas.width / workspace.width < 0.67);
    await p.evaluate(() => {
      let active = null;
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => active });
      document.getElementById('view').requestFullscreen = async () => {
        active = document.getElementById('view');
        document.dispatchEvent(new Event('fullscreenchange'));
      };
      document.exitFullscreen = async () => {
        active = null;
        document.dispatchEvent(new Event('fullscreenchange'));
      };
    });
    const fullscreen = p.locator('.sfe-top-actions [data-action="fullscreen"]');
    await fullscreen.click();
    assert.equal(await fullscreen.getAttribute('aria-pressed'), 'true');
    await fullscreen.click();
    assert.equal(await fullscreen.getAttribute('aria-pressed'), 'false');
    assert.equal(await p.locator('button[data-zoom-mode="fit"]').getAttribute('aria-pressed'), 'true');
    await p.waitForFunction(() => {
      const frame = document.querySelector('[data-frame-wrap]').getBoundingClientRect(), stage = document.querySelector('.sfe-preview-stage').getBoundingClientRect();
      return frame.right <= stage.right + 1 && frame.bottom <= stage.bottom + 1;
    });
    const fitZoom = await p.evaluate(() => StorefrontEditorComplete.state.zoom);
    await p.locator('[data-action="zoom-in"]').click();
    const manualZoom = await p.evaluate(() => StorefrontEditorComplete.state.zoom);
    assert.ok(manualZoom > fitZoom);
    assert.equal(await p.evaluate(() => StorefrontEditorComplete.state.zoomMode), 'manual');
    await p.locator('[data-settings-query]').fill('شماره پشتيباني');
    assert.equal(await p.evaluate(() => StorefrontEditorComplete.state.zoom), manualZoom, 'typing reset manual zoom');
    const phone = p.locator('[data-find-field="editorFooterV1.phone"]');
    await phone.waitFor();
    assert.match(await phone.innerText(), /شماره پشتیبانی/);
    assert.match(await phone.locator('small').innerText(), /صفحه اصلی/);
    await phone.click();
    assert.equal(await p.locator('[data-field="editorFooterV1.phone"]').isVisible(), true);
    assert.equal(await p.locator('[data-field="editorFooterV1.phone"]').evaluate((n) => n === document.activeElement), true);
    await p.locator('button[data-zoom-mode="width"]').click();
    assert.equal(await p.evaluate(() => StorefrontEditorComplete.state.zoomMode), 'width');
    await p.locator('button[data-zoom-mode="actual"]').click();
    assert.equal(await p.evaluate(() => StorefrontEditorComplete.state.zoom), 1);
    await p.locator('[data-action="focus-section"]').click();
    assert.equal(await p.evaluate(() => StorefrontEditorComplete.state.zoomMode), 'focus');
    const beforeSplit = (await box(p, '.sfe-canvas')).width;
    await p.locator('[data-splitter]').focus();
    await p.keyboard.press('ArrowLeft');
    assert.ok((await box(p, '.sfe-canvas')).width < beforeSplit);
    await p.keyboard.press('Home');
    assert.equal(await p.locator('[data-splitter]').getAttribute('aria-valuenow'), '65');
    await p.locator('[data-preview-source="live"]').click();
    assert.equal(await p.evaluate(() => StorefrontEditorComplete.state.previewSource), 'live');
    await p.locator('[data-preview-source="draft"]').click();
    await p.locator('[data-preview-mode="view"]').click();
    assert.equal(await p.evaluate(() => StorefrontEditorComplete.state.previewMode), 'view');
    await p.locator('[data-preview-mode="edit"]').click();
    await p.locator('[data-pane="sections"]').click();
    const drawer = await box(p, '.sfe-outline');
    assert.ok(Math.abs(drawer.right - 1440) < 2, 'hamburger drawer did not open from the right');
    assert.equal(await p.locator('.sfe-drawer-group').count(), 3);
    await p.keyboard.press('Escape');
    assert.equal(await p.locator('.sfe-outline').isVisible(), false);
    await p.evaluate(() => {
      StorefrontEditorComplete.state.config.sections.find((section) => section.id === 'best').content.title =
        'تغییر ذخیره‌نشده برای بررسی خروج';
    });
    await p.locator('.sfe-top-actions [data-action="back"]').click();
    assert.equal(await p.locator('#sfe-dialog-title').innerText(), 'خروج از ویرایشگر');
    assert.equal(await p.locator('[data-action="save-exit"]').isVisible(), true);
    assert.equal(await p.locator('[data-action="discard-exit"]').isVisible(), true);
    await p.locator('[data-overlay] [data-action="close"]').first().click();
    await p.evaluate(() => {
      StorefrontEditorComplete.state.config = StorefrontEditorModel.clone(StorefrontEditorComplete.state.server.config);
      StorefrontEditorComplete.state.theme = StorefrontEditorModel.clone(StorefrontEditorComplete.state.server.theme);
    });
    assert.equal(state.writes.length, 0, 'search, zoom or navigation wrote production draft data');
    assert.deepEqual(ui.errors, []);
    await p.screenshot({ path: path.join(output, 'fullscreen-editor-desktop.png'), animations: 'disabled' });
    await ui.context.close();
    console.log('PASS standalone entry, physical 65/35 layout, global search, zoom modes, splitter, preview modes and right drawer');

    for (const viewport of [{ width: 844, height: 390 }, { width: 1024, height: 768 }]) {
      const responsiveState = fixture(origin), responsive = await openStandalone(browser, origin, responsiveState, viewport), page = responsive.page;
      await assertTwoColumnOrder(page);
      await page.locator('[data-pane="preview"]').click();
      assert.equal(await page.locator('.sfe-inspector').isVisible(), false);
      await page.locator('[data-pane="settings"]').click();
      assert.equal(await page.locator('.sfe-inspector').isVisible(), true);
      await page.locator('[data-pane="sections"]').click();
      assert.equal(await page.locator('.sfe-outline').isVisible(), true);
      await page.locator('[data-action="outline-dismiss"]').first().click();
      await page.waitForFunction(() => {
        const frame = document.querySelector('[data-frame-wrap]').getBoundingClientRect(), stage = document.querySelector('.sfe-preview-stage').getBoundingClientRect();
        return frame.right <= stage.right + 1 && frame.bottom <= stage.bottom + 1;
      });
      assert.equal(responsiveState.writes.length, 0);
      assert.deepEqual(responsive.errors, []);
      await page.screenshot({ path: path.join(output, 'fullscreen-editor-' + viewport.width + '.png'), animations: 'disabled' });
      await responsive.context.close();
    }
    console.log('PASS landscape phone/tablet split, collapsible inspector, fit overview, no overflow and no implicit writes');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
