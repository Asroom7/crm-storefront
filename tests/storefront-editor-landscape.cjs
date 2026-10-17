'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { server, fixture, editor } = require('./storefront-editor-browser.cjs');

const output = process.env.EDITOR_QA_OUTPUT || path.resolve(__dirname, '../../editor-qa/screenshots');

const rect = (page, selector) =>
  page.locator(selector).evaluate((node) => {
    const box = node.getBoundingClientRect();
    return {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
      right: Math.round(box.right),
      bottom: Math.round(box.bottom),
    };
  });

async function assertNoOverflow(page) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    'editor created horizontal page overflow',
  );
}

async function assertSinglePane(page, pane) {
  await page.locator(`[data-pane="${pane}"]`).click();
  if (pane === 'settings') {
    assert.equal(await page.locator('.sfe-inspector').isVisible(), true);
    assert.equal(await page.locator('.sfe-canvas').isVisible(), false);
    const inspector = await rect(page, '.sfe-inspector');
    assert.ok(inspector.width >= (await page.evaluate(() => innerWidth)) - 24, 'portrait settings pane is not full width');
  } else {
    assert.equal(await page.locator('.sfe-canvas').isVisible(), true);
    assert.equal(await page.locator('.sfe-inspector').isVisible(), false);
    const canvas = await rect(page, '.sfe-canvas');
    assert.ok(canvas.width >= (await page.evaluate(() => innerWidth)) - 24, 'portrait preview pane is not full width');
  }
  await assertNoOverflow(page);
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
    const state = fixture(origin);
    const ui = await editor(browser, origin, state, { width: 390, height: 844 });
    const page = ui.page;

    assert.equal(
      await page.locator('[data-orientation-gate]').count(),
      0,
      'obsolete rotate-device gate returned',
    );
    await assertSinglePane(page, 'settings');
    await page.screenshot({
      path: path.join(output, 'portrait-editor-settings-390.png'),
      animations: 'disabled',
    });

    await assertSinglePane(page, 'preview');
    await page.waitForFunction(() => {
      const stage = document.querySelector('.sfe-preview-stage')?.getBoundingClientRect();
      const frame = document.querySelector('[data-frame-wrap]')?.getBoundingClientRect();
      return !!stage && !!frame && frame.right <= stage.right + 1 && frame.bottom <= stage.bottom + 1;
    });
    await page.screenshot({
      path: path.join(output, 'portrait-editor-preview-390.png'),
      animations: 'disabled',
    });

    await page.setViewportSize({ width: 844, height: 390 });
    await assertSinglePane(page, 'settings');
    await assertSinglePane(page, 'preview');
    assert.equal(state.writes.length, 0, 'viewport/pane switching wrote a draft');

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.locator('[data-pane="settings"]').click();
    await page.waitForFunction(() => {
      const canvas = document.querySelector('.sfe-canvas')?.getBoundingClientRect();
      const inspector = document.querySelector('.sfe-inspector')?.getBoundingClientRect();
      return !!canvas && !!inspector && canvas.width > 0 && inspector.width > 0 && canvas.right <= inspector.left + 1;
    });
    assert.equal(await page.locator('.sfe-canvas').isVisible(), true);
    assert.equal(await page.locator('.sfe-inspector').isVisible(), true);
    await assertNoOverflow(page);

    assert.deepEqual(ui.errors, []);
    await ui.context.close();
    console.log('PASS portrait editing without rotation gate, full-width mobile panes and tablet/desktop split');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
