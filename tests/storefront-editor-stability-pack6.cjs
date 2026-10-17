'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { server, fixture, editor } = require('./storefront-editor-browser.cjs');

const output = process.env.EDITOR_QA_OUTPUT || path.resolve(__dirname, '../../editor-qa/screenshots');

function metricMap(result) {
  return Object.fromEntries((result.metrics || []).map((row) => [row.name, row.value]));
}

function percentile(values, q) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))];
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
    const ui = await editor(browser, origin, state, { width: 1440, height: 900 });
    const page = ui.page;
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    await page.locator('button[data-zoom-mode="actual"]').click();
    for (let i = 0; i < 20; i++) await page.locator('[data-action="zoom-out"]').click();
    await page.waitForTimeout(100);

    const minZoom = await page.evaluate(() => StorefrontEditorComplete.state.zoom);
    assert.ok(minZoom >= 0.199 && minZoom <= 0.201, 'minimum zoom drifted below the 20% safety floor');
    assert.equal(await page.locator('[data-action="zoom-out"]').isDisabled(), true);

    const frameGeometry = await page.evaluate(() => {
      const iframe = document.querySelector('[data-preview-frame]');
      const wrap = document.querySelector('[data-frame-wrap]').getBoundingClientRect();
      return {
        iframeWidth: iframe.offsetWidth,
        iframeHeight: iframe.offsetHeight,
        wrapWidth: Math.round(wrap.width),
        wrapHeight: Math.round(wrap.height),
      };
    });
    assert.equal(frameGeometry.iframeWidth, 1180);
    assert.equal(frameGeometry.iframeHeight, 760);
    assert.ok(frameGeometry.wrapHeight <= 160, 'zoom-out recreated a giant iframe surface');

    await page.locator('button[data-zoom-mode="actual"]').click();
    const before = metricMap(await client.send('Performance.getMetrics'));
    const timing = await page.evaluate(async () => {
      const zoomIn = document.querySelector('[data-action="zoom-in"]');
      const zoomOut = document.querySelector('[data-action="zoom-out"]');
      const deltas = [];
      let last = performance.now();
      for (let i = 0; i < 30; i++) {
        (i % 2 ? zoomIn : zoomOut).click();
        await new Promise((resolve) =>
          requestAnimationFrame((now) => {
            deltas.push(now - last);
            last = now;
            resolve();
          }),
        );
      }
      return {
        deltas,
        iframeHeight: document.querySelector('[data-preview-frame]').offsetHeight,
        iframeWidth: document.querySelector('[data-preview-frame]').offsetWidth,
      };
    });
    await page.waitForTimeout(120);
    const after = metricMap(await client.send('Performance.getMetrics'));

    const layoutDelta = (after.LayoutCount || 0) - (before.LayoutCount || 0);
    const recalcDelta = (after.RecalcStyleCount || 0) - (before.RecalcStyleCount || 0);
    const p95 = percentile(timing.deltas, 0.95);
    const maxFrame = Math.max(...timing.deltas);

    assert.equal(timing.iframeHeight, 760, 'manual zoom changed the iframe document height');
    assert.equal(timing.iframeWidth, 1180, 'manual zoom changed the iframe document width');
    assert.ok(layoutDelta < 120, 'zoom caused excessive layout passes: ' + layoutDelta);
    assert.ok(recalcDelta < 220, 'zoom caused excessive style recalculation: ' + recalcDelta);
    assert.ok(p95 < 250, 'zoom interaction stalled the browser; p95 frame delay=' + Math.round(p95) + 'ms');
    assert.ok(maxFrame < 600, 'zoom interaction produced a severe main-thread stall: ' + Math.round(maxFrame) + 'ms');

    const previewFrame = await page.locator('[data-preview-frame]').elementHandle();
    await page.evaluate(() => {
      const root = StorefrontEditorComplete.state.iframe.contentDocument.getElementById('storefront-home-root');
      window.__pack6Mutations = 0;
      window.__pack6Observer = new MutationObserver((rows) => {
        window.__pack6Mutations += rows.length;
      });
      window.__pack6Observer.observe(root, { childList: true });
    });
    await page.locator('[data-field="content.title"]').fill('عنوان تست پایداری');
    await page.waitForFunction(
      () =>
        StorefrontEditorComplete.state.iframe.contentDocument
          .querySelector('.sf-best-sellers h2')
          ?.textContent === 'عنوان تست پایداری',
    );
    await page.waitForTimeout(250);
    const mutationCount = await page.evaluate(() => {
      window.__pack6Observer?.disconnect();
      return window.__pack6Mutations;
    });
    assert.ok(mutationCount <= 8, 'a single title edit rebuilt too much preview DOM: ' + mutationCount);
    assert.equal(
      await page.evaluate((frame) => frame === StorefrontEditorComplete.state.iframe, previewFrame),
      true,
      'preview iframe was recreated by a normal content edit',
    );

    await page.screenshot({
      path: path.join(output, 'stability-pack6-desktop.png'),
      animations: 'disabled',
    });

    assert.deepEqual(ui.errors, []);
    await ui.context.close();

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 844, height: 390 },
    ]) {
      const responsiveState = fixture(origin);
      const responsive = await editor(browser, origin, responsiveState, viewport);
      const p = responsive.page;

      assert.equal(await p.locator('[data-orientation-gate]').count(), 0);
      await p.locator('[data-pane="settings"]').click();
      assert.equal(await p.locator('.sfe-inspector').isVisible(), true);
      assert.equal(await p.locator('.sfe-canvas').isVisible(), false);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

      await p.locator('[data-pane="preview"]').click();
      assert.equal(await p.locator('.sfe-canvas').isVisible(), true);
      assert.equal(await p.locator('.sfe-inspector').isVisible(), false);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await p.waitForFunction(() => {
        const stage = document.querySelector('.sfe-preview-stage')?.getBoundingClientRect();
        const frame = document.querySelector('[data-frame-wrap]')?.getBoundingClientRect();
        return !!stage && !!frame && frame.right <= stage.right + 1 && frame.bottom <= stage.bottom + 1;
      });

      assert.equal(responsiveState.writes.length, 0, 'responsive pane switching wrote a draft');
      assert.deepEqual(responsive.errors, []);
      await p.screenshot({
        path: path.join(output, 'stability-pack6-' + viewport.width + 'x' + viewport.height + '.png'),
        animations: 'disabled',
      });
      await responsive.context.close();
    }

    console.log(
      'PASS zoom performance guards, bounded iframe surface, incremental preview updates, portrait panes and responsive screenshots',
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
