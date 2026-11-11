import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { projects } from '../projects.js';
import { modules, exercises } from '../curriculum.js';
import { cumulativeCheckpoints } from '../checkpoints.js';

const baseURL = (process.env.PAGES_URL || process.argv[2] || '').trim().replace(/\/?$/, '/');
if (!/^https:\/\//i.test(baseURL)) {
  throw new Error('Pass the deployed GitHub Pages URL as PAGES_URL or the first argument.');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
await mkdir('ux-audit-screenshots', { recursive: true });
const captureUxScreen = async name => {
  await page.locator('.toast').waitFor({ state: 'detached', timeout: 3_000 }).catch(() => {});
  await page.screenshot({ path: `ux-audit-screenshots/${name}.png`, fullPage: true, animations: 'disabled' });
};
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
    assert.deepEqual(await page.locator('.stat-course-counts span').allTextContents(), ['SQL · 112', 'PostgreSQL · 61'], 'The dashboard must show lesson totals separately for the two independent courses');
    await captureUxScreen('01-dashboard-desktop-pglite-error');
    await page.keyboard.press('Tab');
    const keyboardFocus = await page.evaluate(() => ({ visible: document.activeElement?.matches(':focus-visible'), outline: getComputedStyle(document.activeElement).outlineStyle }));
    assert.equal(keyboardFocus.visible, true, 'Keyboard navigation must expose :focus-visible');
    assert.notEqual(keyboardFocus.outline, 'none', 'Keyboard-focused controls must have a visible outline');
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
  // Direct URL routing and browser history must restore the same learning view.
  await page.goto(baseURL + '#view=courses', { waitUntil: 'domcontentloaded' });
  await page.locator('#app-content .course-card').first().waitFor({ state: 'visible' });
  await page.goto(baseURL + '#view=study&module=foundations', { waitUntil: 'domcontentloaded' });
  await page.locator('#app-content .lesson-track-group').waitFor({ state: 'visible' });
  assert.match(await page.locator('.lesson-track-group h3').textContent(), /SQL для аналитика данных/);
  await page.goBack();
  await page.locator('#app-content .course-card').first().waitFor({ state: 'visible' });
  await page.goForward();
  await page.locator('#app-content .lesson-track-group').waitFor({ state: 'visible' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#app-content .lesson-track-group').waitFor({ state: 'visible' });
  assert.match(await page.locator('.lesson-track-group h3').textContent(), /SQL для аналитика данных/);
  await page.goto(baseURL + '#view=progress', { waitUntil: 'domcontentloaded' });
  await page.locator('#app-content .progress-course-card').first().waitFor({ state: 'visible' });
  assert.equal(await page.locator('#app-content .progress-project-card').count(), 3, 'Direct progress routes must restore the full progress screen');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#app-content .progress-course-card').first().waitFor({ state: 'visible' });
  await page.goto(baseURL + '#view=roadmap&track=postgresql', { waitUntil: 'domcontentloaded' });
  await page.locator('#app-content .course-subnav').waitFor({ state: 'visible' });
  assert.match(await page.locator('.course-subnav-context strong').textContent(), /PostgreSQL/, 'The course sub-navigation must show the selected PostgreSQL route');
  await page.locator('.course-subnav [data-course-nav="practice"]').click();
  assert.equal(await page.locator('.practice-course-switch [data-practice-track="postgresql"]').getAttribute('aria-pressed'), 'true', 'Moving from the PostgreSQL program to practice must preserve the selected track');
  assert.match(page.url(), /track=postgresql/, 'The selected course must be preserved in the practice URL');
  await page.locator('.course-subnav [data-course-nav="assessment"]').click();
  assert.ok(await page.locator('.assessment-track-tabs [data-assessment-track="postgresql"]').evaluate(el => el.classList.contains('active')), 'Moving to assessments must preserve the PostgreSQL track');
  await page.locator('.course-subnav [data-course-nav="study"]').click();
  assert.match(await page.locator('.lesson-track-group h3').textContent(), /PostgreSQL/, 'The theory view must open inside the selected PostgreSQL route');
  await page.locator('.course-subnav [data-course-nav="roadmap"]').click();
  assert.match(await page.locator('.course-subnav-context strong').textContent(), /PostgreSQL/, 'Returning to the program must keep the same course selected');
  await page.goBack();
  assert.match(await page.locator('.lesson-track-group h3').textContent(), /PostgreSQL/, 'Browser Back must restore the PostgreSQL theory view');
  await page.goForward();
  assert.match(await page.locator('.course-subnav-context strong').textContent(), /PostgreSQL/, 'Browser Forward must restore the PostgreSQL program view');
  await page.goto(baseURL + '#view=roadmap&track=core', { waitUntil: 'domcontentloaded' });
  await page.locator('.course-subnav [data-course-nav="practice"]').click();
  assert.equal(await page.locator('.practice-course-switch [data-practice-track="core"]').getAttribute('aria-pressed'), 'true', 'The core route must remain separate from PostgreSQL practice');
  await page.goto(baseURL + '#view=dashboard', { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('#sidebar button.nav-item[data-nav="dashboard"]').getAttribute('aria-current'), 'page', 'The active dashboard route must be exposed to assistive technology');
  await page.locator('#sidebar button.nav-item[data-nav="progress"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#sidebar button.nav-item[data-nav="progress"]').getAttribute('aria-current'), 'page', 'Enter must navigate and update the active-page state');
  assert.equal(await page.locator('#sidebar button.nav-item[data-nav="dashboard"]').getAttribute('aria-current'), null, 'Inactive navigation items must not claim the current page');
  await page.locator('#sidebar button.nav-item[data-nav="courses"]').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#sidebar button.nav-item[data-nav="courses"]').getAttribute('aria-current'), 'page', 'Space must navigate and update the active-page state');
  blockFirstPGliteRequest = true;
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('#app-content .hero').waitFor({ state: 'visible' });
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

  await page.locator('#sidebar button.nav-item[data-nav="courses"]').click();
  const courseCards = page.locator('#app-content .course-card');
  assert.equal(await courseCards.count(), 2, 'The catalog must show only the two implemented courses');
  assert.deepEqual(await courseCards.locator('h2').allTextContents(), ['SQL для аналитика данных','PostgreSQL']);
  await captureUxScreen('02-course-catalog-desktop-pglite-error');
  await page.locator('[data-open-course="core"]').click();
  await page.locator('[data-module="foundations"]').click();
  assert.equal(await page.locator('.lesson-track-group h3').textContent(), 'SQL для аналитика данных');
  assert.equal(await page.locator('.lesson-track-group').count(), 1, 'A lesson must show only its own course in the sidebar');
  assert.match(await page.locator('#side-progress-detail').textContent(), /112 уроков · SQL для аналитика данных/, 'Sidebar progress must follow the selected SQL course');
  await captureUxScreen('03-sql-lesson-desktop-pglite-error');
  await page.locator('#sidebar button.nav-item[data-nav="courses"]').click();
  await page.locator('[data-open-course="postgresql"]').click();
  await page.locator('[data-module="ddl"]').click();
  assert.equal(await page.locator('.lesson-track-group h3').textContent(), 'PostgreSQL');
  assert.equal(await page.locator('.lesson-track-group').count(), 1, 'The PostgreSQL lesson must not show the SQL course in its sidebar');
  assert.match(await page.locator('#side-progress-detail').textContent(), /61 уроков · PostgreSQL/, 'Sidebar progress must follow the selected PostgreSQL course');
  await captureUxScreen('04-postgresql-lesson-desktop-pglite-error');

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
  await captureUxScreen('05-playground-desktop-dark');
  // Textbook research activity: first contact with SQL is interactive, notes and code survive reload.
  const firstLesson=modules.find(module=>module.id==='foundations').lessons[0];
  await page.goto(baseURL+'#view=study&module=foundations&lesson='+firstLesson.id,{waitUntil:'domcontentloaded'});
  await page.locator('.lesson-workshop').waitFor({state:'visible'});
  assert.match(await page.locator('.workshop-prompt').textContent(),/строк/,'The first lesson must have a specific reasoning task');
  await writeEditor(page.locator('#lesson-lab-editor'),'SELECT 7 AS observed_value;');
  await page.locator('[data-action="run-lesson-lab"]').click();
  await page.locator('#lesson-lab-results .result-table').waitFor({state:'visible'});
  assert.deepEqual(await page.locator('#lesson-lab-results tbody tr td').allTextContents(),['7'],'The first lesson must let the student execute a real read-only query');
  await page.locator('#lesson-lab-note').fill('Проверил значение, которое вернул SELECT без FROM.');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#lesson-lab-editor').waitFor({state:'attached'});
  assert.equal(await readEditor(page.locator('#lesson-lab-editor')),'SELECT 7 AS observed_value;','Lesson SQL experiments must preserve drafts');
  assert.match(await page.locator('#lesson-lab-note').inputValue(),/Проверил значение/,'Reasoning notes must survive reload');
  await captureUxScreen('05b-first-lesson-workshop');
  // Graded SQL practice lives in the textbook and reuses the standard result-based validator.
  const lesson=modules.find(module=>module.id==='select').lessons.find(item=>item.practiceIds.length);
  const ex=exercises.find(item=>item.id===lesson.practiceIds[0]);
  await page.goto(baseURL+'#view=study&module=select&lesson='+lesson.id,{waitUntil:'domcontentloaded'});
  await page.locator('#lesson-practice-editor').waitFor({state:'attached'});
  await writeEditor(page.locator('#lesson-practice-editor'),ex.solution);
  await page.locator('[data-action="check-inline-exercise"]').click();
  await page.locator('#lesson-practice-feedback .success').waitFor({state:'visible'});
  assert.ok(JSON.parse(await page.evaluate(()=>localStorage.getItem('sql-academy-progress-v1'))).exercises.includes(ex.id),'In-lesson graded SQL must share completion with main practice');
  await captureUxScreen('05c-inline-graded-sql-practice');

  const resetStartedAt = Date.now();
  await page.locator('[data-action="reset-db"]').click();
  await waitForEngine();
  const resetReadyMs = Date.now() - resetStartedAt;
  assert.equal(await readEditor(editor), draft, 'Resetting the database must preserve the SQL draft');
  await page.locator('[data-action="run-playground"]').click();
  await page.locator('#playground-results .result-table').waitFor({ state: 'visible', timeout: 30_000 });

  // Cumulative checkpoints must accept real SQL, reject wrong filters, and save drafts and passes.
  await page.locator('#sidebar .nav-item[data-nav="assessment"]').click();
  assert.equal(await page.locator('.checkpoint-card').count(), 3, 'The core route must expose three cumulative checkpoints');
  await page.locator('[data-checkpoint="core-foundation-check"]').click();
  const checkpointEditor=page.locator('#checkpoint-editor');
  await checkpointEditor.waitFor({state:'attached'});
  await writeEditor(checkpointEditor,"SELECT order_id, created_at, total_amount FROM orders WHERE status = 'shipped' ORDER BY total_amount DESC, order_id LIMIT 5;");
  await page.locator('[data-action="check-checkpoint-task"]').click();
  await page.locator('#checkpoint-feedback .fail').waitFor({state:'visible'});
  assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('sql-academy-progress-v1'))).checkpointTasks.length,0,'An incorrect query must not receive a cumulative exam credit');
  await writeEditor(checkpointEditor,cumulativeCheckpoints[0].tasks[0].solution);
  await page.locator('[data-action="check-checkpoint-task"]').click();
  await page.locator('#checkpoint-feedback .success').waitFor({state:'visible'});
  assert.ok(JSON.parse(await page.evaluate(()=>localStorage.getItem('sql-academy-progress-v1'))).checkpointTasks.includes('core-foundation-orders'),'A valid SQL report must persist checkpoint completion');
  await page.locator('[data-checkpoint-task="core-foundation-customers"]').click();
  await writeEditor(checkpointEditor,cumulativeCheckpoints[0].tasks[1].solution);
  await page.locator('[data-action="check-checkpoint-task"]').click();
  await page.locator('#checkpoint-feedback .success').waitFor({state:'visible'});
  assert.match(await page.locator('#checkpoint-count').textContent(),/2\/2.*Зачёт получен/,'A complete checkpoint must show a confirmed pass');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-checkpoint-task="core-foundation-orders"]').click();
  assert.equal(await readEditor(page.locator('#checkpoint-editor')),cumulativeCheckpoints[0].tasks[0].solution,'Checkpoint SQL drafts must survive reload');
  await captureUxScreen('05a-cumulative-sql-checkpoint');

  await page.locator('#sidebar .nav-item[data-nav="dashboard"]').click();
  await captureUxScreen('14-dashboard-desktop-ready-dark');
  const darkTokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const button = document.querySelector('.btn');
    const card = document.querySelector('.stat-card,.card');
    return {
      surface: root.getPropertyValue('--surface').trim(),
      accentSoft: root.getPropertyValue('--accent-soft').trim(),
      radius: root.getPropertyValue('--radius-lg').trim(),
      controlHeight: getComputedStyle(button).minHeight,
      cardRadius: card ? getComputedStyle(card).borderRadius : ''
    };
  });
  assert.ok(darkTokens.surface && darkTokens.accentSoft && darkTokens.radius === '16px', `Dark theme design tokens must resolve: ${JSON.stringify(darkTokens)}`);
  assert.equal(darkTokens.controlHeight, '40px', 'Primary controls must use the shared 40px control height');
  assert.equal(darkTokens.cardRadius, '16px', 'Dashboard cards must use the shared card radius');
  await page.locator('#theme-toggle').click();
  const lightContrast = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const rgb = value => {
      const hex = value.trim();
      if (hex.startsWith('#')) { const digits = hex.slice(1); return digits.length === 3 ? digits.split('').map(channel => parseInt(channel + channel, 16)) : [0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16)); }
      return (hex.match(/\d+/g) || []).slice(0, 3).map(Number);
    };
    const luminance = value => rgb(value).map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
    const ratio = (foreground, background) => { const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); };
    return {
      mutedOnBackground: ratio(root.getPropertyValue('--muted'), root.getPropertyValue('--bg')),
      accentOnPanel: ratio(root.getPropertyValue('--accent2'), root.getPropertyValue('--panel')),
      sidebarLabelOnBackground: ratio(getComputedStyle(document.querySelector('.sidebar-label')).color, root.getPropertyValue('--bg'))
    };
  });
  assert.ok(lightContrast.mutedOnBackground >= 4.5, `Light muted text contrast must be at least 4.5:1: ${JSON.stringify(lightContrast)}`);
  assert.ok(lightContrast.accentOnPanel >= 4.5, `Light accent text contrast must be at least 4.5:1: ${JSON.stringify(lightContrast)}`);
  assert.ok(lightContrast.sidebarLabelOnBackground >= 4.5, `Light sidebar label contrast must be at least 4.5:1: ${JSON.stringify(lightContrast)}`);
  const lightTokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const button = document.querySelector('.btn');
    const card = document.querySelector('.stat-card,.card');
    return {
      surface: root.getPropertyValue('--surface').trim(),
      accentSoft: root.getPropertyValue('--accent-soft').trim(),
      radius: root.getPropertyValue('--radius-lg').trim(),
      controlHeight: getComputedStyle(button).minHeight,
      cardRadius: card ? getComputedStyle(card).borderRadius : ''
    };
  });
  assert.ok(lightTokens.surface === '#fff' && lightTokens.accentSoft === '#ecebff' && lightTokens.radius === '16px', `Light theme design tokens must resolve: ${JSON.stringify(lightTokens)}`);
  assert.equal(lightTokens.controlHeight, '40px', 'Light theme controls must retain the shared 40px height');
  assert.equal(lightTokens.cardRadius, '16px', 'Light theme cards must retain the shared card radius');
  await captureUxScreen('15-dashboard-desktop-light');
  await page.locator('#theme-toggle').click();
  await page.locator('#sidebar .nav-item[data-nav="courses"]').click();
  await captureUxScreen('16-course-catalog-desktop-ready');
  await page.locator('[data-open-course="core"]').click();
  await page.locator('[data-module="foundations"]').click();
  await page.locator('.lesson-track-group').waitFor({ state: 'visible' });
  await captureUxScreen('23-sql-lesson-desktop-ready');
  await page.locator('#sidebar .nav-item[data-nav="courses"]').click();
  await page.locator('[data-open-course="postgresql"]').click();
  await page.locator('[data-module="ddl"]').click();
  await page.locator('.lesson-track-group').waitFor({ state: 'visible' });
  await captureUxScreen('24-postgresql-lesson-desktop-ready');
  await page.locator('#sidebar .nav-item[data-nav="courses"]').click();
  await page.locator('#sidebar .nav-item[data-nav="assessment"]').click();
  await captureUxScreen('17-assessment-desktop');
  await page.locator('#sidebar .nav-item[data-nav="schema"]').click();
  await captureUxScreen('18-schema-desktop');
  await page.locator('#sidebar .nav-item[data-nav="reference"]').click();
  await captureUxScreen('19-reference-desktop');
  await page.locator('#sidebar .nav-item[data-nav="glossary"]').click();
  await captureUxScreen('20-glossary-desktop');
  await page.locator('#sidebar .nav-item[data-nav="playground"]').click();

  await page.locator('#sidebar [data-nav="practice"]').click();
  assert.equal(await page.locator('[data-practice-track="core"]').getAttribute('aria-pressed'), 'true');
  assert.ok(await page.locator('.exercise-item').count() > 0, 'The SQL course must expose its own practice tasks');
  await page.locator('[data-practice-track="postgresql"]').click();
  assert.equal(await page.locator('[data-practice-track="postgresql"]').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('.task-meta').textContent(), /^ЗАДАНИЕ 1 ИЗ \d+/, 'Switching practice courses must start at the first task of the selected course');
  assert.match(await page.locator('#side-progress-detail').textContent(), /61 уроков · PostgreSQL/, 'Practice progress must follow the selected course');
  await captureUxScreen('06-practice-desktop');
  await page.locator('[data-action="next-exercise"]').click();
  assert.match(await page.locator('.task-meta').textContent(), /^ЗАДАНИЕ 2 ИЗ \d+/, 'Previous/next practice navigation must stay within the selected course');

  await page.locator('#sidebar [data-nav="projects"]').click();
  assert.equal(await page.locator('#app-content .project-card').count(), 3, 'The catalog must show E-commerce, delivery, and Product Analytics projects');
  await captureUxScreen('07-project-catalog-desktop');
  await page.locator('[data-open-project="product"]').click();
  await captureUxScreen('08-product-project-desktop');
  const productProject=projects.find(project=>project.id==='product');
  const firstProjectTask=productProject.tasks[0];
  assert.equal(await page.locator('#app-content .project-task-nav').count(), 3, 'Each project must expose its three ordered tasks');
  assert.equal((await page.locator('.project-task-content h2').textContent()).trim(), firstProjectTask.title);
  assert.equal(await page.locator('.project-solution').count(), 0, 'Reference SQL must remain hidden by default');
  assert.equal(await page.locator('#project-wrapup .project-wrapup-locked').count(), 1, 'The final analysis stage must stay locked until all SQL tasks are complete');

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
  await writeEditor(page.locator('#project-editor'),secondProjectTask.solution);
  await page.locator('[data-action="check-project-task"]').click();
  await page.locator('#project-feedback .feedback.success').waitFor({state:'visible',timeout:15_000});

  const thirdProjectTask=productProject.tasks[2];
  await page.locator('[data-project-task="'+thirdProjectTask.id+'"]').click();
  await writeEditor(page.locator('#project-editor'),thirdProjectTask.solution);
  await page.locator('[data-action="check-project-task"]').click();
  await page.locator('#project-feedback .feedback.success').waitFor({state:'visible',timeout:15_000});
  await page.locator('#project-wrapup .project-note-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#project-wrapup .project-wrapup-locked').count(),0,'Completing every SQL task must unlock the project conclusion stage');
  const conclusion='Главная потеря сессий возникает до оформления заказа. Нужно проверить удобство карточки товара и отдельно сравнить поведение новых и возвращающихся пользователей.';
  await page.locator('#project-conclusion').fill(conclusion);
  assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('sql-academy-project-notes-v1'))).product,conclusion,'The analytical note must autosave under its project id');
  await page.locator('[data-project-review="product:1"]').click();
  await page.locator('#project-review-feedback .feedback.success').waitFor({state:'visible'});
  assert.match(await page.locator('#project-review-feedback').textContent(),/Единица анализа здесь — сессия/,'The interpretation check must explain why session grain matters after the answer');
  assert.equal(await page.locator('[data-project-review]').count(),3,'The submitted interpretation must reveal the answer and lock further changes');

  await page.locator('#sidebar [data-nav="projects"]').click();
  await page.locator('[data-open-project="delivery"]').click();
  assert.equal(await page.locator('#project-wrapup .project-wrapup-locked').count(),1,'Each project must unlock its own conclusion stage independently');
  await page.locator('#sidebar [data-nav="projects"]').click();
  await page.locator('[data-open-project="product"]').click();
  assert.equal(await page.locator('#project-conclusion').inputValue(),conclusion,'The analytical note must persist after leaving and reopening a project');
  assert.match(await page.locator('#project-review-feedback').textContent(),/Единица анализа здесь — сессия/,'The interpretation result must persist independently for each project');
  for (const projectId of ['ecommerce','delivery']) {
    await page.locator('#sidebar [data-nav="projects"]').click();
    await page.locator('[data-open-project="'+projectId+'"]').click();
    const currentProject = projects.find(project => project.id === projectId);
    assert.equal(await page.locator('#app-content .project-task-nav').count(), 3, `Project ${projectId} must expose all three ordered SQL tasks`);
    assert.equal(await page.locator('#project-wrapup .project-wrapup-locked').count(), 1, `Project ${projectId} must keep its conclusion locked before its own tasks are complete`);
    for (const task of currentProject.tasks) {
      await page.locator('[data-project-task="'+task.id+'"]').click();
      await writeEditor(page.locator('#project-editor'), task.solution);
      await page.locator('[data-action="check-project-task"]').click();
      await page.locator('#project-feedback .feedback.success').waitFor({state:'visible',timeout:15_000});
    }
    await page.locator('#project-wrapup .project-note-panel').waitFor({state:'visible'});
    assert.equal(await page.locator('#project-wrapup .project-wrapup-locked').count(),0,`Project ${projectId} must unlock its conclusion after its own three SQL tasks`);
    const projectNote = 'Итоговый вывод для проекта '+projectId+': наблюдения подтверждены рассчитанными метриками и размерами групп.';
    await page.locator('#project-conclusion').fill(projectNote);
    const savedNotes = JSON.parse(await page.evaluate(()=>localStorage.getItem('sql-academy-project-notes-v1')));
    assert.equal(savedNotes[projectId],projectNote,`The ${projectId} analytical note must autosave independently`);
    await page.locator('[data-project-review="'+projectId+':1"]').click();
    await page.locator('#project-review-feedback .feedback.success').waitFor({state:'visible'});
  }
  const allProjectNotes = JSON.parse(await page.evaluate(()=>localStorage.getItem('sql-academy-project-notes-v1')));
  assert.equal(allProjectNotes.product,conclusion,'Completing other projects must not overwrite the Product Analytics note');
  assert.ok(allProjectNotes.ecommerce && allProjectNotes.delivery,'Each practical project must keep its own final note');
  const allProjectReviews = JSON.parse(await page.evaluate(()=>localStorage.getItem('sql-academy-project-reviews-v1')));
  assert.ok(allProjectReviews.product && allProjectReviews.ecommerce && allProjectReviews.delivery,'Interpretation answers must persist independently for all three projects');
  await page.locator('#sidebar button.nav-item[data-nav="progress"]').click();
  assert.equal(await page.locator('.progress-course-card').count(), 2, 'The progress screen must show both independent courses');
  assert.equal(await page.locator('.progress-project-card').count(), 3, 'The progress screen must show all three analytical projects');
  const projectProgressSummary = await page.locator('.progress-stats .stat-card').nth(3).innerText();
  assert.match(projectProgressSummary, /9\/9/, 'The progress screen must include all nine completed project tasks');
  assert.match(projectProgressSummary, /3 из 3/, 'The progress screen must include all three completed project reviews');
  await captureUxScreen('25-progress-desktop-ready');
  await page.locator('#sidebar [data-nav="projects"]').click();


  await page.setViewportSize({width:320,height:740});
  await assertNoHorizontalOverflow(320);
  await page.setViewportSize({width:390,height:844});

  await page.setViewportSize({ width: 390, height: 844 });
  await captureUxScreen('09-project-mobile-390');
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
  await captureUxScreen('10-practice-mobile-390');
  await menuButton.click();
  await page.locator('#sidebar button.nav-item[data-nav="progress"]').click();
  assert.equal(await page.locator('.progress-course-card').count(), 2, 'The progress screen must remain available from the mobile navigation');
  await assertNoHorizontalOverflow(390);
  await page.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(320);
  await page.setViewportSize({ width: 390, height: 844 });
  await captureUxScreen('26-progress-mobile-390');


  await menuButton.click();
  await page.locator('#sidebar .nav-item[data-nav="dashboard"]').click();
  await page.locator('#app-content .hero').waitFor({ state: 'visible' });
  await captureUxScreen('11-dashboard-mobile-390');

  await menuButton.click();
  await page.locator('#sidebar .nav-item[data-nav="courses"]').click();
  await page.locator('#app-content .course-card').first().waitFor({ state: 'visible' });
  await captureUxScreen('21-course-catalog-mobile-390');
  await page.locator('[data-open-course="core"]').click();
  await page.locator('.roadmap-stage').first().waitFor({ state: 'visible' });
  assert.equal(await page.locator('.course-subnav-link').count(), 4, 'The course program must expose all four contextual navigation links');
  await assertNoHorizontalOverflow(390);
  await page.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(320);
  const roadmapColumns = await page.locator('.course-subnav-links').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  assert.equal(roadmapColumns, 2, 'The course sub-navigation must use two readable columns at 320px');
  await captureUxScreen('47-course-roadmap-mobile-dark-320');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-module="foundations"]').click();
  await page.locator('.lesson-track-group').waitFor({ state: 'visible' });
  await captureUxScreen('22-sql-lesson-mobile-390');
  await menuButton.click();
  await page.locator('#sidebar .nav-item[data-nav="practice"]').click();
  await page.locator('#app-content .exercise-layout').waitFor({ state: 'visible' });

  await page.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(320);
  const narrowPracticeColumns = await page.locator('.exercise-list').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  assert.equal(narrowPracticeColumns, 1, 'Practice tasks must use one readable column at 320px');
  await captureUxScreen('12-practice-mobile-320');
  await menuButton.click();
  await page.locator('#sidebar .nav-item[data-nav="dashboard"]').click();
  await page.locator('#app-content .hero').waitFor({ state: 'visible' });
  await assertNoHorizontalOverflow(320);
  await captureUxScreen('25-dashboard-mobile-320');
  await menuButton.click();
  await page.locator('#sidebar .nav-item[data-nav="playground"]').click();
  await page.locator('#playground-editor').waitFor({ state: 'attached' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMotionStyles = await page.locator('#sidebar .nav-item').first().evaluate(element => ({ transition: getComputedStyle(element).transitionDuration, scroll: getComputedStyle(document.documentElement).scrollBehavior }));
  assert.equal(reducedMotionStyles.scroll, 'auto', 'Reduced-motion preference must disable smooth document scrolling');
  assert.ok(parseFloat(reducedMotionStyles.transition) < .001, `Reduced-motion preference must reduce transitions: ${reducedMotionStyles.transition}`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await assertNoHorizontalOverflow(320);
  await captureUxScreen('13-playground-mobile-320');
  assert.equal(await readEditor(page.locator('#playground-editor')), draft, 'Navigation must not discard the saved SQL draft');

  // Complete the mobile walkthrough for the remaining reference and assessment views.
  const visitMobileAuditView = async (nav, width, height, suffix) => {
    await page.setViewportSize({ width, height });
    await menuButton.click();
    const navItem = page.locator('#sidebar .nav-item[data-nav="'+nav+'"]');
    if (height < 520) {
      const sidebarMetrics = await page.locator('#sidebar').evaluate(element => ({
        overflowY: getComputedStyle(element).overflowY,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight
      }));
      assert.equal(sidebarMetrics.overflowY, 'auto', 'Short landscape navigation must be vertically scrollable');
      assert.ok(sidebarMetrics.scrollHeight > sidebarMetrics.clientHeight, 'Landscape sidebar must expose the complete navigation list');
    }
    await navItem.click();
    assert.equal(await navItem.evaluate(element => element.classList.contains('active')), true, nav+' must become the active mobile navigation view');
    await page.locator('#app-content h1, #app-content h2').first().waitFor({ state: 'visible' });
    await assertNoHorizontalOverflow(width);
    const heading = (await page.locator('#app-content h1, #app-content h2').first().innerText()).trim();
    assert.ok(heading.length > 0, nav+' must render a visible page heading at '+width+'px');
    await captureUxScreen(nav+'-mobile-'+suffix);
  };

  for (const nav of ['assessment', 'schema', 'reference', 'glossary']) {
    await visitMobileAuditView(nav, 390, 844, '390');
    await visitMobileAuditView(nav, 320, 740, '320');
  }

  // A narrow landscape viewport catches layouts that pass portrait-only checks.
  for (const nav of ['assessment', 'schema', 'reference', 'glossary']) {
    await visitMobileAuditView(nav, 667, 375, 'landscape-667');
  }

  // Check the mobile light theme separately; dark-theme coverage alone is not enough.
  await page.setViewportSize({ width: 390, height: 844 });
  await menuButton.click();
  await page.locator('#sidebar .nav-item[data-nav="dashboard"]').click();
  await page.locator('#app-content .hero').waitFor({ state: 'visible' });
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('html').evaluate(element => element.classList.contains('light')), true, 'The mobile theme toggle must activate the light theme');
  const mobileLightContrast = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const rgb = value => {
      const hex = value.trim();
      if (hex.startsWith('#')) {
        const digits = hex.slice(1);
        return digits.length === 3
          ? digits.split('').map(channel => parseInt(channel + channel, 16))
          : [0, 2, 4].map(index => parseInt(digits.slice(index, index + 2), 16));
      }
      return (hex.match(/\\d+/g) || []).slice(0, 3).map(Number);
    };
    const luminance = value => rgb(value).map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
    const ratio = (foreground, background) => {
      const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
      return (values[0] + .05) / (values[1] + .05);
    };
    return {
      mutedOnBackground: ratio(root.getPropertyValue('--muted'), root.getPropertyValue('--bg')),
      accentOnPanel: ratio(root.getPropertyValue('--accent2'), root.getPropertyValue('--panel')),
      sidebarLabelOnBackground: ratio(getComputedStyle(document.querySelector('.sidebar-label')).color, root.getPropertyValue('--bg'))
    };
  });
  assert.ok(mobileLightContrast.mutedOnBackground >= 4.5, 'Mobile light muted text contrast must be at least 4.5:1');
  assert.ok(mobileLightContrast.accentOnPanel >= 4.5, 'Mobile light accent contrast must be at least 4.5:1');
  assert.ok(mobileLightContrast.sidebarLabelOnBackground >= 4.5, 'Mobile light sidebar label contrast must be at least 4.5:1');
  await assertNoHorizontalOverflow(390);
  await captureUxScreen('26-dashboard-mobile-light-390');
  await page.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(320);
  await captureUxScreen('27-dashboard-mobile-light-320');

  await page.setViewportSize({ width: 390, height: 844 });
  await menuButton.click();
  await page.locator('#sidebar .nav-item[data-nav="courses"]').click();
  await page.locator('#app-content .course-card').first().waitFor({ state: 'visible' });
  await assertNoHorizontalOverflow(390);
  await captureUxScreen('28-course-catalog-mobile-light-390');
  await page.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(320);
  await captureUxScreen('40-course-catalog-mobile-light-320');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-open-course="core"]').click();
  await page.locator('.roadmap-stage').first().waitFor({ state: 'visible' });
  assert.equal(await page.locator('.course-subnav-link').count(), 4, 'The light-theme course program must expose all four navigation links');
  await assertNoHorizontalOverflow(390);
  await page.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(320);
  const lightRoadmapColumns = await page.locator('.course-subnav-links').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  assert.equal(lightRoadmapColumns, 2, 'The light-theme course sub-navigation must use two columns at 320px');
  await captureUxScreen('48-course-roadmap-mobile-light-320');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-module="foundations"]').click();
  await page.locator('.lesson-track-group').waitFor({ state: 'visible' });
  await assertNoHorizontalOverflow(390);
  await captureUxScreen('29-sql-lesson-mobile-light-390');
  await page.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(320);
  await captureUxScreen('41-sql-lesson-mobile-light-320');
  await page.setViewportSize({ width: 390, height: 844 });

  const visitLightMobileView = async nav => {
    await menuButton.click();
    const item = page.locator('#sidebar .nav-item[data-nav="'+nav+'"]');
    await item.click();
    await assert.equal(await item.evaluate(element => element.classList.contains('active')), true, nav+' must remain navigable in the light theme');
    await page.locator('#app-content h1, #app-content h2').first().waitFor({ state: 'visible' });
    await assertNoHorizontalOverflow(390);
    await captureUxScreen(nav+'-mobile-light-390');
  };
  await visitLightMobileView('practice');
  await page.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(320);
  await captureUxScreen('30-practice-mobile-light-320');
  await page.setViewportSize({ width: 390, height: 844 });
  await visitLightMobileView('assessment');
  await page.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(320);
  await captureUxScreen('31-assessment-mobile-light-320');
  await page.setViewportSize({ width: 390, height: 844 });
  await visitLightMobileView('schema');
  await visitLightMobileView('reference');
  await visitLightMobileView('glossary');
  await visitLightMobileView('projects');
  await page.locator('[data-open-project="ecommerce"]').click();
  await page.locator('.project-task-content h2').waitFor({ state: 'visible' });
  await assertNoHorizontalOverflow(390);
  await captureUxScreen('42-ecommerce-project-mobile-light-390');
  await page.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(320);
  await captureUxScreen('43-ecommerce-project-mobile-light-320');
  await page.setViewportSize({ width: 390, height: 844 });
  await menuButton.click();
  await page.locator('#sidebar .nav-item[data-nav="courses"]').click();
  await page.locator('[data-open-course="postgresql"]').click();
  await page.locator('[data-module="ddl"]').click();
  await page.locator('.lesson-track-group').waitFor({ state: 'visible' });
  await page.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(320);
  await captureUxScreen('44-postgresql-lesson-mobile-light-320');

  await page.setViewportSize({ width: 390, height: 844 });
  await menuButton.click();
  await page.locator('#sidebar .nav-item[data-nav="projects"]').click();
  await page.locator('[data-open-project="delivery"]').click();
  await page.locator('.project-task-content h2').waitFor({ state: 'visible' });
  await page.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(320);
  await captureUxScreen('45-delivery-project-mobile-light-320');

  await page.setViewportSize({ width: 390, height: 844 });
  await menuButton.click();
  await page.locator('#sidebar .nav-item[data-nav="projects"]').click();
  await page.locator('[data-open-project="product"]').click();
  await page.locator('.project-task-content h2').waitFor({ state: 'visible' });
  await page.setViewportSize({ width: 320, height: 740 });
  await assertNoHorizontalOverflow(320);
  await captureUxScreen('46-product-project-mobile-light-320');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('html').evaluate(element => element.classList.contains('light')), false, 'The browser smoke must restore the dark theme after light-theme checks');

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.locator('#sidebar .nav-item[data-nav="dashboard"]').click();
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('html').evaluate(element => element.classList.contains('light')), true, 'Desktop light-theme walkthrough must start in light mode');
  const visitDesktopLightView = async (nav, name) => {
    const item = page.locator('#sidebar .nav-item[data-nav="'+nav+'"]');
    await item.click();
    await assert.equal(await item.evaluate(element => element.classList.contains('active')), true, nav+' must become active in desktop light theme');
    await page.locator('#app-content h1, #app-content h2').first().waitFor({ state: 'visible' });
    await assertNoHorizontalOverflow(1440);
    await captureUxScreen(name);
  };
  await visitDesktopLightView('courses', '47-course-catalog-desktop-light');
  await page.locator('[data-open-course="core"]').click();
  await page.locator('[data-module="foundations"]').click();
  await page.locator('.lesson-track-group').waitFor({ state: 'visible' });
  await assertNoHorizontalOverflow(1440);
  await captureUxScreen('48-sql-lesson-desktop-light');
  await visitDesktopLightView('courses', '49-course-catalog-postgresql-desktop-light');
  await page.locator('[data-open-course="postgresql"]').click();
  await page.locator('[data-module="ddl"]').click();
  await page.locator('.lesson-track-group').waitFor({ state: 'visible' });
  await assertNoHorizontalOverflow(1440);
  await captureUxScreen('50-postgresql-lesson-desktop-light');
  await visitDesktopLightView('practice', '51-practice-desktop-light');
  await visitDesktopLightView('projects', '52-project-catalog-desktop-light');
  await page.locator('[data-open-project="ecommerce"]').click();
  await page.locator('.project-task-content h2').waitFor({ state: 'visible' });
  await assertNoHorizontalOverflow(1440);
  await captureUxScreen('53-ecommerce-project-desktop-light');
  await visitDesktopLightView('assessment', '54-assessment-desktop-light');
  await visitDesktopLightView('playground', '55-playground-desktop-light');
  await visitDesktopLightView('schema', '56-schema-desktop-light');
  await visitDesktopLightView('reference', '57-reference-desktop-light');
  await visitDesktopLightView('glossary', '58-glossary-desktop-light');
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('html').evaluate(element => element.classList.contains('light')), false, 'Desktop light-theme walkthrough must restore dark mode');
  await page.locator('#sidebar .nav-item[data-nav="dashboard"]').click();
  await page.evaluate(() => localStorage.setItem('sql-academy-progress-v1', JSON.stringify({
    lessons: ['foundations:0'], exercises: [], quizAnswers: {}, exerciseQuizAnswers: {}, assessmentResults: {}
  })));
  assert.equal(await page.locator('[data-action="export-backup"]').isVisible(), true, 'The dashboard must expose a progress backup action');
  assert.equal(await page.locator('[data-action="import-backup"]').isVisible(), true, 'The dashboard must expose a restore action');
  const [backupDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-action="export-backup"]').click()
  ]);
  assert.match(backupDownload.suggestedFilename(), /^sql-academy-backup-\d{4}-\d{2}-\d{2}\.json$/, 'Export must create a dated JSON backup file');
  const backupPath = await backupDownload.path();
  assert.ok(backupPath, 'The backup download must produce a readable file');
  const backupText = await readFile(backupPath, 'utf8');
  const backup = JSON.parse(backupText);
  assert.equal(backup.format, 'sql-academy-backup');
  assert.equal(backup.version, 1);
  assert.ok(backup.storage['sql-academy-project-notes-v1']?.includes('ecommerce'), 'The backup must include project notes');
  const exportedProgress = JSON.parse(backup.storage['sql-academy-progress-v1'] || 'null');
  assert.ok(exportedProgress && exportedProgress.lessons?.length === 1, 'The backup must include an existing course progress record');
  const backupKeys = Object.keys(backup.storage);
  await page.evaluate(keys => keys.forEach(key => localStorage.removeItem(key)), backupKeys);
  page.once('dialog', dialog => dialog.accept());
  const restoredNavigation = page.waitForEvent('framenavigated', { predicate: frame => frame === page.mainFrame() });
  await page.locator('#backup-import-file').setInputFiles({
    name: 'sql-academy-backup-test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backupText)
  });
  await restoredNavigation;
  await page.locator('#app-content .hero').waitFor({ state: 'visible', timeout: 45_000 });
  const restoredBackup = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), backupKeys);
  const changedValues = Object.keys(backup.storage).filter(key =>
    key !== 'sql-academy-progress-v1' && backup.storage[key] !== null && restoredBackup[key] !== backup.storage[key]
  );
  assert.deepEqual(changedValues, [], 'Import must restore each non-empty learning-data section');
  const restoredProgress = JSON.parse(restoredBackup['sql-academy-progress-v1'] || 'null');
  assert.equal(restoredProgress?.lessons?.length, 1, 'Import must restore the saved lesson completion');
  assert.notEqual(restoredProgress.lessons[0], 'foundations:0', 'Legacy lesson ids must migrate to stable lesson ids during restore');

  // Invalid and declined imports must never overwrite the user's current browser data.
  const protectedBackupState = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), backupKeys);
  const protectedUrl = page.url();
  const assertBackupStateUnchanged = async label => {
    const current = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), backupKeys);
    assert.deepEqual(current, protectedBackupState, label + ' must leave every backup storage key unchanged');
    assert.equal(page.url(), protectedUrl, label + ' must not navigate or reload the application');
  };
  const assertImportError = async (file, message, label) => {
    const byteLength = file.buffer?.length || 0;
    const bytes = byteLength <= 5 * 1024 * 1024 ? file.buffer?.toString('base64') || '' : '';
    await page.evaluate(({ name, mimeType, bytes, byteLength }) => {
      const input = document.querySelector('#backup-import-file');
      const payload = bytes
        ? Uint8Array.from(atob(bytes), character => character.charCodeAt(0))
        : new Uint8Array(byteLength);
      const selected = new File([payload], name, { type: mimeType });
      const transfer = new DataTransfer();
      transfer.items.add(selected);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, { name: file.name, mimeType: file.mimeType, bytes, byteLength });
    await page.locator('.toast').filter({ hasText: message }).waitFor({ state: 'visible', timeout: 5_000 });
    await assertBackupStateUnchanged(label);
  };

  await assertImportError({
    name: 'broken-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{ this is not valid JSON')
  }, 'Файл не содержит корректный JSON', 'An invalid JSON import');

  const unsupportedBackup = { ...backup, version: backup.version + 1 };
  await assertImportError({
    name: 'unsupported-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(unsupportedBackup))
  }, 'Версия резервной копии не поддерживается', 'An unsupported backup version');

  await assertImportError({
    name: 'oversized-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 0x20)
  }, 'Размер файла превышает 5 МБ', 'An oversized backup file');

  await page.evaluate(() => {
    window.__backupConfirmCalls = 0;
    window.confirm = () => {
      window.__backupConfirmCalls += 1;
      return false;
    };
  });
  await page.evaluate(backupContent => {
    const input = document.querySelector('#backup-import-file');
    const file = new File([backupContent], 'declined-backup.json', { type: 'application/json' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, backupText);
  await page.waitForFunction(() => window.__backupConfirmCalls === 1);
  await page.waitForFunction(() => {
    const input = document.querySelector('#backup-import-file');
    return input && input.value === '';
  });
  await assertBackupStateUnchanged('A declined restore confirmation');

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
      'dedicated progress screen with direct route, reload, desktop/mobile layout and 320px overflow',
      'course navigation preserves core/PostgreSQL context across program, theory, practice, assessments and Back/Forward',
      'primary navigation exposes aria-current and supports Enter/Space keyboard activation',
      '320px layout overflow on dashboard, practice, playground and progress',
      'backup import rejects malformed JSON, unsupported versions, and files larger than 5 MB without changing local data',
      'declining backup restore confirmation preserves existing local data'
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
