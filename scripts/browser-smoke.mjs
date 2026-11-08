import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { projects } from '../projects.js';

const baseURL = (process.env.PAGES_URL || process.argv[2] || '').trim().replace(/\/?$/, '/');
if (!/^https:\/\//i.test(baseURL)) {
  throw new Error('Pass the deployed GitHub Pages URL as PAGES_URL or the first argument.');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];
const badResponses = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('requestfailed', request => failedRequests.push({
  url: request.url(),
  error: request.failure()?.errorText || 'unknown'
}));
page.on('response', response => {
  if (response.status() >= 400) badResponses.push({
    url: response.url(),
    status: response.status()
  });
});

let blockFirstPGliteRequest = true;
await page.route(
  /https:\/\/cdn\.jsdelivr\.net\/npm\/@electric-sql\/pglite@0\.5\.15\/dist\/index\.js(?:\?.*)?$/,
  async route => {
    if (blockFirstPGliteRequest) {
      blockFirstPGliteRequest = false;
      await route.abort('failed');
      return;
    }
    await route.continue();
  }
);

const readEditor = locator => locator.evaluate(element => {
  const instance = element.parentElement.querySelector('.CodeMirror')?.CodeMirror;
  return instance ? instance.getValue() : element.value;
});
const writeEditor = (locator, value) => locator.evaluate((element, nextValue) => {
  const instance = element.parentElement.querySelector('.CodeMirror')?.CodeMirror;
  if (instance) instance.setValue(nextValue);
  else {
    element.value = nextValue;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}, value);
const waitForEngine = () => page.waitForFunction(
  () => document.querySelector('#engine-status')?.textContent === 'PostgreSQL готов',
  null,
  { timeout: 240_000 }
);
const assertNoHorizontalOverflow = async width => {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  assert.ok(
    metrics.document <= width + 1 && metrics.body <= width + 1,
    `Horizontal overflow at ${width}px: ${JSON.stringify(metrics)}`
  );
};

try {
  const navigationStartedAt = Date.now();
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  try {
    await page.locator('#app-content .hero').waitFor({ state: 'visible', timeout: 45_000 });
  } catch (error) {
    const diagnostic = await page.evaluate(async () => {
      const response = await fetch('./version.json?browser-diagnostic=' + Date.now(), { cache: 'no-store' }).catch(fetchError => null);
      return {
        url: location.href,
        appContent: document.querySelector('#app-content')?.innerText,
        buildResponseStatus: response?.status ?? null,
        buildResponseText: response?.ok ? await response.text() : null
      };
    }).catch(e => ({ evaluationError: e.message }));
    console.error('Initial application render diagnostics:', JSON.stringify({
      diagnostic, pageErrors, consoleErrors, failedRequests, badResponses
    }));
    throw error;
  }
  const shellReadyMs = Date.now() - navigationStartedAt;
  assert.ok(shellReadyMs < 30_000, `The initial learning interface took too long to render: ${shellReadyMs}ms`);

  const build = await page.evaluate(async () => {
    const response = await fetch('./version.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Cannot read the deployed version.json');
    return (await response.json()).build;
  });
  assert.ok(typeof build === 'string' && build.length > 0, 'The deployed app must publish a build identifier');

  await page.locator('#app-content .feedback[role="alert"]').waitFor({ state: 'visible', timeout: 60_000 });
  assert.equal(await page.locator('#engine-status').textContent(), 'Ошибка движка');
  assert.equal(await page.locator('#app-content .hero').isVisible(), true, 'Database failure must not replace the learning page');
  assert.equal(await page.locator('#app-content [data-action="retry-engine"]').isVisible(), true, 'Database failure must expose a retry action');

  await page.locator('#sidebar [data-nav="courses"]').click();
  const courseCards = page.locator('#app-content .course-card');
  assert.equal(await courseCards.count(), 2, 'The catalog must show only the two implemented courses');
  assert.deepEqual(await courseCards.locator('h2').allTextContents(), ['SQL для аналитика данных','PostgreSQL']);
  await page.locator('[data-open-course="core"]').click();
  await page.locator('[data-module="foundations"]').click();
  assert.equal(await page.locator('.lesson-track-group h3').textContent(), 'SQL для аналитика данных');
  assert.equal(await page.locator('.lesson-track-group').count(), 1, 'A lesson must show only its own course in the sidebar');
  assert.match(await page.locator('#side-progress-detail').textContent(), /112 уроков · SQL для аналитика данных/, 'Sidebar progress must follow the selected SQL course');
  await page.locator('#sidebar [data-nav="courses"]').click();
  await page.locator('[data-open-course="postgresql"]').click();
  await page.locator('[data-module="ddl"]').click();
  assert.equal(await page.locator('.lesson-track-group h3').textContent(), 'PostgreSQL');
  assert.equal(await page.locator('.lesson-track-group').count(), 1, 'The PostgreSQL lesson must not show the SQL course in its sidebar');
  assert.match(await page.locator('#side-progress-detail').textContent(), /61 уроков · PostgreSQL/, 'Sidebar progress must follow the selected PostgreSQL course');

  await page.locator('#sidebar [data-nav="playground"]').click();
  const editor = page.locator('#playground-editor');
  await editor.waitFor({ state: 'attached' });
  const draft = 'SELECT status, COUNT(*)::int AS orders_count\nFROM orders\nGROUP BY status\nORDER BY orders_count DESC;';
  await writeEditor(editor, draft);
  assert.equal(await page.evaluate(() => localStorage.getItem('sql-academy-editor-v1')), draft, 'The SQL draft must be saved while PostgreSQL is unavailable');
  assert.equal(await page.locator('[data-action="run-playground"]').isDisabled(), true, 'SQL execution must stay disabled until the engine is ready');

  const recoveryStartedAt = Date.now();
  await page.getByRole('button', { name: 'Повторить запуск' }).click();
  await waitForEngine();
  const recoveryMs = Date.now() - recoveryStartedAt;
  assert.ok(recoveryMs > 0, 'The retry path must complete after the initial module request fails');
  assert.equal(await readEditor(editor), draft, 'Retrying PostgreSQL must preserve the in-progress SQL editor value');

  await page.locator('[data-action="run-playground"]').click();
  await page.locator('#playground-results .result-table').waitFor({ state: 'visible', timeout: 30_000 });
  const queryHeaders = await page.locator('#playground-results .result-table thead th').allTextContents();
  assert.deepEqual(queryHeaders, ['status', 'orders_count'], 'The playground must execute a real query against the seeded PostgreSQL database');

  const resetStartedAt = Date.now();
  await page.locator('[data-action="reset-db"]').click();
  await waitForEngine();
  const resetReadyMs = Date.now() - resetStartedAt;
  assert.equal(await readEditor(editor), draft, 'Resetting the database must preserve the SQL draft');
  await page.locator('[data-action="run-playground"]').click();
  await page.locator('#playground-results .result-table').waitFor({ state: 'visible', timeout: 30_000 });

  await page.locator('#sidebar [data-nav="practice"]').click();
  assert.equal(await page.locator('[data-practice-track="core"]').getAttribute('aria-pressed'), 'true');
  assert.ok(await page.locator('.exercise-item').count() > 0, 'The SQL course must expose its own practice tasks');
  await page.locator('[data-practice-track="postgresql"]').click();
  assert.equal(await page.locator('[data-practice-track="postgresql"]').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('.task-meta').textContent(), /^ЗАДАНИЕ 1 ИЗ \d+/, 'Switching practice courses must start at the first task of the selected course');
  assert.match(await page.locator('#side-progress-detail').textContent(), /61 уроков · PostgreSQL/, 'Practice progress must follow the selected course');
  await page.locator('[data-action="next-exercise"]').click();
  assert.match(await page.locator('.task-meta').textContent(), /^ЗАДАНИЕ 2 ИЗ \d+/, 'Previous/next practice navigation must stay within the selected course');

  await page.locator('#sidebar [data-nav="projects"]').click();
  assert.equal(await page.locator('#app-content .project-card').count(), 3, 'The catalog must show E-commerce, delivery, and Product Analytics projects');
  await page.locator('[data-open-project="product"]').click();
  const productProject=projects.find(project=>project.id==='product');
  const firstProjectTask=productProject.tasks[0];
  assert.equal(await page.locator('#app-content .project-task-nav').count(), 3, 'Each project must expose its three ordered tasks');
  assert.equal(await page.locator('.project-task-content h2').textContent(), firstProjectTask.title);
  assert.equal(await page.locator('.project-solution').count(), 0, 'Reference SQL must remain hidden by default');

  const projectEditor=page.locator('#project-editor');
  await writeEditor(projectEditor,'SELECT 1;');
  await page.locator('[data-action="check-project-task"]').click();
  await page.locator('#project-feedback .feedback.fail').waitFor({state:'visible'});
  await writeEditor(projectEditor,firstProjectTask.solution);
  await page.locator('[data-action="check-project-task"]').click();
  await page.locator('#project-feedback .feedback.success').waitFor({state:'visible',timeout:15_000});
  assert.equal(await page.locator('#project-task-'+firstProjectTask.id).evaluate(element=>element.classList.contains('done')),true,'A correct project result must mark the task complete');
  assert.ok((await page.evaluate(()=>localStorage.getItem('sql-academy-project-progress-v1'))||'').includes(firstProjectTask.id),'Project completion must persist independently');

  const secondProjectTask=productProject.tasks[1];
  await page.locator('[data-project-task="'+secondProjectTask.id+'"]').click();
  const projectDraft='SELECT customer_id FROM product_events;';
  await writeEditor(page.locator('#project-editor'),projectDraft);
  assert.ok((await page.evaluate(()=>localStorage.getItem('sql-academy-project-drafts-v1'))||'').includes(projectDraft),'Project drafts must be saved automatically');
  await page.locator('[data-action="show-project-solution"]').click();
  assert.equal(await page.locator('.project-solution').count(),1,'The reference solution must appear only after an explicit request');
  await page.locator('[data-action="show-project-solution"]').click();
  assert.equal(await page.locator('.project-solution').count(),0,'The reference solution must be hideable');
  await page.locator('[data-project-task="'+secondProjectTask.id+'"]').click();
  assert.equal(await readEditor(page.locator('#project-editor')),projectDraft,'Switching away and back must preserve the project SQL draft');

  await page.setViewportSize({ width: 390, height: 844 });
  const menuButton = page.locator('#mobile-menu');
  assert.equal(await menuButton.getAttribute('aria-expanded'), 'false');
  await menuButton.click();
  assert.equal(await menuButton.getAttribute('aria-expanded'), 'true', 'Mobile menu must expose its expanded state');
  assert.equal(await page.locator('#sidebar').evaluate(element => element.classList.contains('open')), true);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-nav')), 'dashboard', 'Opening the mobile menu must move focus into navigation');
  await page.keyboard.press('Escape');
  assert.equal(await menuButton.getAttribute('aria-expanded'), 'false', 'Escape must close the mobile menu');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'mobile-menu', 'Escape must restore focus to the menu trigger');

  await menuButton.click();
  await page.locator('#sidebar [data-nav="practice"]').click();
  await page.locator('#app-content .exercise-layout').waitFor({ state: 'visible' });
  assert.equal(await menuButton.getAttribute('aria-expanded'), 'false', 'Following a mobile navigation link must close the menu');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'mobile-menu', 'Navigation must return focus to the mobile menu trigger');

  await page.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(320);
  await menuButton.click();
  await page.locator('#sidebar .nav-item[data-nav="dashboard"]').click();
  await page.locator('#app-content .hero').waitFor({ state: 'visible' });
  await assertNoHorizontalOverflow(320);
  await menuButton.click();
  await page.locator('#sidebar .nav-item[data-nav="playground"]').click();
  await page.locator('#playground-editor').waitFor({ state: 'attached' });
  await assertNoHorizontalOverflow(320);
  assert.equal(await readEditor(page.locator('#playground-editor')), draft, 'Navigation must not discard the saved SQL draft');

  assert.deepEqual(pageErrors, [], `Unexpected uncaught browser errors: ${pageErrors.join('; ')}`);
  console.log('SQL Academy live browser smoke passed:', JSON.stringify({
    url: baseURL,
    build,
    shellReadyMs,
    recoveryMs,
    resetReadyMs,
    mobileWidths: [390, 320],
    checks: [
      'initial shell before database readiness',
      'failed PGlite import and successful retry with a fresh module URL',
      'SQL editor persistence while offline and after database reset',
      'real PostgreSQL query execution',
      'mobile menu state, Escape and focus restoration',
      '320px layout overflow on dashboard, practice and playground'
    ]
  }));
} catch (error) {
  await page.screenshot({ path: 'browser-smoke-failure.png', fullPage: true }).catch(() => {});
  console.error('Browser failure diagnostics:', JSON.stringify({
    pageErrors, consoleErrors, failedRequests, badResponses
  }));
  throw error;
} finally {
  await browser.close();
}
