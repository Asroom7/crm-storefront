'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const baseline = process.env.BASELINE_ROOT;
const output = process.env.EDITOR_QA_OUTPUT || path.resolve(root, '../editor-qa/screenshots');
fs.mkdirSync(output, { recursive: true });
const copy = (x) => JSON.parse(JSON.stringify(x));
const theme = {
  primaryColor: '#cf4772',
  accentColor: '#452b45',
  backgroundColor: '#fffdfc',
  surfaceColor: '#ffffff',
  textColor: '#211b1e',
  mutedColor: '#746b70',
  fontFamily: 'Tahoma, Arial, sans-serif',
  buttonRadius: 999,
  cardRadius: 20,
  containerWidth: 1180,
  sectionSpacing: 64,
  globalPadding: 18,
  shadowPreset: 'soft',
};
const configuration = {
  sections: [
    { id: 'search', type: 'search', enabled: true, content: {}, settings: {} },
    {
      id: 'legacy-hero',
      type: 'hero',
      enabled: true,
      content: { title: 'بخش قدیمی' },
      settings: { oldFlag: 'keep' },
    },
    {
      id: 'categories',
      type: 'categories',
      enabled: true,
      content: { title: 'دسته‌بندی محصولات' },
      settings: { limit: 4 },
    },
    {
      id: 'best',
      type: 'best-sellers',
      enabled: true,
      content: {
        title: 'پرفروش‌ترین‌ها',
        subtitle: 'انتخاب‌های محبوب مشتریان',
      },
      settings: { mode: 'auto', limit: 8, productIds: [1, 2], promotions: {} },
    },
    {
      id: 'campaign',
      type: 'campaign',
      enabled: true,
      content: { title: 'پیشنهاد ویژه' },
      settings: { productIds: [1], endsAt: null },
    },
    {
      id: 'videos',
      type: 'videos',
      enabled: true,
      content: {
        title: 'ویدیوهای آموزشی',
        subtitle: 'نکات، آموزش و معرفی محصولات',
      },
      settings: { limit: 8 },
    },
    {
      id: 'footer',
      type: 'footer',
      enabled: true,
      content: { about: 'توضیح قدیمی' },
      settings: { legacyToken: true },
    },
  ],
};
const categories = [
  { id: 1, name: 'مراقبت پوست' },
  { id: 2, name: 'مراقبت مو' },
  { id: 3, name: 'آرایشی' },
  { id: 4, name: 'بدن' },
];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/fixtures/')) {
    if (url.pathname.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
      return fs.createReadStream(path.join(root, 'assets/beauty-intro.mp4')).pipe(res);
    }
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.end(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="360"><rect width="300" height="360" fill="#faf3f5"/><rect x="100" y="70" width="100" height="220" rx="20" fill="#e5bdb4"/><rect x="123" y="45" width="55" height="35" rx="8" fill="#69434e"/><text x="150" y="190" text-anchor="middle" font-family="serif" font-size="35" fill="#69434e">L</text></svg>',
    );
  }
  const isBase = url.pathname.startsWith('/baseline/'),
    base = isBase ? baseline : root;
  const relative = url.pathname.replace(/^\/(?:new|baseline)\//, '');
  const file = path.resolve(base || root, decodeURIComponent(relative));
  if (!file.startsWith(path.resolve(base || root) + path.sep)) {
    res.writeHead(403);
    return res.end();
  }
  const types = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.png': 'image/png',
  };
  try {
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file)
      .on('error', () => {
        res.writeHead(404);
        res.end();
      })
      .pipe(res);
  } catch (_) {
    res.writeHead(404);
    res.end();
  }
});
function fixture(origin) {
  const products = [
    {
      id: 1,
      name: 'سرم نمونه',
      categoryId: 1,
      category: categories[0],
      stockQty: 8,
      price: 850000,
      salePrice: 690000,
      discountPercent: 18,
      prices: [{ price: 690000 }],
      media: [{ kind: 'image', url: origin + '/fixtures/1.svg' }],
    },
    {
      id: 2,
      name: 'شامپو نمونه',
      categoryId: 2,
      category: categories[1],
      stockQty: 0,
      price: 700000,
      prices: [{ price: 700000 }],
      media: [{ kind: 'image', url: origin + '/fixtures/2.svg' }],
    },
  ];
  const page = {
    id: 4,
    slug: 'home',
    title: 'صفحه اصلی',
    config: copy(configuration),
    theme: copy(theme),
    publishedConfig: copy(configuration),
    publishedTheme: copy(theme),
    revision: 3,
    updatedAt: '2026-10-14T20:00:00.000Z',
    publishedAt: '2026-10-14T19:00:00.000Z',
  };
  return {
    page,
    products,
    categories,
    assets: [
      {
        id: 1,
        kind: 'image',
        url: origin + '/fixtures/1.svg',
        altText: 'تصویر نمونه',
        bytes: 1024,
        width: 300,
        height: 360,
      },
      {
        id: 2,
        kind: 'video',
        url: origin + '/fixtures/demo.mp4',
        altText: 'ویدیو نمونه',
        bytes: 1500,
        width: 1080,
        height: 1920,
        duration: 10,
      },
    ],
    writes: [],
    failSave: false,
    clock: 0,
  };
}
async function setup(page, state) {
  await page.addInitScript(() => {
    localStorage.setItem('sellerToken', 'test-token');
    localStorage.setItem('sellerInfo', JSON.stringify({ id: 1, name: 'فروشگاه نمونه' }));
    sessionStorage.setItem('crmBeautyIntroSeenV9', '1');
  });
  await page.route('https://crm-backend-apj4.onrender.com/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      name = url.pathname.replace('/api', ''),
      method = request.method();
    let data;
    if (name === '/storefront/editor/home' && method === 'GET') data = state.page;
    else if (name === '/storefront/editor/home' && method === 'PUT') {
      if (state.failSave)
        return route.fulfill({
          status: 503,
          json: { error: 'ذخیره آزمایشی ناموفق بود' },
        });
      const body = request.postDataJSON();
      if (body.expectedUpdatedAt !== state.page.updatedAt)
        return route.fulfill({
          status: 409,
          json: { error: 'پیش‌نویس تغییر کرده است' },
        });
      state.writes.push({ method, name, body: copy(body) });
      state.page.config = copy(body.config);
      state.page.theme = copy(body.theme);
      state.page.updatedAt = new Date(
        Date.parse('2026-10-14T20:00:00Z') + 1000 * ++state.clock,
      ).toISOString();
      data = state.page;
    } else if (name === '/storefront/editor/home/publish' && method === 'POST') {
      const body = request.postDataJSON();
      if (body.expectedUpdatedAt !== state.page.updatedAt)
        return route.fulfill({
          status: 409,
          json: { error: 'پیش‌نویس بعد از مرور تغییر کرده است' },
        });
      state.writes.push({ method, name, body });
      state.page.publishedConfig = copy(state.page.config);
      state.page.publishedTheme = copy(state.page.theme);
      state.page.revision++;
      state.page.updatedAt = new Date(
        Date.parse('2026-10-14T20:00:00Z') + 1000 * ++state.clock,
      ).toISOString();
      data = state.page;
    } else if (name === '/storefront/editor/home/versions')
      data = [
        {
          id: 8,
          revision: 2,
          note: 'نسخه نمونه',
          publishedAt: '2026-10-13T20:00:00Z',
        },
      ];
    else if (name === '/storefront/editor/home/versions/8') {
      data = {
        id: 8,
        revision: 2,
        config: copy(configuration),
        theme: copy(theme),
      };
      data.config.sections.find((s) => s.id === 'best').content.title = 'عنوان نسخه قبلی';
    } else if (name.startsWith('/storefront/public/')) {
      // Let the local fixture's renderer extensions register before resolving boot.
      // Immediate mock replies can otherwise race the parser's remaining scripts.
      await request.frame().waitForFunction(() => document.readyState !== 'loading');
      data = {
        config: state.page.publishedConfig,
        theme: state.page.publishedTheme,
        serverNow: '2026-10-14T20:00:00Z',
        revision: state.page.revision,
      };
    } else if (name.startsWith('/storefront-insights/public/')) data = { productIds: [2, 1] };
    else if (name === '/storefront/media' && method === 'GET') data = state.assets;
    else if (name === '/storefront/media/upload' && method === 'POST') {
      state.writes.push({ method, name });
      data = {
        id: 3,
        kind: 'image',
        url: new URL('/fixtures/new.svg', state.assets[0].url).href,
        altText: 'تصویر جدید',
        bytes: 1200,
        width: 300,
        height: 360,
      };
      state.assets.push(data);
    } else if (name.startsWith('/storefront/media/') && method === 'DELETE') {
      state.writes.push({ method, name });
      return route.fulfill({ status: 204, body: '' });
    } else if (name.includes('/products')) data = state.products;
    else if (name.includes('/categories')) data = state.categories;
    else if (name.includes('/store/public/'))
      data = {
        name: 'Lumière',
        phone: '02100000000',
        email: 'shop@example.test',
      };
    else data = [];
    return route.fulfill({ status: 200, json: copy(data) });
  });
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
}
async function editor(browser, origin, state, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await setup(page, state);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + '/new/panel/index.html#/storefront-editor');
  await page.locator('[data-storefront-workbench]').waitFor();
  await page.waitForFunction(
    () => window.StorefrontEditorComplete.state.iframe?.contentWindow?.StorefrontHome?.__editorContext,
  );
  return { page, context, errors };
}
async function run() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.EDITOR_CHROMIUM_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
    ],
  });
  try {
    const lateState = fixture(origin);
    lateState.page.publishedConfig.sections.find((s) => s.id === 'best').settings.editorOptionsV1 = {
      mobile: { gap: 17 },
    };
    const lateContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const latePage = await lateContext.newPage();
    await setup(latePage, lateState);
    await latePage.route('**/storefront-editor-customizations.js*', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: '' }),
    );
    await latePage.goto(origin + '/new/index.html');
    await latePage.locator('#storefront-home-root .sf-footer').waitFor();
    await latePage.addScriptTag({
      path: path.join(root, 'storefront-editor-customizations.js'),
    });
    await latePage.waitForFunction(() => window.StorefrontHome.__editorContext, null, { timeout: 5000 });
    await latePage.waitForFunction(
      () => getComputedStyle(document.querySelector('.sf-best-sellers .sf-product-scroll')).gap === '17px',
    );
    assert.equal(lateState.writes.length, 0, 'late customization bootstrap wrote to the API');
    await lateContext.close();
    console.log('PASS customization script loaded after home-ready');
    if (baseline)
      for (const viewport of [
        { width: 1400, height: 1000 },
        { width: 390, height: 844 },
      ]) {
        const photos = [];
        for (const prefix of ['baseline', 'new']) {
          const context = await browser.newContext({ viewport });
          const page = await context.newPage();
          const state = fixture(origin);
          await setup(page, state);
          await page.goto(origin + '/' + prefix + '/index.html');
          await page.locator('.sf-best-sellers .sf-product-card').first().waitFor();
          await page.waitForTimeout(1200);
          const geometry = await page.locator('#storefront-home-root').evaluate((root) =>
            [...root.children].map((n) => ({
              class: n.className,
              id: n.id,
              text: n.innerText,
              top: Math.round(n.getBoundingClientRect().top),
              height: Math.round(n.getBoundingClientRect().height),
            })),
          );
          const screenshot = await page.screenshot({
            path: path.join(output, prefix + '-' + viewport.width + '.png'),
            fullPage: true,
            animations: 'disabled',
          });
          photos.push({ geometry, screenshot });
          await context.close();
        }
        assert.deepEqual(
          photos[0].geometry,
          photos[1].geometry,
          'legacy appearance and section positions changed',
        );
        assert.equal(photos[0].screenshot.equals(photos[1].screenshot), true, 'legacy screenshot differs');
        console.log('PASS unchanged public appearance at ' + viewport.width + 'px');
      }
    const state = fixture(origin),
      ui = await editor(browser, origin, state),
      page = ui.page;
    await page.waitForTimeout(1300);
    assert.equal(state.writes.length, 0, 'opening wrote a draft');
    assert.deepEqual(await page.evaluate(() => window.StorefrontEditorComplete.state.config), configuration);
    const visibleOrder = ['__header', 'search', 'videos', 'best', 'campaign', 'categories', 'footer'];
    await page.waitForFunction(
      (expected) =>
        JSON.stringify(
          [...document.querySelectorAll('[data-visible-sections] [data-select]')].map(
            (n) => n.dataset.select,
          ),
        ) === JSON.stringify(expected),
      visibleOrder,
    );
    assert.equal(await page.locator('[data-hidden-sections]').evaluate((n) => n.open), false);
    assert.match(
      await page.locator('[data-hidden-sections] [data-select="legacy-hero"]').textContent(),
      /قدیمی؛ هنوز فعال نشده/,
    );
    await page.locator('[data-hidden-sections] summary').click();
    await page.locator('[data-select="legacy-hero"]').click();
    await page.locator('[data-tab="visibility"]').click();
    assert.equal(
      await page.locator('[data-field="settings.editorOptionsV1.visible"]').count(),
      0,
      'inactive legacy block showed an enabled visibility control',
    );
    await page.locator('[data-action="activate-section"]').click();
    await page.locator('[data-action="close"]').first().click();
    await page.waitForTimeout(1100);
    assert.equal(state.writes.length, 0, 'selecting or cancelling legacy activation saved a draft');
    assert.deepEqual(await page.evaluate(() => StorefrontEditorComplete.state.config), configuration);
    await page.locator('[data-select="best"]').click();
    const oldFrame = await page.locator('[data-preview-frame]').elementHandle();
    await page.locator('[data-field="content.title"]').fill('عنوان تازه');
    await page.waitForTimeout(1500);
    assert.equal(state.writes.filter((x) => x.name === '/storefront/editor/home').length, 1);
    assert.deepEqual(
      state.page.config.sections.map((s) => s.id),
      configuration.sections.map((s) => s.id),
    );
    assert.equal(state.page.config.sections[1].settings.oldFlag, 'keep');
    assert.equal(
      state.page.publishedConfig.sections.find((s) => s.id === 'best').content.title,
      'پرفروش‌ترین‌ها',
    );
    assert.equal(
      await page.evaluate((el) => el === window.StorefrontEditorComplete.state.iframe, oldFrame),
      true,
      'typing recreated preview frame',
    );
    assert.equal(
      await page.locator('[data-field="content.title"]').evaluate((el) => el === document.activeElement),
      true,
      'typing lost focus',
    );
    const frame = page.frames().find((f) => f.parentFrame());
    await frame.waitForFunction(
      () => document.querySelector('.sf-best-sellers h2')?.textContent === 'عنوان تازه',
    );
    await page.locator('[data-tab="layout"]').click();
    await page.locator('[data-scope="mobile"]').click();
    await page.locator('[data-field="settings.editorOptionsV1.mobile.gap"]').fill('18');
    await page.locator('[data-device="mobile"]').click();
    await page.waitForTimeout(1500);
    await frame.waitForFunction(
      () => getComputedStyle(document.querySelector('.sf-best-sellers .sf-product-scroll')).gap === '18px',
      null,
      { timeout: 5000 },
    );
    assert.equal(await frame.evaluate(() => innerWidth), 390);
    await page.locator('[data-device="desktop"]').click();
    await page.waitForTimeout(300);
    assert.equal(await frame.evaluate(() => innerWidth), 1180);
    assert.notEqual(
      await frame.evaluate(
        () => getComputedStyle(document.querySelector('.sf-best-sellers .sf-product-scroll')).gap,
      ),
      '18px',
    );
    await page.locator('[data-action="review"]').click();
    assert.equal(
      state.writes.some((x) => x.name.endsWith('/publish')),
      false,
    );
    await page.locator('[data-action="close"]').first().click();
    await page.locator('[data-action="versions"]').click();
    await page.locator('[data-action="version"]').click();
    await page.locator('[data-action="restore-section"]').click();
    await page.waitForTimeout(1500);
    assert.deepEqual(
      state.page.config.sections.map((s) => s.id),
      configuration.sections.map((s) => s.id),
    );
    assert.equal(state.page.config.sections.find((s) => s.id === 'best').content.title, 'عنوان نسخه قبلی');
    assert.equal(
      state.writes.some((x) => x.name.endsWith('/publish')),
      false,
    );
    await page.locator('[data-action="media"]').click();
    await page.locator('[data-media-grid] .sfe-media-card').first().waitFor();
    await page.locator('[data-action="close"]').first().click();
    await page.locator('[data-tab="content"]').click();
    await page.locator('[data-action="products"]').click();
    await page.locator('[data-stock]').check();
    assert.equal(await page.locator('[data-product-id="2"]').count(), 0);
    await page.locator('[data-stock]').uncheck();
    await page.locator('[data-product-move="1"][data-direction="-1"]').click();
    await page.locator('[data-action="apply-products"]').click();
    await page.waitForTimeout(1500);
    assert.deepEqual(state.page.config.sections.find((s) => s.id === 'best').settings.productIds, [2, 1]);
    await page.locator('[data-select="videos"]').click();
    await page.locator('[data-action="videos"]').click();
    await page.locator('[data-video-url]').check();
    await page.locator('[data-action="poster"]').click();
    await page.locator('[data-action="use-media"]').click();
    await page.locator('[data-action="apply-videos"]').waitFor();
    await page.locator('[data-action="apply-videos"]').click();
    await frame.locator('.sf-video-card video[poster]').waitFor();
    assert.equal(
      await frame.locator('.sf-video-card video').getAttribute('poster'),
      origin + '/fixtures/1.svg',
    );
    await page.locator('[data-select="categories"]').click();
    await page.locator('[data-tab="visibility"]').click();
    await page.locator('[data-field="settings.editorOptionsV1.visible"]').uncheck();
    await frame.waitForFunction(() => {
      const node = document.querySelector('#sf-categories');
      return !node || getComputedStyle(node).display === 'none';
    });
    await page.waitForTimeout(200);
    assert.equal(await frame.locator('#sf-categories').isVisible(), false);
    assert.equal(await page.locator('[data-hidden-sections] [data-select="categories"]').count(), 1);
    assert.match(await page.locator('[data-section-notice]').innerText(), /نمایش این بخش خاموش است/);
    await page.locator('[data-field="settings.editorOptionsV1.visible"]').check();
    await frame.locator('#sf-categories').waitFor({ state: 'visible' });
    await page.locator('[data-visible-sections] [data-select="categories"]').waitFor();
    await page.locator('[data-action="add"]').click();
    await page.locator('[data-add="hero"]').click();
    await page.locator('[data-field="content.title"]').fill('بنر تازه در پیش‌نویس');
    await frame.locator('.sf-editor-block').waitFor({ state: 'visible' });
    assert.equal(await frame.locator('.sf-editor-block').count(), 1, 'legacy hidden block became visible');
    await page.waitForFunction(
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
    assert.deepEqual(
      state.page.config.sections.filter((s) => !s.settings?.editorManagedV1).map((s) => s.id),
      configuration.sections.map((s) => s.id),
    );
    assert.deepEqual(state.page.publishedConfig, configuration, 'a new section was automatically published');
    await page.locator('[data-select="best"]').click();
    await frame.waitForFunction(
      () => {
        const section = document.querySelector('.sf-best-sellers');
        return (
          section?.hasAttribute('data-sfe-selected') &&
          section.getBoundingClientRect().top >= 0 &&
          section.getBoundingClientRect().top < 160
        );
      },
      null,
      { timeout: 5000 },
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      'desktop horizontal overflow',
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: path.join(output, 'editor-desktop.png'),
      fullPage: true,
      animations: 'disabled',
    });
    assert.deepEqual(ui.errors, [], 'browser JavaScript errors');
    console.log(
      'PASS editor read-only open, autosave, order preservation, focus/frame stability, device controls, draft/live separation, version restore and product picker',
    );
    await ui.context.close();
    const mobileState = fixture(origin),
      mobile = await editor(browser, origin, mobileState, {
        width: 390,
        height: 844,
      });
    await mobile.page.locator('[data-pane="settings"]').click();
    await mobile.page.locator('[data-field="content.title"]').fill('ویرایش موبایل');
    await mobile.page.waitForTimeout(1500);
    assert.equal(
      await mobile.page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      'mobile horizontal overflow',
    );
    const mobileWrites = mobileState.writes.length;
    await mobile.page.locator('[data-pane="sections"]').click();
    await mobile.page.locator('[data-hidden-sections] summary').click();
    await mobile.page.locator('[data-select="legacy-hero"]').click();
    assert.equal(
      await mobile.page.locator('[data-storefront-workbench]').getAttribute('data-pane'),
      'settings',
    );
    assert.equal(await mobile.page.locator('[data-action="activate-section"]').isVisible(), true);
    assert.equal(mobileState.writes.length, mobileWrites, 'mobile hidden section selection saved a draft');
    await mobile.page.evaluate(() => scrollTo(0, 0));
    await mobile.page.screenshot({
      path: path.join(output, 'editor-mobile.png'),
      fullPage: true,
      animations: 'disabled',
    });
    assert.deepEqual(mobile.errors, []);
    await mobile.context.close();
    console.log('PASS mobile editor');
    const activationState = fixture(origin),
      activation = await editor(browser, origin, activationState);
    const activationFrame = activation.page.frames().find((f) => f.parentFrame());
    await activation.page.locator('[data-hidden-sections] summary').click();
    await activation.page.locator('[data-select="legacy-hero"]').click();
    await activation.page.locator('[data-action="activate-section"]').click();
    await activation.page.locator('[data-action="confirm-activate-section"]').click();
    await activationFrame.locator('[data-editor-section="legacy-hero"]').waitFor({ state: 'visible' });
    await activation.page.locator('[data-visible-sections] [data-select="legacy-hero"]').waitFor();
    await activation.page.waitForFunction(
      () =>
        !StorefrontEditorComplete.state.saving &&
        StorefrontEditorComplete.state.server.config.sections.find((s) => s.id === 'legacy-hero').settings
          .editorManagedV1 === true,
    );
    const expectedActivation = copy(configuration);
    expectedActivation.sections[1].settings.editorManagedV1 = true;
    assert.deepEqual(
      activationState.page.config,
      expectedActivation,
      'activation changed legacy content, metadata or stored order',
    );
    assert.deepEqual(
      activationState.page.publishedConfig,
      configuration,
      'activation published live content',
    );
    assert.equal(activationState.writes.filter((w) => w.name.endsWith('/publish')).length, 0);
    assert.deepEqual(
      await activation.page
        .locator('[data-visible-sections] [data-select]')
        .evaluateAll((nodes) => nodes.map((n) => n.dataset.select).filter((id) => id !== 'legacy-hero')),
      visibleOrder,
      'activation moved an existing storefront section',
    );
    await activation.page.locator('[data-select="best"]').click();
    await activationFrame.locator('[data-editor-section="legacy-hero"] h1').click();
    await activation.page.waitForFunction(
      () => StorefrontEditorComplete.state.activeSection === 'legacy-hero',
    );
    assert.equal(
      await activation.page.locator('[data-select="legacy-hero"]').getAttribute('aria-pressed'),
      'true',
    );
    await activation.page.locator('[data-action="undo"]').click();
    await activationFrame.locator('[data-editor-section="legacy-hero"]').waitFor({ state: 'detached' });
    await activation.page.waitForFunction(
      () =>
        !StorefrontEditorComplete.state.saving &&
        !StorefrontEditorComplete.state.server.config.sections.find((s) => s.id === 'legacy-hero').settings
          .editorManagedV1,
    );
    assert.deepEqual(
      activationState.page.config,
      configuration,
      'undo did not restore the original hidden block',
    );
    assert.equal(
      await activation.page.locator('[data-hidden-sections] [data-select="legacy-hero"]').count(),
      1,
    );
    assert.deepEqual(activation.errors, []);
    await activation.context.close();
    console.log('PASS preview-ordered outline, hidden section reasons, explicit legacy activation and undo');
    const fallbackState = fixture(origin);
    fallbackState.page.config.sections = [copy(configuration.sections[1])];
    fallbackState.page.publishedConfig = copy(fallbackState.page.config);
    const fallback = await editor(browser, origin, fallbackState);
    await fallback.page.locator('[data-visible-sections] [data-select="__template-best-sellers"]').waitFor();
    await fallback.page.locator('[data-select="__template-best-sellers"]').click();
    assert.match(await fallback.page.locator('[data-inspector]').innerText(), /قالب فعلی/);
    await fallback.page.waitForTimeout(1100);
    assert.equal(fallbackState.writes.length, 0, 'template fallback inserted draft defaults on opening');
    assert.deepEqual(
      await fallback.page.evaluate(() => StorefrontEditorComplete.state.config),
      fallbackState.page.config,
    );
    assert.deepEqual(fallback.errors, []);
    await fallback.context.close();
    console.log('PASS template-only sections remain read-only without inserting defaults');
    const recoveryState = fixture(origin),
      recovery = await editor(browser, origin, recoveryState);
    recoveryState.failSave = true;
    await recovery.page.locator('[data-field="content.title"]').fill('کار ذخیره‌نشده');
    await recovery.page.waitForTimeout(1400);
    assert.equal(recoveryState.writes.length, 0);
    assert.equal(
      await recovery.page.evaluate(() => localStorage.getItem('crm-storefront-draft:v1:1') !== null),
      true,
    );
    await recovery.page.reload();
    await recovery.page.locator('[data-action="recover"]').waitFor();
    assert.equal(recoveryState.writes.length, 0);
    recoveryState.failSave = false;
    await recovery.page.locator('[data-action="recover"]').click();
    await recovery.page.waitForFunction(
      () =>
        !StorefrontEditorComplete.state.saving &&
        StorefrontEditorComplete.state.server.config.sections.find((s) => s.id === 'best').content.title ===
          'کار ذخیره‌نشده',
    );
    assert.equal(
      recoveryState.page.config.sections.find((s) => s.id === 'best').content.title,
      'کار ذخیره‌نشده',
    );
    await recovery.context.close();
    console.log('PASS failed save and explicit local recovery');
    const conflictState = fixture(origin),
      conflict = await editor(browser, origin, conflictState);
    conflictState.page.config.sections.find((s) => s.id === 'best').content.title = 'ویرایش دستگاه دیگر';
    await conflict.page.locator('[data-field="content.title"]').fill('کار من');
    await conflict.page.waitForFunction(() => StorefrontEditorComplete.state.conflict);
    assert.equal(conflictState.writes.length, 0);
    assert.equal(await conflict.page.evaluate(() => window.StorefrontEditorComplete.state.conflict), true);
    assert.match(await conflict.page.locator('[data-notice]').innerText(), /جای دیگری/);
    for (let reload = 0; reload < 2; reload++) {
      await conflict.page.reload();
      await conflict.page.locator('[data-action="recover"]').waitFor();
      await conflict.page.locator('[data-action="recover"]').click();
      await conflict.page.waitForTimeout(1200);
      assert.equal(conflictState.writes.length, 0, 'recovery overwrote another device');
      assert.equal(await conflict.page.evaluate(() => StorefrontEditorComplete.state.conflict), true);
      assert.equal(
        conflictState.page.config.sections.find((s) => s.id === 'best').content.title,
        'ویرایش دستگاه دیگر',
      );
    }
    await conflict.context.close();
    console.log('PASS concurrent draft conflict retains local work');
    const publishState = fixture(origin),
      publishing = await editor(browser, origin, publishState);
    await publishing.page.locator('[data-field="content.title"]').fill('انتشار آزمایشی');
    await publishing.page.waitForFunction(
      () =>
        !StorefrontEditorComplete.state.saving &&
        StorefrontEditorComplete.state.server.config.sections.find((s) => s.id === 'best').content.title ===
          'انتشار آزمایشی',
    );
    await publishing.page.locator('[data-action="review"]').click();
    await publishing.page.locator('[data-field="__note"]').fill('بررسی شده');
    assert.equal(
      publishState.writes.some((x) => x.name.endsWith('/publish')),
      false,
    );
    await publishing.page.locator('[data-action="publish"]').click();
    await publishing.page.waitForFunction(
      () =>
        StorefrontEditorComplete.state.published.config.sections.find((s) => s.id === 'best').content
          .title === 'انتشار آزمایشی',
    );
    assert.equal(publishState.writes.filter((x) => x.name.endsWith('/publish')).length, 1);
    assert.equal(publishState.writes.find((x) => x.name.endsWith('/publish')).body.note, 'بررسی شده');
    await publishing.context.close();
    console.log('PASS publish only after explicit review and action');
  } finally {
    await browser.close();
    server.close();
  }
}
if (require.main === module)
  run().catch((error) => {
    console.error(error);
    server.close();
    process.exitCode = 1;
  });
else module.exports = { server, fixture, editor, setup, configuration, theme };
