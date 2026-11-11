import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { modules, learningTracks, exercises, schema, seedSQL, glossary, reference } from '../curriculum.js';
import { migrateProgress, getTrackProgress, findNextLesson } from '../progress-utils.js';
import { sandboxTaskTopics, sandboxTaskCount } from '../sandbox-tasks.js';
import { projects, projectTaskCount } from '../projects.js';
import { projectOracles } from './project-oracles.mjs';
import { BACKUP_FORMAT, BACKUP_VERSION, BACKUP_STORAGE_KEYS, createBackup, parseBackup, restoreBackup } from '../backup-utils.js';
import { buildQuizOptionOrders, quizOptionKey } from '../quiz-options.js';

const curriculumSource = await readFile(new URL('../curriculum.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const sqlUtilsSource = await readFile(new URL('../sql-utils.js', import.meta.url), 'utf8');
const htmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const cssSource = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
assert.ok(cssSource.includes('--surface:var(--panel)') && cssSource.includes('--accent-soft:color-mix'), 'Theme surface aliases must be defined instead of relying on invalid CSS declarations');
assert.ok(cssSource.includes('--radius-lg:16px') && cssSource.includes('--space-4:16px') && cssSource.includes('--control-height:40px'), 'Shared spacing, radius and control tokens must be present');
assert.ok(cssSource.includes(':root.light{') && cssSource.includes('--surface:#fff') && cssSource.includes('--focus-ring:#6657e8'), 'Light theme must define its own surface and focus tokens');
assert.ok(cssSource.includes('.btn{min-height:var(--control-height)') && cssSource.includes('.lesson-card') && cssSource.includes('.project-card'), 'Shared design tokens must be applied to primary controls and learning surfaces');
assert.equal(cssSource.split('/* Module assessments */').length-1, 1, 'Module assessment styles must have one source of truth');
const projectsSource = await readFile(new URL('../projects.js', import.meta.url), 'utf8');
const buildVersion = JSON.parse(await readFile(new URL('../version.json', import.meta.url), 'utf8')).build;
const quizOptionOrders = buildQuizOptionOrders(modules);
for (const track of learningTracks) {
  const questions = modules.filter(module => module.track === track.id).flatMap(module => [
    ...module.lessons.flatMap(lesson => lesson.quiz || []),
    ...(module.quiz || [])
  ]);
  const normalizedQuestionText = question => question.question.replace(/\s+/g, ' ').trim().toLowerCase();
  assert.equal(new Set(questions.map(normalizedQuestionText)).size, questions.length, `Quiz questions must not repeat within the ${track.id} learning route`);
  assert.ok(questions.every(question => new Set(question.options).size === question.options.length), `Quiz options must be distinct in the ${track.id} learning route`);
  const uniqueQuestions = [...new Map(questions.map(question => [quizOptionKey(question, track.id), question])).values()];
  const positionCounts = [0, 0, 0, 0];
  for (const question of uniqueQuestions) {
    const order = quizOptionOrders.get(quizOptionKey(question, track.id));
    assert.ok(order && order.length === question.options.length && new Set(order).size === question.options.length, `Quiz option order must be a permutation for "${question.question}"`);
    assert.equal(order[question.answer === undefined ? -1 : order.indexOf(question.answer)], question.answer, `Correct answer index must remain stable for "${question.question}"`);
    positionCounts[order.indexOf(question.answer)] += 1;
  }
  assert.ok(Math.max(...positionCounts) - Math.min(...positionCounts) <= 1, `Correct answer positions must be evenly distributed in ${track.id}: ${positionCounts.join(', ')}`);
}
assert.ok(appSource.includes('buildQuizOptionOrders(modules)') && appSource.includes('quizOptionKey(question,selected.track)'), 'Lesson and module assessments must use deterministic shuffled options while retaining original answer indexes');

const importedAssetVersions = [...appSource.matchAll(/from\s+['"]\.\/[^'"]+\.js\?v=([^'"]+)['"]/g)].map(match => match[1]);
assert.equal(importedAssetVersions.length, 8, 'Application must import curriculum, cumulative checkpoints, sandbox, SQL, progress, projects, backup, and quiz options');
assert.ok(importedAssetVersions.every(version => version === buildVersion), 'Local JavaScript imports must use the current release build to avoid stale cached curriculum and SQL utilities');
assert.ok(appSource.includes("from './backup-utils.js?v=" + buildVersion + "'"), 'The backup utility must be loaded from the current app build');
assert.ok(appSource.includes("from './checkpoints.js?v=" + buildVersion + "'"), 'Cumulative SQL checkpoint bank must use the current app build');
assert.ok(appSource.includes('checkCheckpointTask()') && appSource.includes('renderCheckpointCards(state.assessmentTrack)'), 'Checkpoint results must be integrated into the existing assessments route');
assert.ok(appSource.includes('data-action="export-backup"') && appSource.includes('data-action="import-backup"'), 'The dashboard must expose both backup actions');
assert.ok(appSource.includes('prepareImportedBackup(backup)') && appSource.includes('restoreBackup(localStorage'), 'Import must normalize legacy progress and restore supported local state');


const coreLessonIds = modules.filter(module => module.track === 'core').flatMap(module => module.lessons.map(lesson => lesson.id));
const optionalLessonIds = modules.filter(module => module.track === 'postgresql').flatMap(module => module.lessons.map(lesson => lesson.id));
assert.deepEqual(learningTracks.map(track => track.id), ['core','postgresql'], 'Only implemented courses must be listed in the catalog');
for (const track of learningTracks) {
  assert.ok(track.title && track.courseLevel && track.courseAudience && track.coursePrerequisites && track.courseGoal, 'Every listed course must define its identity, audience, prerequisites, and learning goal');
  assert.ok(track.moduleIds.length > 0 && modules.some(module => module.track === track.id), 'Every listed course must have a real curriculum');
}
assert.ok(appSource.includes('function renderCourses()') && appSource.includes('data-open-course='), 'The app must render and open the standalone course catalog');
assert.ok(htmlSource.includes('data-nav="progress"') && appSource.includes('function renderProgress()') && appSource.includes('progress:renderProgress'), 'Progress must be a dedicated top-level screen, not only a sidebar summary');
assert.ok(appSource.includes("'progress'") && appSource.includes("progress:'Прогресс'"), 'Progress must support direct URL routing and display the correct navigation label');
assert.ok(cssSource.includes('.progress-course-grid') && cssSource.includes('.progress-project-grid') && cssSource.includes('@media(max-width:560px)'), 'The progress screen must have dedicated responsive course and project layouts');
assert.ok(appSource.includes('function renderCourseSubnav(') && appSource.includes('data-course-nav=') && appSource.includes("renderCourseSubnav('roadmap'") && appSource.includes("renderCourseSubnav('study'") && appSource.includes("renderCourseSubnav('practice'") && appSource.includes("renderCourseSubnav('assessment'"), 'The four course views must share contextual navigation');
assert.ok(appSource.includes('if(el.dataset.courseNav)') && appSource.includes('state.roadmapTrack=state.practiceTrack=state.assessmentTrack=track.id'), 'Course navigation must preserve one selected track across all views');
assert.ok(appSource.includes("button.setAttribute('aria-current','page')") && appSource.includes("button.removeAttribute('aria-current')"), 'The active top-level route must be exposed semantically to assistive technology');

assert.ok(appSource.includes('[data-open-course]'), 'Course catalog actions must be included in delegated click handling');
assert.ok(appSource.includes('[data-practice-track]') && appSource.includes('state.practiceTrack=track.id'), 'Practice must allow selecting a separate course');
assert.ok(appSource.includes('moduleById(exercise.m)?.track===state.practiceTrack'), 'Practice exercises must be filtered by the selected course');
assert.ok(appSource.includes('state.view===\'practice\'?state.practiceTrack'), 'The global progress indicator must follow the selected practice course');
assert.ok(learningTracks.every(track => exercises.some(exercise => modules.find(module => module.id === exercise.m)?.track === track.id)), 'Every course must have its own linked practice tasks');
assert.ok(appSource.includes('moduleLessons(m.track).map(mod=>'), 'A lesson sidebar must show only modules from the active course');
assert.ok(htmlSource.includes('data-nav="courses"'), 'The primary navigation must expose the course catalog');
assert.ok(cssSource.includes('.course-grid') && cssSource.includes('.course-card'), 'The course catalog must have dedicated responsive styles');
assert.ok(htmlSource.includes('data-nav="projects"') && appSource.includes('function renderProjects()') && appSource.includes('function renderProject()'), 'Standalone business projects must have a dedicated navigation section and workspace');
assert.ok(cssSource.includes('.project-grid') && cssSource.includes('.project-workspace') && cssSource.includes('.project-wrapup-grid'), 'The projects area and final analysis stage must have dedicated responsive layout styles');
assert.equal(projects.length, 3, 'The platform must show the three defined practical project tracks');
assert.equal(projectTaskCount, 9, 'The project catalog must contain nine self-contained tasks');
assert.equal(projects.reduce((sum,project)=>sum+project.tasks.length,0),projectTaskCount);
assert.deepEqual(projects.map(project => project.id), ['ecommerce','delivery','product'], 'The three published project identities must remain stable');
assert.deepEqual(projects.map(project => project.tasks.map(task => task.id)), [
  ['ecommerce-monthly-net-revenue','ecommerce-cohort-retention','ecommerce-repeat-customers'],
  ['delivery-sla-by-store','delivery-percentiles-by-store','delivery-cancellations-by-channel'],
  ['product-session-funnel','product-monthly-active-users','product-cohort-retention']
], 'All existing project task IDs and their learning order must remain stable');
for (const project of projects) {
  assert.ok(project.context && project.objective && project.dataset && project.audience, `Project ${project.id} must explain context, goal, audience, and data`);
  assert.ok(project.wrapUp && project.wrapUp.title && project.wrapUp.notePrompt && project.wrapUp.limitation, `Project ${project.id} must define a final analytical write-up and data limitations`);
  assert.ok(project.wrapUp.checks.length >= 3 && project.wrapUp.prompts.length >= 3, `Project ${project.id} must guide data-quality checks and business conclusions`);
  assert.ok(project.wrapUp.review.prompt && project.wrapUp.review.options.length === 3 && Number.isInteger(project.wrapUp.review.correctIndex) && project.wrapUp.review.correctIndex >= 0 && project.wrapUp.review.correctIndex < 3 && project.wrapUp.review.explanation, `Project ${project.id} must include a validated interpretation question`);
  for (const task of project.tasks) {
    assert.ok(task.id && task.title && task.brief && task.conditions && task.expected && task.solution, `Project task ${task.id} must include a brief, conditions, expected output, and a hidden reference solution`);
    assert.match(task.solution.trim(), /^(WITH|SELECT)\b/i, `Project task ${task.id} must use SELECT or WITH ... SELECT`);
  }
}
assert.ok(appSource.includes('sql-academy-project-progress-v1') && appSource.includes('sql-academy-project-drafts-v1') && appSource.includes('sql-academy-project-notes-v1') && appSource.includes('sql-academy-project-reviews-v1'), 'Project completion, SQL drafts, analytical notes, and review answers must persist separately from course progress');
assert.ok(appSource.includes('function renderProjectWrapUp(project,unlocked)') && appSource.includes('data-project-review=') && appSource.includes('data-project-conclusion='), 'Projects must unlock a final analysis stage with a saved conclusion draft and interpretation check');
assert.ok(appSource.includes('resultMatches(normalizeResult(actual),normalizeResult(expected)'), 'Project answers must be checked by executing and comparing query results');
assert.deepEqual(getTrackProgress(modules, new Set(), 'core'), { completed: 0, total: 112, percent: 0 }, 'An empty core route must start at 0% of its own 112 lessons');
assert.deepEqual(getTrackProgress(modules, new Set(optionalLessonIds), 'core'), { completed: 0, total: 112, percent: 0 }, 'Completing optional PostgreSQL lessons must not change core-route progress');
assert.deepEqual(getTrackProgress(modules, new Set(coreLessonIds), 'core'), { completed: 112, total: 112, percent: 100 }, 'Completing the core route must reach 100% independently of PostgreSQL');
const nextAfterCore = findNextLesson(modules, new Set(coreLessonIds));
assert.equal(nextAfterCore.module.track, 'postgresql', 'The next lesson after the core route must belong to the optional PostgreSQL route');
assert.equal(nextAfterCore.index, 0, 'The next lesson resolver must select the first incomplete PostgreSQL lesson');
assert.equal(findNextLesson(modules, new Set([...coreLessonIds, ...optionalLessonIds])), null, 'The next lesson resolver must return null after both routes are complete');
assert.equal(appSource.split('findNextLesson(modules,state.completedLessons)').length - 1, 2, 'Dashboard preview and continue handler must share the same next-lesson resolver');

const selectModuleForMigration = modules.find(module => module.id === 'select');
const legacyProgress = migrateProgress({
  lessons: ['select:0', 'select:0', 'missing:999'],
  exercises: ['e1', 'e1', null],
  quizAnswers: { 'select:0:1': 2 },
  exerciseQuizAnswers: { e1: 3 },
  assessmentResults: { select: { attempts: 1, bestScore: 3, passed: true } }
}, modules);
assert.deepEqual(legacyProgress.progress.lessons, [selectModuleForMigration.lessons[0].id], 'Legacy positional lesson IDs must migrate to stable IDs and remove duplicates or unknown lessons');
assert.deepEqual(legacyProgress.progress.quizAnswers, { [selectModuleForMigration.lessons[0].id + ':1']: 2 }, 'Legacy lesson quiz keys must migrate with their stable lesson ID');
assert.deepEqual(legacyProgress.progress.exercises, ['e1'], 'Duplicate and malformed exercise progress entries must be normalized');
assert.deepEqual(legacyProgress.progress.exerciseQuizAnswers, { e1: 3 }, 'Exercise quiz answers must survive progress migration');
assert.deepEqual(legacyProgress.progress.assessmentResults, { select: { attempts: 1, bestScore: 3, passed: true } }, 'Assessment results must survive progress migration');
assert.equal(legacyProgress.changed, true, 'Legacy progress must be marked for one-time persistence');
assert.equal(migrateProgress(legacyProgress.progress, modules).changed, false, 'Stable progress must not be rewritten on every page load');
assert.ok(curriculumSource.includes('export const exercises = ['), 'Practice exercises must be exported as a named dataset');
assert.ok(curriculumSource.includes('export const learningTracks = [') && curriculumSource.includes('export const exercises = ['), 'Learning routes and practice arrays must be exported separately');
assert.ok(Array.isArray(glossary) && glossary.length >= 30, 'Glossary must contain at least 30 usable terms');
assert.ok(Array.isArray(reference) && reference.length >= 8, 'SQL quick reference must contain usable topic groups');
assert.ok(exercises.every(exercise => ['select','explain','mutation','transaction'].includes(exercise.mode)), 'Every exercise must have a supported explicit mode');
assert.equal(exercises.filter(exercise => exercise.mode === 'select').length, 90, 'Expected 90 SELECT exercises');
assert.equal(exercises.filter(exercise => exercise.mode === 'explain').length, 4, 'Expected four EXPLAIN exercises');
assert.equal(exercises.filter(exercise => exercise.mode === 'mutation').length, 32, 'Expected thirty-two mutation exercises');
assert.equal(exercises.filter(exercise => exercise.mode === 'transaction').length, 4, 'Expected four transaction exercises');
assert.equal(exercises.length, 130, 'Expected 130 total practice exercises');
assert.ok(exercises.every(exercise => modules.some(module => module.id === exercise.m)), 'Every exercise must belong to a real module');
const linkedPracticeExercises = modules.flatMap(module => module.lessons.flatMap(lesson =>
  (lesson.practiceIds || []).map(id => ({ id, moduleId: module.id, lessonId: lesson.id }))
));
assert.equal(linkedPracticeExercises.length, exercises.length, 'Every runnable exercise must be linked from a lesson exactly once');
assert.equal(new Set(linkedPracticeExercises.map(link => link.id)).size, exercises.length, 'A practice exercise must not be linked from multiple lessons');
assert.deepEqual(
  linkedPracticeExercises.map(link => link.id).sort(),
  exercises.map(exercise => exercise.id).sort(),
  'Every runnable exercise must be reachable from the lesson practice links'
);
assert.ok(linkedPracticeExercises.every(link => exercises.find(exercise => exercise.id === link.id)?.m === link.moduleId), 'A lesson must link only to exercises from its own module');

const fanoutLesson = modules.find(module => module.id === 'joins')?.lessons.find(lesson => lesson.id === 'joins.fan-out-pochemu-join-umnozhaet-stroki');
assert.deepEqual(fanoutLesson?.practiceIds, ['e103'], 'The fan-out lesson must link its dedicated practice exercise exactly once');
assert.ok(exercises.some(exercise => exercise.id === 'e103' && exercise.m === 'joins'), 'Fan-out practice must be registered in the JOIN exercise bank');
assert.ok(appSource.includes("from './sql-utils.js?v="), 'Application must use the shared SQL parser module');
assert.ok(appSource.includes("render();\ninitDatabase();"), 'The application shell must render before PostgreSQL initialization begins');
assert.ok(appSource.includes("state.engineLoading=true") && appSource.includes("state.engineError="), 'Database startup must expose loading and recoverable error states');
assert.ok(appSource.includes('data-action="retry-engine"'), 'A database startup error must offer an in-app retry action');
assert.ok(appSource.includes("!state.engineReady||!state.db"), 'Database-dependent actions must be guarded until initialization finishes');
assert.ok(/setMobileMenuOpen\s*=\s*\(open/.test(appSource), 'Mobile navigation must use one function to synchronize its open state');
assert.ok(appSource.includes("event.key==='Escape'") && appSource.includes("restoreFocus:true"), 'Escape must close the mobile menu and restore focus to its trigger');
assert.ok(appSource.includes("window.addEventListener('resize'"), 'Switching to desktop width must close and reset the mobile menu');
assert.ok(appSource.includes("button.setAttribute('aria-expanded',String(expanded))"), 'The mobile menu must keep aria-expanded synchronized with its visual state');
assert.ok(htmlSource.includes('aria-controls="sidebar"') && htmlSource.includes('aria-expanded="false"'), 'The mobile menu button must declare its controlled navigation and initial collapsed state');
assert.equal(appSource.split('await loadPGliteModule()').length - 1, 3, 'All browser PGlite entry points must use the retryable module loader');
assert.ok(appSource.includes('let pgliteImportAttempt = 0;') && appSource.includes('pgliteModulePromise = null;') && appSource.includes('${PGLITE_MODULE_URL}?sql-academy-attempt=${attempt}'), 'A failed PGlite module request must be retried with a fresh URL so the browser does not reuse its failed module-map entry');
assert.ok(!appSource.includes("import('https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.15/dist/index.js')"), 'Browser PGlite loading must not reuse a single unversioned dynamic-import URL');
const sqlLexer = new Function(sqlUtilsSource.replaceAll('export function ', 'function ') + '; return { firstSqlKeyword, sqlAfterKeyword, explainStatementKeyword, explainStatementBody, readOnlyQueryKeyword, splitStatements };')();
for (const project of projects) for (const task of project.tasks) {
  assert.equal(sqlLexer.readOnlyQueryKeyword(task.solution),'SELECT', `Project task ${task.id} must be a read-only SELECT/CTE`);
}
assert.equal(sqlLexer.firstSqlKeyword("-- leading comment\nSELECT 1"), 'SELECT', 'Leading line comments must be ignored');
assert.equal(sqlLexer.firstSqlKeyword('/* outer /* nested */ comment */ WITH q AS (SELECT 1) SELECT * FROM q'), 'WITH', 'Nested block comments must be ignored');
assert.equal(sqlLexer.firstSqlKeyword(sqlLexer.sqlAfterKeyword('EXPLAIN /* comment */ SELECT 1', 'EXPLAIN')), 'SELECT', 'Comments after EXPLAIN must be ignored');
assert.equal(sqlLexer.explainStatementKeyword('EXPLAIN ANALYZE SELECT 1'), 'SELECT', 'EXPLAIN ANALYZE must be accepted');
assert.equal(sqlLexer.explainStatementKeyword('EXPLAIN FORMAT JSON SELECT 1'), 'SELECT', 'EXPLAIN FORMAT JSON must be accepted');
assert.equal(sqlLexer.explainStatementBody('EXPLAIN FORMAT JSON SELECT order_id FROM orders'), 'SELECT order_id FROM orders', 'EXPLAIN FORMAT JSON options must be removed before task-specific validation');
assert.equal(sqlLexer.explainStatementBody('EXPLAIN (ANALYZE, BUFFERS) SELECT 1'), 'SELECT 1', 'Parenthesized EXPLAIN options must be removed before task-specific validation');
assert.equal(sqlLexer.explainStatementKeyword('EXPLAIN (ANALYZE, BUFFERS) SELECT 1'), 'SELECT', 'EXPLAIN options must be accepted');
assert.equal(sqlLexer.explainStatementKeyword('EXPLAIN (FORMAT JSON) WITH q AS (SELECT 1) SELECT * FROM q'), 'SELECT', 'EXPLAIN FORMAT JSON with CTE must be accepted');
assert.equal(sqlLexer.readOnlyQueryKeyword('WITH q AS (SELECT 1) SELECT * FROM q'), 'SELECT', 'Read-only CTE must be accepted');
assert.equal(sqlLexer.readOnlyQueryKeyword('WITH q AS (DELETE FROM orders RETURNING *) SELECT * FROM q'), '', 'Data-modifying CTE must be rejected in read-only exercises');
assert.equal(sqlLexer.readOnlyQueryKeyword('WITH RECURSIVE n(x) AS (VALUES (1) UNION ALL SELECT x+1 FROM n WHERE x<3) SELECT * FROM n'), 'SELECT', 'Recursive CTE with VALUES anchor must be accepted');
assert.equal(sqlLexer.readOnlyQueryKeyword('WITH q AS MATERIALIZED (SELECT 1) SELECT * FROM q'), 'SELECT', 'MATERIALIZED CTE must be accepted');
assert.equal(sqlLexer.readOnlyQueryKeyword('WITH q AS NOT MATERIALIZED (SELECT 1) SELECT * FROM q'), 'SELECT', 'NOT MATERIALIZED CTE must be accepted');
assert.equal(sqlLexer.readOnlyQueryKeyword('WITH RECURSIVE n(x) AS (VALUES (1) UNION ALL SELECT x+1 FROM n WHERE x<3) SELECT * FROM n'), 'SELECT', 'Recursive CTE with VALUES anchor must be accepted');
assert.equal(sqlLexer.readOnlyQueryKeyword(String.raw`WITH q AS (SELECT E'it\'s;ok') SELECT * FROM q`), 'SELECT', 'Escaped strings inside CTE bodies must be parsed safely');
assert.equal(sqlLexer.splitStatements("SELECT ';'; SELECT 2;").length, 2, 'Semicolons inside string literals must not split statements');
assert.deepEqual(sqlLexer.splitStatements(String.raw`SELECT E'it\'s; still text'; SELECT 2;`).map(sqlLexer.firstSqlKeyword), ['SELECT','SELECT'], 'Escaped E-string quotes must not split statements');
assert.equal(exercises.filter(exercise => exercise.orderMatters).length, 12, 'Expected 12 ordering-sensitive tasks');
assert.equal(sqlLexer.splitStatements('DO $body$ BEGIN PERFORM 1; PERFORM 2; END $body$; SELECT 3;').length, 2, 'Dollar-quoted procedural blocks must remain a single statement');
for (const exercise of exercises.filter(e => e.mode === 'select')) assert.equal(sqlLexer.readOnlyQueryKeyword(exercise.solution), 'SELECT', `Exercise ${exercise.id} must be a read-only SELECT`);
for (const exercise of exercises.filter(e => e.mode === 'explain')) assert.equal(sqlLexer.explainStatementKeyword(exercise.solution), 'SELECT', `Exercise ${exercise.id} must EXPLAIN a SELECT`);
const insertSelectExercise = exercises.find(exercise => exercise.id === 'e67');
assert.equal(sqlLexer.splitStatements(insertSelectExercise.solution).length, 2, 'INSERT ... SELECT practice may create a staging table and then insert rows');
assert.deepEqual(sqlLexer.splitStatements(insertSelectExercise.solution).map(sqlLexer.firstSqlKeyword), ['CREATE','INSERT'], 'Multi-statement mutation practice must use only allowed mutation statements');
assert.ok(appSource.includes("if(ex.mode==='explain')"), 'EXPLAIN mode must be handled separately from normal SELECT exercises');
assert.ok(appSource.includes('readOnlyQueryKeyword(parts[0])'), 'SELECT exercises must validate read-only SELECT/CTE statements');
assert.ok(appSource.includes('explainStatementKeyword(parts[0])'), 'EXPLAIN exercises must parse EXPLAIN options and CTEs');
assert.ok(appSource.includes('reference.map(g=>') && appSource.includes('glossary.map(g=>'), 'Reference and glossary views must render their datasets');
assert.ok(appSource.includes('preserveOrder=false'), 'Result normalization must support order-sensitive exercises');
assert.ok(appSource.includes('function lessonFocusTokens') && appSource.includes('function renderAnnotatedSql') && appSource.includes('function renderExampleBreakdown'), 'SQL explanations must be contextual and concise');
const walkthroughLessons = modules.flatMap(module => module.lessons.filter(lesson => lesson.walkthrough));
assert.equal(walkthroughLessons.length, 42, 'Only substantive, hand-authored worked scenarios should remain');
assert.ok(walkthroughLessons.every(lesson => lesson.walkthrough.title && lesson.walkthrough.scenario && lesson.walkthrough.steps?.length >= 3 && lesson.walkthrough.result && lesson.walkthrough.pitfall), 'Every retained worked scenario must include context, reasoning, result and pitfall');
const nullWalkthroughLesson = modules.find(module => module.id === 'where').lessons.find(lesson => lesson.id === 'where.is-distinct-from-i-sravnenie-s-null');
assert.ok(nullWalkthroughLesson.walkthrough.steps.length >= 4, 'NULL comparison must have a multi-step worked explanation');
assert.ok(nullWalkthroughLesson.walkthrough.steps.some(step => step.includes('UNKNOWN')) && nullWalkthroughLesson.walkthrough.steps.some(step => step.includes('IS DISTINCT FROM')), 'NULL walkthrough must explain three-valued logic and the NULL-safe comparison');
const fanOutWalkthroughLesson = modules.find(module => module.id === 'joins').lessons.find(lesson => lesson.id === 'joins.fan-out-pochemu-join-umnozhaet-stroki');
assert.ok(fanOutWalkthroughLesson.walkthrough.steps.some(step => step.includes('3 × 2 = 6')) && fanOutWalkthroughLesson.walkthrough.steps.some(step => step.includes('2 400 вместо 1 200')), 'Fan-out walkthrough must quantify row multiplication and metric inflation');
assert.ok(fanOutWalkthroughLesson.walkthrough.steps.some(step => step.includes('SUM(quantity * unit_price)')) && fanOutWalkthroughLesson.walkthrough.result.includes('1 200'), 'Fan-out walkthrough must show pre-aggregation to the correct order grain');
assert.ok(modules.every(module => module.lessons.every(lesson => !lesson.walkthrough || !lesson.walkthrough.scenario.startsWith('Представь, что ты решаешь рабочую задачу'))), 'Generic template walkthroughs must not be shown');
const explanationStart = appSource.indexOf('function lessonFocusTokens');
const explanationEnd = appSource.indexOf('function renderWorkedExample', explanationStart);
const explanationCode = appSource.slice(explanationStart, explanationEnd);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const explanationApi = new Function('esc','sqlTokenTips', explanationCode + '; return { lessonFocusTokens, renderAnnotatedSql, renderExampleBreakdown };')(escapeHtml, {
  JOIN:'Joins tables.', LEFT:'Keeps all rows from the left side.', ON:'Defines the join condition.',
  SELECT:'Selects output columns.', FROM:'Defines the source.', WHERE:'Filters rows.',
  SET:'Assigns new values to columns in an UPDATE statement.',
  ANALYZE:'Executes the statement and reports actual plan statistics.'
});
const joinLesson = { title: 'INNER JOIN и LEFT JOIN', simple: 'Соединение таблиц по ключам.' };
const joinHtml = explanationApi.renderAnnotatedSql("SELECT o.id FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = 7 -- note", joinLesson);
assert.ok(joinHtml.includes('data-tip=') && joinHtml.includes('>LEFT</span>') && joinHtml.includes('>JOIN</span>') && joinHtml.includes('>ON</span>'), 'JOIN topic should highlight only relevant join syntax');
assert.ok(!joinHtml.includes('>SELECT</span>') && !joinHtml.includes('>FROM</span>') && !joinHtml.includes('>orders</span>') && !joinHtml.includes('>7</span>') && !joinHtml.includes('>note</span>'), 'Unrelated clauses, identifiers, numbers and comments must not be highlighted');
const neutralHtml = explanationApi.renderAnnotatedSql("SELECT 'COUNT(*)' AS label, 12 FROM orders -- comment", { title: 'Клиент и сервер' });
assert.ok(!neutralHtml.includes('data-tip='), 'Unrelated lessons must not highlight generic SQL tokens or literals');
const aliasedUpdateHtml = explanationApi.renderAnnotatedSql(
  "UPDATE orders AS o SET status = 'cancelled' WHERE o.order_id = 102;",
  { title: 'UPDATE', tipTokens: ['SET'] }
);
assert.ok(aliasedUpdateHtml.includes('>SET</span>'), 'SET tooltip must recognize UPDATE targets with an explicit alias');
const explainAnalyzeHtml = explanationApi.renderAnnotatedSql(
  'EXPLAIN (ANALYZE, BUFFERS) SELECT order_id FROM orders;',
  { title: 'EXPLAIN', tipTokens: ['ANALYZE'] }
);
assert.ok(explainAnalyzeHtml.includes('>ANALYZE</span>'), 'ANALYZE tooltip must recognize parenthesized EXPLAIN options');
const breakdown = explanationApi.renderExampleBreakdown("SELECT o.id\nFROM orders o\nLEFT JOIN customers c\nON c.id = o.customer_id\nWHERE o.id = 7\n-- comment", joinLesson);
assert.ok(breakdown.includes('Ключевые части запроса') && breakdown.includes('LEFT JOIN') && breakdown.includes('Задаёт ключ сопоставления таблиц.'));
assert.ok(!breakdown.includes('SELECT o.id') && !breakdown.includes('WHERE o.id') && !breakdown.includes('-- comment') && !breakdown.includes('Эта строка уточняет'), 'Breakdown must omit unrelated clauses, comments and generic filler');
assert.ok(appSource.includes('function renderWorkedExample') && appSource.includes('renderWorkedExample(l.walkthrough)'), 'Worked lesson scenarios must be rendered in the lesson page');
assert.ok(cssSource.includes('.worked-example') && cssSource.includes('.worked-steps'), 'Worked scenarios must have dedicated responsive styling');

assert.ok(cssSource.includes('.sql-tooltip') && cssSource.includes('.breakdown-list'), 'SQL hover explanations and walkthroughs must have dedicated styles');
assert.equal(modules.find(module => module.id === 'performance').lessons.length, 16, 'Optimization stage must contain sixteen focused lessons');
assert.ok(appSource.includes('meta[name="theme-color"]'), 'Theme toggle must update browser theme color');
assert.ok(htmlSource.includes('data-nav="reference"') && htmlSource.includes('data-nav="glossary"'), 'Reference and glossary navigation buttons must exist');
assert.ok(cssSource.includes(':root.light .CodeMirror') && cssSource.includes(':root.light .reference-card') && cssSource.includes(':root.light .glossary-item'), 'Light theme must style the editor, reference and glossary');

const ids = new Set(modules.map(module => module.id));
assert.equal(modules.reduce((sum, module) => sum + module.lessons.length, 0), 173, 'Expected 173 lessons');
assert.equal(modules.filter(module=>module.track==='core').reduce((sum,module)=>sum+module.lessons.length,0),112,'Expected 112 lessons in the core analyst route');
assert.equal(modules.filter(module=>module.track==='postgresql').reduce((sum,module)=>sum+module.lessons.length,0),61,'Expected 61 lessons in the optional PostgreSQL route');
assert.ok(appSource.includes("const core=moduleLessons('core')")&&appSource.includes('const trackModules=moduleLessons(m.track)'), 'Continue and lesson navigation must stay inside the selected learning route');
assert.equal(glossary.length, 72, 'Expected 72 glossary terms');
assert.equal(reference.length, 13, 'Expected 13 reference groups');
const allRandomTasks = sandboxTaskTopics.flatMap(topic => topic.tasks);
const normalizeRandomTaskText = value => value.replace(/ Вариант №\d+:.*$/, '').replace(/\s+/g, ' ').trim();
assert.equal(new Set(allRandomTasks.map(task => task.id)).size, 350, 'Random task IDs must be globally unique');
for (const topic of sandboxTaskTopics) {
  assert.equal(topic.tasks.length, 25, `Topic ${topic.id} must contain exactly 25 tasks`);
  assert.equal(new Set(topic.tasks.map(task => normalizeRandomTaskText(task.prompt))).size, 25, `Topic ${topic.id} must not disguise repeated prompts with a variant number`);
  assert.equal(new Set(topic.tasks.map(task => task.hint.trim())).size, 25, `Topic ${topic.id} must provide a task-specific hint`);
  assert.equal(new Set(topic.tasks.map(task => task.solution.replace(/\s+/g, ' ').trim().toLowerCase())).size, 25, `Topic ${topic.id} must not repeat reference SQL`);
}
const orderSensitiveRandomTasks = allRandomTasks.filter(task => task.orderMatters);
assert.equal(orderSensitiveRandomTasks.length, 91, 'Random tasks that explicitly request result order must preserve row order during validation');
assert.equal(orderSensitiveRandomTasks.filter(task => task.topic === 'joins').length, 1, 'Only the JOIN task that explicitly requests alphabetical city order must preserve row order');
assert.ok(orderSensitiveRandomTasks.every(task => /\bORDER\s+BY\b/i.test(task.solution)), 'Every random task with an explicit ordering requirement must define ORDER BY in its reference solution');
assert.ok(allRandomTasks.every(task => typeof task.orderMatters === 'boolean'), 'Every random task must declare whether output row order matters');
const sortingTopTasks = sandboxTaskTopics.find(topic => topic.id === 'sorting').tasks.slice(0, 5);
assert.deepEqual(sortingTopTasks.map(task => Number(task.solution.match(/\bLIMIT\s+(\d+)/i)?.[1])), [3,4,5,6,8], 'Top-order random variants must apply the exact row limit stated in each task');
assert.ok(sortingTopTasks.every(task => task.orderMatters), 'Top-order random tasks must validate the requested row order');
const normalizeStart = appSource.indexOf('function normalizeResult');
const normalizeEnd = appSource.indexOf('\nasync function runEditorQuery', normalizeStart);
const { normalizeResult: normalize, resultMatches } = new Function(appSource.slice(normalizeStart, normalizeEnd) + '; return { normalizeResult, resultMatches };')();
const orderedA = { rows: [{id:1},{id:2}], fields: [{name:'id'}] };
const orderedB = { rows: [{id:2},{id:1}], fields: [{name:'id'}] };
assert.equal(resultMatches(normalize(orderedA),normalize(orderedB)),true,'Equivalent unordered results must match despite a different row order');
assert.equal(resultMatches(normalize(orderedA),normalize(orderedB),true),false,'Ordering-sensitive results must reject a different row order');
const orderedTwoColumns = normalize({ rows: [{id:1,status:'delivered'},{id:2,status:'new'}], fields: [{name:'id'},{name:'status'}] });
const reorderedColumns = normalize({ rows: [{status:'delivered',id:1},{status:'new',id:2}], fields: [{name:'status'},{name:'id'}] });
assert.equal(resultMatches(orderedTwoColumns,reorderedColumns),true,'Equivalent results must match when selected columns are returned in a different order');
const duplicateRows = normalize({rows:[{id:1},{id:1},{id:2}],fields:[{name:'id'}]});
const missingDuplicate = normalize({rows:[{id:1},{id:2}],fields:[{name:'id'}]});
assert.equal(resultMatches(duplicateRows,missingDuplicate),false,'Result comparison must preserve duplicate row multiplicity');
assert.equal(resultMatches(normalize({rows:[{id:1}],fields:[{name:'id'}]}),normalize({rows:[{id:1}],fields:[{name:'id'},{name:'extra'}]})),false,'Result comparison must reject missing or extra output columns');
assert.equal(resultMatches(normalize({rows:[{id:1}],fields:[{name:'id'}]}),normalize({rows:[{id:2}],fields:[{name:'id'}]})),false,'Result comparison must reject a different value even when row counts match');
assert.equal(resultMatches(normalize({rows:[],fields:[{name:'id'},{name:'status'}]}),normalize({rows:[],fields:[{name:'status'},{name:'id'}]})),true,'Empty results must retain column names and compare independently of column order');
assert.deepEqual(normalize({rows:[{id:1}]}).columns,['id'],'Result normalization must fall back to row keys when the driver omits field metadata');
assert.equal(resultMatches(normalize({rows:[{payload:{b:2,a:1}}],fields:[{name:'payload'}]}),normalize({rows:[{payload:{a:1,b:2}}],fields:[{name:'payload'}]})),true,'JSON objects must compare independent of object key order');
const oneValue = value => normalize({rows:[{value}],fields:[{name:'value'}]});
assert.equal(resultMatches(oneValue(NaN),oneValue(null)),false,'NaN must not collapse to NULL during result comparison');
assert.equal(resultMatches(oneValue(Infinity),oneValue(-Infinity)),false,'Positive and negative infinity must remain distinct');
assert.equal(resultMatches(oneValue(1n),oneValue('1')),false,'BIGINT values must not collapse to text with the same characters');
assert.equal(resultMatches(oneValue(new Date('2026-01-01T00:00:00.000Z')),oneValue('2026-01-01T00:00:00.000Z')),false,'Date values must not collapse to ISO-formatted text');
assert.equal(resultMatches(normalize({rows:[{}],fields:[{name:'payload'}]}),normalize({rows:[{payload:{__missingColumn:true}}],fields:[{name:'payload'}]})),false,'A missing result field must not collide with a JSON object value');
assert.equal(modules.length, 25, 'Expected 25 ordered modules');
assert.ok(modules.every(module => module.lessons.length > 0), 'Every module must have lessons');
assert.ok(modules.every(module => module.lessons.every(lesson => lesson.title && lesson.body && lesson.example && lesson.note)), 'Every lesson must contain title, theory, example and note');
assert.ok(modules.every(module => module.lessons.every(lesson => lesson.simple === undefined || typeof lesson.simple === 'string')), 'Optional plain-language summaries must be valid when present');
assert.ok(modules.every(module => module.lessons.every(lesson => !lesson.walkthrough || (lesson.walkthrough.title && lesson.walkthrough.scenario && lesson.walkthrough.steps?.length >= 3 && lesson.walkthrough.result && lesson.walkthrough.pitfall))), 'Every retained worked scenario must be complete');
assert.equal(new Set(walkthroughLessons.map(lesson => lesson.walkthrough.title)).size, 42, 'Retained worked-scenario titles must be unique');
assert.ok(modules.every(module => module.lessons.every(lesson => Array.isArray(lesson.outcomes) && lesson.outcomes.length >= 2)), 'Every lesson must have lesson-specific outcomes');
assert.ok(modules.filter(module => ['foundations','relational','types','anatomy','ddl','inserts','select','where','sorting','expressions','aggregates','joins','subqueries','cte','setops','dml','constraints','windows','views','analytics','performance','advanced','security','workflow'].includes(module.id)).every(module => module.lessons.every(lesson => lesson.body.split(/\n\s*\n/).filter(Boolean).length >= 2)), 'Rewritten lesson explanations must be divided into readable paragraphs');
assert.ok(modules.filter(module => ['foundations','relational','types','anatomy','ddl','inserts','select','where','sorting','expressions','aggregates','joins','subqueries','cte','setops','dml','constraints','windows','views'].includes(module.id)).every(module => module.lessons.every(lesson => lesson.quiz.every(q => q.options.length === 4 && new Set(q.options).size === 4))), 'Rewritten lesson quiz options must be distinct and substantive');
assert.ok(modules.every(module => module.lessons.every(lesson => lesson.quiz.every(q => q.explanation && q.question && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length))), 'Every lesson quiz must have a valid answer and explanation');

const ddlModule = modules.find(module => module.id === 'ddl');
assert.ok(ddlModule.lessons.some(lesson => lesson.title === 'CHECK: проверка бизнес-правил' && lesson.body.includes('TRUE или NULL')), 'DDL must explain CHECK and UNKNOWN semantics');
assert.ok(ddlModule.lessons.some(lesson => lesson.title === 'Составные ограничения и составные внешние ключи'), 'DDL must explain composite constraints');
assert.ok(ddlModule.lessons.some(lesson => lesson.title === 'PostgreSQL: ограничения и блокировки при миграциях' && lesson.body.includes('NOT VALID') && lesson.body.includes('VALIDATE CONSTRAINT')), 'DDL must explain PostgreSQL-specific constraint validation and migration locks');
assert.equal(ddlModule.lessons.length, 8, 'DDL module must keep its eight focused lessons');
assert.deepEqual(ddlModule.lessons.flatMap(lesson => lesson.practiceIds || []).sort(), ['e61','e104','e105','e106','e107','e66','e108','e109'].sort(), 'Every DDL lesson must link exactly one dedicated practice task');
assert.ok(ddlModule.lessons.find(lesson => lesson.title === 'Составные ограничения и составные внешние ключи').example.includes('FOREIGN KEY (tenant_id, order_id)'), 'Composite-key lesson must demonstrate a genuinely composite foreign key');
assert.ok(ddlModule.lessons.find(lesson => lesson.title === 'PostgreSQL: ограничения и блокировки при миграциях').example.includes('source IS NOT NULL AND source <>'), 'Migration example must reject both NULL and empty source values');
assert.ok(exercises.filter(exercise => exercise.m === 'ddl').length === 8, 'DDL must have one distinct practical exercise per lesson');

const dateTimeModule = modules.find(module => module.id === 'datetime');
assert.equal(dateTimeModule.lessons.length, 7, 'Date/time stage must contain seven focused lessons');
assert.ok(dateTimeModule.lessons.some(lesson => lesson.title === 'Фильтрация по датам: полуоткрытые интервалы' && lesson.body.includes('BETWEEN')), 'Date/time stage must explain half-open timestamp ranges');
assert.ok(dateTimeModule.lessons.some(lesson => lesson.title === 'Часовые пояса и AT TIME ZONE'), 'Date/time stage must explain both AT TIME ZONE directions');
assert.ok(dateTimeModule.lessons.some(lesson => lesson.title === 'Временные метрики: длительность и SLA'), 'Date/time stage must include practical duration and SLA analysis');


const datetimeModule = modules.find(module => module.id === 'datetime');
assert.equal(datetimeModule.lessons.length, 7, 'Date/time module must contain seven lessons');
assert.ok(datetimeModule.lessons.every(lesson => (lesson.practiceIds || []).length > 0), 'Every date/time lesson must link to at least one relevant practice task');
assert.deepEqual(datetimeModule.lessons.flatMap(lesson => lesson.practiceIds || []).sort(), ['e72','e73','e74','e75','e76','e77','e78','e79'].sort(), 'Date/time lessons must link all eight dedicated practice tasks exactly once');
assert.ok(exercises.filter(exercise => exercise.m === 'datetime').every(exercise => exercise.quiz?.options?.length === 4 && exercise.quiz.explanation), 'Date/time practice tasks must include a concept check');
assert.ok(importedAssetVersions.every(version => version === buildVersion), 'Every imported local module must use the current cache version');


const windowModule = modules.find(module => module.id === 'windows');
assert.equal(windowModule.lessons.length, 10, 'Window-function module must include advanced value, distribution and filtering lessons');
assert.deepEqual(windowModule.lessons.flatMap(lesson => lesson.practiceIds || []).sort(), ['e35','e36','e39','e37','e38','e80','e81','e82','e91','e93','e94','e95','e100'].sort(), 'Window-function lessons must link all thirteen dedicated practice tasks exactly once');
const analyticsModule = modules.find(module => module.id === 'analytics');
assert.ok(analyticsModule.lessons.find(lesson => lesson.title === 'Зерно и определение метрики').example.includes('COUNT(*)') && !analyticsModule.lessons.find(lesson => lesson.title === 'Зерно и определение метрики').example.includes('COUNT(DISTINCT'), 'Metric example must use the known one-row-per-order grain');
assert.ok(analyticsModule.lessons.find(lesson => lesson.title === 'Воронка и условные этапы').body.includes('не строгую временную воронку'), 'Status snapshot must not be presented as a sequential funnel');
const dedupLesson = analyticsModule.lessons.find(lesson => lesson.title === 'Дедупликация и выбор последней записи');
assert.ok(dedupLesson.body.includes('Не используй PARTITION BY order_id в таблице order_events') && !dedupLesson.example.includes('order_events'), 'Snapshot deduplication must not discard legitimate order event history');
assert.deepEqual(dedupLesson.exampleResult.rows, [[101,2,'2026-01-01 10:00:00','paid',1000],[102,4,'2026-01-01 09:30:00','paid',2000],[103,5,'2026-01-01 11:00:00','new',1500]], 'Deduplication must keep the latest deterministic version per business key');
assert.deepEqual(analyticsModule.lessons.find(lesson => lesson.title === 'Качество данных и проверки').exampleResult.rows, [[19,12,7]], 'Join-grain check must expose row multiplication from order items');
assert.ok(analyticsModule.lessons.find(lesson => lesson.title === 'Медиана и перцентили').example.includes('event_times') && !analyticsModule.lessons.find(lesson => lesson.title === 'Медиана и перцентили').example.includes('JOIN order_events delivered'), 'Delivery percentile calculation must pre-aggregate event types to one row per order');
assert.deepEqual(analyticsModule.lessons.find(lesson => lesson.title === 'Медиана и перцентили').exampleResult.rows, [[874,'47.89','97.26','144.00','192.00']], 'Delivery stage averages and percentiles must be computed once per order');

assert.equal(analyticsModule.lessons.length, 13, 'Analytics module must include period comparisons, conversion and combined-query workflow');
assert.deepEqual(analyticsModule.lessons.find(lesson => lesson.title === 'Когортный анализ').exampleResult.rows, [['2023-01-01',7],['2023-02-01',8],['2023-03-01',5]], 'Historical cohort example must show separate first-quarter 2023 cohort sizes');
assert.deepEqual(analyticsModule.lessons.find(lesson => lesson.title === 'Retention: когортное удержание').exampleResult.rows, [['2023-01-01',0,7,7,'100.00'],['2023-01-01',1,7,4,'57.14'],['2023-01-01',2,7,4,'57.14'],['2023-02-01',0,8,8,'100.00'],['2023-02-01',1,8,5,'62.50'],['2023-02-01',2,8,4,'50.00'],['2023-03-01',0,5,5,'100.00'],['2023-03-01',1,5,4,'80.00'],['2023-03-01',2,5,2,'40.00']], 'Historical retention must compare unique active customers against the fixed original cohort size');
const funnelLesson = analyticsModule.lessons.find(lesson => lesson.title === 'Воронка и условные этапы');
assert.ok(funnelLesson.example.includes("e.event_at > c.created_at") && funnelLesson.example.includes("e.event_at > s.shipped_at") && funnelLesson.example.includes("INTERVAL '7 days'"), 'Strict order funnel must enforce event sequence and a fixed conversion window');
assert.deepEqual(funnelLesson.exampleResult.rows, [[5,3,1,'60.00','33.33']], 'Strict funnel must reject out-of-order and late events');
const combinedReportLesson = analyticsModule.lessons.find(lesson => lesson.title === 'Составной аналитический запрос: от фактов до отчёта');
assert.ok(combinedReportLesson.body.includes('город магазина (stores.city)') && combinedReportLesson.body.includes('ROW_NUMBER'), 'Combined report must define its city dimension and deterministic Top-N policy');
assert.ok(combinedReportLesson.example.includes('ORDER BY city, revenue DESC, customer_id'), 'Final report must sort by the displayed ranking metric and a stable key');
assert.deepEqual(combinedReportLesson.exampleResult.rows, [['Казань','Алексей',1,1800,'62.07'],['Казань','Мария',1,1100,'37.93'],['Москва','Дмитрий',1,4200,'66.25'],['Москва','Алексей',1,1250,'19.72'],['Пермь','Ирина',2,4250,'85.00'],['Пермь','Мария',1,750,'15.00'],['Санкт-Петербург','Ирина',1,2400,'60.76'],['Санкт-Петербург','Алексей',1,990,'25.06']], 'Combined analytical report must expose correct city revenue, customer ranking and shares');
const shareLesson = analyticsModule.lessons.find(lesson => lesson.title === 'Доля от общего итога и доля внутри группы');
assert.ok(shareLesson.example.includes("WHERE status <> 'cancelled'") && shareLesson.example.includes('PARTITION BY month'), 'Monthly share must define included order statuses and the correct denominator partition');
assert.deepEqual(shareLesson.exampleResult.rows, [['2026-01-01',1,6340,'34.85'],['2026-01-01',2,3950,'21.72'],['2026-01-01',3,2900,'15.94'],['2026-01-01',4,5000,'27.49']], 'Monthly store shares must use the same non-cancelled revenue total as their denominator');

assert.deepEqual(analyticsModule.lessons.flatMap(lesson => lesson.practiceIds || []).sort(), ['e42','e43','e40','e41','e56','e83','e84','e85','e86','e87','e88','e89','e90','e92','e96','e97','e98','e99'].sort(), 'Analytics lessons must link all eighteen dedicated practice tasks exactly once');
assert.ok([...windowModule.lessons,...analyticsModule.lessons].filter(lesson => lesson.practiceIds?.length).every(lesson => lesson.practiceIds.every(id => exercises.some(exercise => exercise.id === id && exercise.m === (windowModule.lessons.includes(lesson) ? 'windows' : 'analytics')))), 'Window and analytics practice links must belong to their lesson module');


assert.ok(analyticsModule.lessons.find(lesson => lesson.title === 'Воронка и условные этапы').practiceIds.includes('e92'), 'Sequential funnel task must be linked to its lesson');
assert.ok(analyticsModule.lessons.find(lesson => lesson.title === 'Временные ряды и пропущенные периоды').practiceIds.includes('e90'), 'Month-over-month task must be linked to time-series analysis');
assert.ok(windowModule.lessons.find(lesson => lesson.title === 'ROW_NUMBER, RANK и DENSE_RANK').practiceIds.includes('e91'), 'Top-N-per-group task must be linked to ranking lesson');
assert.ok(windowModule.lessons.find(lesson => lesson.title === 'FIRST_VALUE, LAST_VALUE и NTH_VALUE').practiceIds.includes('e93'), 'Value functions task must be linked to its lesson');
assert.ok(analyticsModule.lessons.find(lesson => lesson.title === 'Составной аналитический запрос: от фактов до отчёта').practiceIds.includes('e99'), 'Combined-query task must be linked to its lesson');

const relationalModule = modules.find(module => module.id === 'relational');
assert.ok(relationalModule.lessons.some(lesson => lesson.title === 'Реляционная модель и особенности SQL-таблиц' && lesson.body.includes('мультимножествами') && lesson.body.includes('ORDER BY')), 'Relational foundations must distinguish SQL bag semantics from relation sets');
assert.ok(relationalModule.lessons.some(lesson => lesson.title === 'База данных, схема и таблица: уровни организации' && lesson.body.includes('search_path') && lesson.body.includes('public.orders')), 'Relational foundations must explain PostgreSQL schemas and qualified names');
assert.ok(relationalModule.lessons.find(lesson => lesson.title === 'Первичный ключ').body.includes('UNIQUE NULLS NOT DISTINCT'), 'Primary-key lesson must explain PostgreSQL unique NULL behavior');
assert.ok(relationalModule.lessons.find(lesson => lesson.title === 'Внешний ключ и связи').body.includes('не создаёт автоматически индекс'), 'Foreign-key lesson must explain child-side index behavior');
assert.ok(relationalModule.lessons.find(lesson => lesson.title === 'NULL и неизвестное значение').body.includes('NOT IN'), 'NULL lesson must explain the NOT IN and NULL trap');
const typesModule = modules.find(module => module.id === 'types');
assert.ok(typesModule.lessons.find(lesson => lesson.title === 'Выбор типа даты и времени').body.includes('TIMESTAMPTZ') && typesModule.lessons.find(lesson => lesson.title === 'Выбор типа даты и времени').body.includes('модуле временной аналитики'), 'Date/time type lesson must introduce the types and defer session timezone mechanics to the dedicated module');
assert.ok(relationalModule.lessons.find(lesson => lesson.title === 'Таблица, строка и столбец').body.includes('created_at — DATE'), 'Introductory table example must match the DATE type in the teaching schema');
assert.deepEqual(typesModule.lessons.find(lesson => lesson.title === 'Числовые типы').exampleResult.rows, [['0.3','0.30000000000000004']], 'Numeric types example must contrast exact and approximate decimal arithmetic');
assert.deepEqual(typesModule.lessons.find(lesson => lesson.title === 'Преобразование типов').exampleResult.rows, [['251.00','3','3.5000000000000000']], 'Type conversion example must show integer versus decimal division');
const expressionsQualityModule = modules.find(module => module.id === 'expressions');
assert.deepEqual(expressionsQualityModule.lessons.find(lesson => lesson.title === 'Числовые функции').exampleResult.rows, [['125.68','5','4',12]], 'Numeric function example must show rounding, ceiling, floor and absolute value');
const timeExpressionsLesson = expressionsQualityModule.lessons.find(lesson => lesson.title === 'Временные выражения: краткое введение');
assert.ok(!timeExpressionsLesson.example.includes('DATE_TRUNC') && timeExpressionsLesson.body.includes('отдельном модуле временной аналитики'), 'Expression module must introduce basic time expressions without duplicating the dedicated temporal module');
assert.deepEqual(expressionsQualityModule.lessons.find(lesson => lesson.title === 'COALESCE, NULLIF и безопасные вычисления').exampleResult.rows, [['12000','0','3000.00']], 'NULL-safe calculation example must show fallback and zero-safe division');
assert.equal(expressionsQualityModule.lessons.find(lesson => lesson.title === 'CASE: условная логика').exampleResult.rows.length, 4, 'CASE example must show each selected business category');
const datetimeQualityModule = modules.find(module => module.id === 'datetime');
assert.deepEqual(datetimeQualityModule.lessons.find(lesson => lesson.title === 'Как PostgreSQL хранит дату и время').exampleResult.rows, [['2026-11-07','09:00:00','2026-11-07 09:00:00','2026-11-07 09:00:00']], 'Date/time types example must distinguish date, local time and an instant');
assert.deepEqual(datetimeQualityModule.lessons.find(lesson => lesson.title === 'Интервалы и арифметика времени').exampleResult.rows, [['01:35:00','2026-04-01 10:00:00','2026-03-01 11:30:00']], 'Interval example must distinguish calendar months from fixed durations');
assert.deepEqual(datetimeQualityModule.lessons.find(lesson => lesson.title === 'Фильтрация по датам: полуоткрытые интервалы').exampleResult.rows.map(row => row[0]), [101,102,103,104,105,106], 'Half-open date range must include the start and exclude the next day boundary');
assert.deepEqual(datetimeQualityModule.lessons.find(lesson => lesson.title === 'Временные метрики: длительность и SLA').exampleResult.rows, [[101,'240.00','within_sla'],[102,'300.00','within_sla'],[103,null,'in_progress'],[105,'480.00','breached']], 'SLA example must preserve unfinished orders and avoid event fan-out');

assert.ok(datetimeQualityModule.lessons.find(lesson => lesson.title === 'Часовые пояса и AT TIME ZONE').example.includes('Europe/Warsaw'), 'Timezone lesson must execute both AT TIME ZONE directions');
assert.equal(datetimeQualityModule.lessons.find(lesson => lesson.title === 'Генерация календаря и пропущенные периоды').exampleResult.rows.at(-1)[1], 0, 'Calendar example must show a day without events');
const timeSeriesLesson = analyticsModule.lessons.find(lesson => lesson.title === 'Временные ряды и пропущенные периоды');
assert.deepEqual(timeSeriesLesson.exampleResult.rows, [['2026-01-10',2],['2026-01-11',0],['2026-01-12',1],['2026-01-13',0],['2026-01-14',0],['2026-01-15',3],['2026-01-16',0]], 'Time series must preserve every calendar day and show zero only for dates with no sample facts');
const rollingLesson = analyticsModule.lessons.find(lesson => lesson.title === 'Скользящие метрики по времени');
assert.ok(rollingLesson.example.includes('generate_series') && rollingLesson.example.includes('ROWS BETWEEN 6 PRECEDING AND CURRENT ROW') && rollingLesson.example.includes("DATE '2025-12-26'") && rollingLesson.example.includes("WHERE day >= DATE '2026-01-01'"), 'Seven-day rolling metric must create a continuous daily grain with six warm-up days before the report range');
assert.deepEqual(rollingLesson.exampleResult.rows.map(row => row[2]), [200,400,360,410,410,350,650], 'Seven-day rolling total must include calendar days without orders and the six warm-up days before the report range');
const windowQualityModule = modules.find(module => module.id === 'windows');
assert.ok(windowQualityModule.lessons.find(lesson => lesson.title === 'LAG и LEAD').example.includes('ORDER BY created_at, order_id'), 'LAG example must use a deterministic tie-breaker');
assert.deepEqual(windowQualityModule.lessons.find(lesson => lesson.title === 'LAG и LEAD').exampleResult.rows.map(row => row.slice(3)), [[null,1800],[1250,990],[1800,null]], 'LAG and LEAD must expose previous and next values with NULL at partition boundaries');
assert.deepEqual(windowQualityModule.lessons.find(lesson => lesson.title === 'Накопительные итоги и рамки окна').exampleResult.rows.map(row => row[4]), [1250,3050,4040], 'Running total must accumulate within the customer partition in deterministic order');
assert.deepEqual(windowQualityModule.lessons.find(lesson => lesson.title === 'FIRST_VALUE, LAST_VALUE и NTH_VALUE').exampleResult.rows.map(row => row.slice(3)), [[1250,990,1800],[1250,990,1800],[1250,990,1800]], 'Full-partition window frame must make FIRST, LAST and NTH values consistent across rows');

assert.ok(windowQualityModule.lessons.find(lesson => lesson.title === 'ROWS и RANGE: две разные оконные рамки').exampleResult.rows[0][3] !== windowQualityModule.lessons.find(lesson => lesson.title === 'ROWS и RANGE: две разные оконные рамки').exampleResult.rows[0][4], 'ROWS and RANGE example must expose peer-row behavior');
const analyticsQualityModule = modules.find(module => module.id === 'analytics');
assert.equal(analyticsQualityModule.lessons.find(lesson => lesson.title === 'Сравнение периодов: MoM, WoW и YoY').exampleResult.rows.length, 3, 'Period comparison example must include the missing month and zero-denominator case');
const selectModule = modules.find(module => module.id === 'select');
assert.ok(selectModule.lessons.find(lesson => lesson.title === 'DISTINCT ON в PostgreSQL').example.includes('order_id DESC'), 'DISTINCT ON must define a deterministic tie-breaker');
const sortingModule = modules.find(module => module.id === 'sorting');
assert.ok(sortingModule.lessons.find(lesson => lesson.title === 'Keyset pagination').example.includes("DATE '2026-01-12'"), 'Keyset example must use a DATE literal matching the sample column type');
assert.ok(!modules.find(module => module.id === 'anatomy').lessons.find(lesson => lesson.title === 'Логический порядок обработки').example.includes('--'), 'Logical query-order example must not duplicate the explanation with SQL comments');
const selectQualityModule = modules.find(module => module.id === 'select');
assert.equal(selectQualityModule.lessons.find(lesson => lesson.title === 'DISTINCT ON в PostgreSQL').exampleResult.rows.length, 4, 'DISTINCT ON example must return one latest order per customer with deterministic tie-breaking');
const sortingQualityModule = modules.find(module => module.id === 'sorting');
assert.equal(sortingQualityModule.lessons.find(lesson => lesson.title === 'Keyset pagination').exampleResult.rows.length, 4, 'Keyset cursor must continue strictly after the supplied composite key');
assert.ok(sortingQualityModule.lessons.find(lesson => lesson.title === 'Keyset pagination').example.includes("DATE '2026-01-12'"), 'Keyset cursor literal must match the DATE column type in the teaching schema');
const rollupLesson = modules.find(module => module.id === 'aggregates').lessons.find(lesson => lesson.title === 'GROUPING SETS, ROLLUP и CUBE');
assert.equal(rollupLesson.exampleResult.rows.length, 13, 'ROLLUP example must include detail groups, subtotals and the grand total');
assert.deepEqual(rollupLesson.exampleResult.rows.at(-1), [null, null, 21390, 1, 1], 'GROUPING flags must identify the grand total separately from source NULL values');
const subqueryModule = modules.find(module => module.id === 'subqueries');
assert.ok(subqueryModule.lessons.find(lesson => lesson.title === 'Коррелированные подзапросы').example.includes('c.customer_id'), 'Correlated subquery must reference the current outer row');
assert.equal(subqueryModule.lessons.find(lesson => lesson.title === 'Коррелированные подзапросы').exampleResult.rows.filter(row => row[2] === null).length, 5, 'Scalar correlated subquery must preserve customers without orders');
assert.ok(subqueryModule.lessons.find(lesson => lesson.title === 'ANY и ALL: сравнение с набором значений').example.includes("category = 'Посуда'"), 'ALL example must compare against a non-empty teaching dataset');
const cteModule = modules.find(module => module.id === 'cte');
assert.equal(cteModule.lessons.find(lesson => lesson.title === 'Рекурсивный WITH').exampleResult.rows.length, 5, 'Recursive CTE example must show its stopping condition');
const multiCteLesson = cteModule.lessons.find(lesson => lesson.title === 'От фильтрации к выручке магазина');
assert.ok(multiCteLesson.example.includes('FROM filtered_orders') && multiCteLesson.example.includes('GROUP BY store_id'), 'Multi-CTE lesson must demonstrate a real dependency from filtering to aggregation');
assert.deepEqual(multiCteLesson.exampleResult.rows, [['Центральный','Москва',3,6340],['Волжский','Казань',2,2900],['Уральский','Пермь',1,1500]], 'CTE chain must preserve the delivered-order filter and aggregate to one row per store');
assert.ok(cteModule.lessons.find(lesson => lesson.title === 'Материализация и оптимизация CTE').example.includes('NOT MATERIALIZED'), 'CTE optimization lesson must demonstrate PostgreSQL materialization control');
const setOperationsModule = modules.find(module => module.id === 'setops');
assert.equal(setOperationsModule.lessons.find(lesson => lesson.title === 'UNION и UNION ALL').exampleResult.rows.length, 8, 'UNION ALL example must retain duplicate customer IDs');
assert.equal(setOperationsModule.lessons.find(lesson => lesson.title === 'INTERSECT').exampleResult.rows.length, 1, 'INTERSECT example must show only the common customer set');
const foundationsQualityModule = modules.find(module => module.id === 'foundations');
assert.ok(!foundationsQualityModule.lessons.find(lesson => lesson.title === 'Клиент, сервер и запрос').example.includes('psql'), 'The browser SQL example must not mix terminal connection commands with executable SQL');
assert.equal(foundationsQualityModule.lessons.find(lesson => lesson.title === 'Диалекты SQL и стандарт').exampleResult.rows.length, 1, 'Dialect example must match a customer in the teaching dataset');
const anatomyQualityModule = modules.find(module => module.id === 'anatomy');
assert.equal(anatomyQualityModule.lessons.find(lesson => lesson.title === 'Анатомия SELECT').exampleResult.rows.length, 5, 'SELECT anatomy example must show the five highest delivered orders');
assert.equal(anatomyQualityModule.lessons.find(lesson => lesson.title === 'Логический порядок обработки').exampleResult.rows.length, 2, 'Logical query order example must return the qualifying delivered cities');
assert.ok(anatomyQualityModule.lessons.find(lesson => lesson.title === 'Логический порядок обработки').example.includes("status = 'delivered'"), 'Logical order example must use statuses present in the teaching dataset');
const workflowQualityModule = modules.find(module => module.id === 'workflow');
assert.equal(workflowQualityModule.lessons.find(lesson => lesson.title === 'SQL-клиент и BI-система').exampleResult.rows.length, 3, 'BI client example must return rows from the teaching store');
assert.deepEqual(workflowQualityModule.lessons.find(lesson => lesson.title === 'Пошаговая отладка').exampleResult.rows, [[6,6]], 'Debugging example must verify row count against distinct order grain');
assert.deepEqual(workflowQualityModule.lessons.find(lesson => lesson.title === 'Контроль результата: сверка и инварианты').exampleResult.rows, [[12,12,0,'2026-01-10','2026-01-15']], 'Control query must expose the expected uniqueness and date-range invariants');
const insertQualityModule = modules.find(module => module.id === 'inserts');
assert.ok(insertQualityModule.lessons.find(lesson => lesson.title === 'Вставка нескольких строк и INSERT ... SELECT').example.includes('CREATE TEMP TABLE archived_orders'), 'INSERT SELECT example must define its destination before loading');
assert.ok(insertQualityModule.lessons.find(lesson => lesson.title === 'DEFAULT, RETURNING и безопасная проверка').example.includes('INSERT INTO example_orders DEFAULT VALUES'), 'DEFAULT example must be executable without omitting required columns from the teaching orders table');
assert.deepEqual(insertQualityModule.lessons.find(lesson => lesson.title === 'Вставка нескольких строк и INSERT ... SELECT').practiceIds, ['e67','e111'], 'The multi-row and INSERT SELECT lesson must link both distinct practice tasks');
assert.deepEqual(insertQualityModule.lessons.find(lesson => lesson.title === 'DEFAULT, RETURNING и безопасная проверка').practiceIds, ['e110'], 'The DEFAULT and RETURNING lesson must link its dedicated mutation task');
assert.ok(insertQualityModule.lessons.find(lesson => lesson.title === 'COPY и импорт CSV').note.includes('не является SQL-запросом'), 'The COPY lesson must explain that psql \\copy is not executable in the browser SQL sandbox');
const dmlQualityModule = modules.find(module => module.id === 'dml');
assert.ok(dmlQualityModule.lessons.find(lesson => lesson.title === 'UPDATE').example.includes('WHERE product_id = 1'), 'UPDATE example must target a specific existing product');
assert.ok(dmlQualityModule.lessons.find(lesson => lesson.title === 'DELETE и TRUNCATE').example.includes("DATE '2026-01-13'"), 'DELETE example must target a matching cancelled order in the teaching data');
assert.deepEqual(dmlQualityModule.lessons.find(lesson => lesson.title === 'RETURNING').practiceIds, ['e112'], 'RETURNING lesson must link its dedicated mutation exercise');
assert.deepEqual(dmlQualityModule.lessons.find(lesson => lesson.title === 'MERGE: синхронизация двух наборов').practiceIds, ['e113'], 'MERGE lesson must link its dedicated synchronization exercise');
assert.ok(dmlQualityModule.lessons.find(lesson => lesson.title === 'UPSERT: ON CONFLICT').body.includes('exclusion constraints не могут быть арбитром для DO UPDATE'), 'UPSERT lesson must distinguish the unique arbiter requirement for DO UPDATE');
assert.ok(exercises.find(exercise => exercise.id === 'e112').solution.includes('RETURNING'), 'RETURNING practice must execute and expose the changed row in the same statement');
const ddlQualityModule = modules.find(module => module.id === 'ddl');
assert.ok(ddlQualityModule.lessons.find(lesson => lesson.title === 'PostgreSQL: ограничения и блокировки при миграциях').example.includes('VALIDATE CONSTRAINT'), 'Migration lesson must demonstrate deferred constraint validation');
const transactionQualityModule = modules.find(module => module.id === 'constraints');
assert.ok(transactionQualityModule.lessons.find(lesson => lesson.title === 'ACID').example.includes('ON COMMIT DROP'), 'ACID example must clean up its temporary teaching table');
assert.ok(transactionQualityModule.lessons.find(lesson => lesson.title === 'SAVEPOINT и частичный откат').example.includes('ROLLBACK TO SAVEPOINT'), 'Savepoint example must demonstrate a partial rollback');
assert.ok(transactionQualityModule.lessons.find(lesson => lesson.title === 'ACID').example.includes('acid_accounts'), 'ACID example must use its own temporary table name');
assert.ok(transactionQualityModule.lessons.find(lesson => lesson.title === 'Действия внешних ключей и отложенные ограничения').example.includes('fk_action_order_items_demo'), 'Foreign-key example must not collide with the seeded order_items table');
assert.deepEqual(transactionQualityModule.lessons.find(lesson => lesson.title === 'Действия внешних ключей и отложенные ограничения').practiceIds, ['e114','e115'], 'Foreign-key lesson must link deferred and cascading constraint practice');
const viewsQualityModule = modules.find(module => module.id === 'views');
assert.deepEqual(viewsQualityModule.lessons.find(lesson => lesson.title === 'VIEW').practiceIds, ['e116'], 'VIEW lesson must link its dedicated view task');
assert.deepEqual(viewsQualityModule.lessons.find(lesson => lesson.title === 'Материализованное представление').practiceIds, ['e117'], 'Materialized view lesson must link its refresh task');
assert.deepEqual(viewsQualityModule.lessons.find(lesson => lesson.title === 'Функции PostgreSQL').practiceIds, ['e118'], 'SQL function lesson must link its function task');
assert.deepEqual(viewsQualityModule.lessons.find(lesson => lesson.title === 'Триггеры').practiceIds, ['e119'], 'Trigger lesson must link its trigger task');
assert.deepEqual(viewsQualityModule.lessons.find(lesson => lesson.title === 'Основы PL/pgSQL: переменные и ветвления').practiceIds, ['e120'], 'PL/pgSQL lesson must link its variable and branching task');
assert.deepEqual(viewsQualityModule.lessons.find(lesson => lesson.title === 'Обработка ошибок и EXCEPTION').practiceIds, ['e121'], 'EXCEPTION lesson must link its unique-violation task');
assert.ok(viewsQualityModule.lessons.find(lesson => lesson.title === 'Функции PostgreSQL').example.includes('AS $$'), 'SQL function example must use valid dollar quoting');
assert.ok(viewsQualityModule.lessons.find(lesson => lesson.title === 'Триггеры').example.includes('AS $$'), 'Trigger function example must use valid dollar quoting');
assert.ok(viewsQualityModule.lessons.find(lesson => lesson.title === 'Обработка ошибок и EXCEPTION').example.includes('DO $'), 'DO example must use valid dollar quoting');
const performanceQualityModule = modules.find(module => module.id === 'performance');
assert.deepEqual(performanceQualityModule.lessons.find(lesson => lesson.title === 'B-tree и обычный индекс').practiceIds, ['e68'], 'B-tree lesson must link its index-creation task');
assert.deepEqual(performanceQualityModule.lessons.find(lesson => lesson.title === 'Составной индекс и порядок столбцов').practiceIds, ['e122'], 'Composite-index lesson must link its ordered INCLUDE index task');
assert.deepEqual(performanceQualityModule.lessons.find(lesson => lesson.title === 'Expression, partial, GIN, GiST и BRIN индексы').practiceIds, ['e123'], 'Partial-index lesson must link its predicate task');
assert.deepEqual(performanceQualityModule.lessons.find(lesson => lesson.title === 'Расширенная статистика и ошибки оценок').practiceIds, ['e124'], 'Extended-statistics lesson must link its statistics task');
assert.deepEqual(performanceQualityModule.lessons.find(lesson => lesson.title === 'Sargable-условия: не мешай индексу').practiceIds, ['e125'], 'Sargable lesson must link its timestamp-range task');
assert.ok(performanceQualityModule.lessons.find(lesson => lesson.title === 'Параметры запроса и prepared statements').example.includes('DEALLOCATE orders_by_customer_demo'), 'Prepared-statement example must clean up its statement');
assert.ok(performanceQualityModule.lessons.find(lesson => lesson.title === 'Статистика, ANALYZE и VACUUM').note.includes('нельзя выполнять внутри транзакционного блока'), 'VACUUM note must explain the transaction-block restriction');
assert.ok(exercises.find(exercise => exercise.id === 'e101').solution.includes('GROUP BY customer_id'), 'Plan-reading exercise must include an aggregate node');
const advancedQualityModule = modules.find(module => module.id === 'advanced');
assert.deepEqual(advancedQualityModule.lessons.find(lesson => lesson.title === 'Полнотекстовый поиск').practiceIds, ['e127'], 'Full-text lesson must link its search task');
assert.deepEqual(advancedQualityModule.lessons.find(lesson => lesson.title === 'Партиционирование').practiceIds, ['e126'], 'Partitioning lesson must link its range-partition task');
assert.deepEqual(advancedQualityModule.lessons.find(lesson => lesson.title === 'Системные каталоги и information_schema').practiceIds, ['e128'], 'Metadata lesson must link its schema-inspection task');
assert.ok(advancedQualityModule.lessons.find(lesson => lesson.title === 'Полнотекстовый поиск').example.includes('USING GIN'), 'Full-text example must show a GIN index');
assert.ok(advancedQualityModule.lessons.find(lesson => lesson.title === 'Партиционирование').example.includes('PARTITION OF'), 'Partitioning example must create actual child partitions');
assert.ok(advancedQualityModule.lessons.find(lesson => lesson.title === 'Временные и UNLOGGED-таблицы').note.includes('PGlite'), 'UNLOGGED note must distinguish server WAL behavior from the browser sandbox');
const securityQualityModule = modules.find(module => module.id === 'security');
assert.deepEqual(securityQualityModule.lessons.find(lesson => lesson.title === 'Параметризованные запросы: безопасная передача значений').practiceIds, ['e129'], 'Parameterized-query lesson must link its positional-parameter task');
assert.deepEqual(securityQualityModule.lessons.find(lesson => lesson.title === 'Безопасный динамический SQL').practiceIds, ['e130'], 'Dynamic SQL lesson must link its identifier/value safety task');
assert.ok(securityQualityModule.lessons.find(lesson => lesson.title === 'Row-Level Security и безопасные функции').body.includes('SECURITY DEFINER') && securityQualityModule.lessons.find(lesson => lesson.title === 'Row-Level Security и безопасные функции').body.includes('search_path'), 'Security-definer guidance must explain trusted search_path');
assert.ok(securityQualityModule.lessons.find(lesson => lesson.title === 'Row-Level Security и безопасные функции').example.includes("current_setting('app.store_id', true)"), 'RLS example must deny rows safely when the tenant setting is absent');
assert.ok(securityQualityModule.lessons.find(lesson => lesson.title === 'Параметризованные запросы: безопасная передача значений').example.includes('DEALLOCATE'), 'Prepared-statement example must release the prepared statement');
assert.ok(securityQualityModule.lessons.find(lesson => lesson.title === 'Безопасный динамический SQL').example.includes('EXECUTE format') && securityQualityModule.lessons.find(lesson => lesson.title === 'Безопасный динамический SQL').example.includes('USING'), 'Dynamic SQL example must separate identifiers and values');
assert.ok(securityQualityModule.lessons.find(lesson => lesson.title === 'Роли и права').note.includes('PGlite'), 'Role-management note must distinguish server privileges from the embedded sandbox');
assert.ok(securityQualityModule.lessons.find(lesson => lesson.title === 'Резервные копии и восстановление').note.includes('pg_dump'), 'Backup note must identify external command-line tools');



const aggregateModule = modules.find(module => module.id === 'aggregates');
assert.deepEqual(aggregateModule.lessons.find(lesson => lesson.title === 'DISTINCT внутри агрегатов').exampleResult.rows, [[3,4000,3000]], 'SUM(DISTINCT amount) must demonstrate lost revenue when two orders share an amount');
assert.ok(aggregateModule.lessons.find(lesson => lesson.title === 'DISTINCT внутри агрегатов').body.includes('дедуплицируй по order_id'), 'Aggregate DISTINCT lesson must direct entity deduplication to the business key');

assert.ok(aggregateModule.lessons.find(lesson => lesson.title === 'Агрегатные функции').body.includes('COUNT(DISTINCT employee_id)'), 'Aggregate lesson must distinguish row, non-null and distinct-value counts');
assert.ok(aggregateModule.lessons.find(lesson => lesson.title === 'GROUP BY и зерно результата').body.includes('COUNT(o.order_id)'), 'GROUP BY lesson must explain COUNT(*) versus COUNT(right_key) after LEFT JOIN');
assert.ok(aggregateModule.lessons.find(lesson => lesson.title === 'Условная агрегация и FILTER').body.includes('только для того агрегата'), 'FILTER lesson must explain its local scope');
const preAggregationLesson = aggregateModule.lessons.find(lesson => lesson.title === 'Предварительная агрегация до нужного зерна');
assert.ok(preAggregationLesson.body.includes('одну строку на order_id'), 'Pre-aggregation lesson must define the target grain');
assert.deepEqual(preAggregationLesson.exampleResult.rows, [[101,1200],[102,700],[103,2500],[104,500],[105,1800],[106,2500],[107,1500],[108,900],[109,3400],[110,800],[111,900],[112,2800]], 'Pre-aggregation example must return one item total per order');
const joinsModule = modules.find(module => module.id === 'joins');
const cardinalityLesson = joinsModule.lessons.find(lesson => lesson.title === 'Кардинальность и размножение строк');
assert.ok(cardinalityLesson.body.includes('UNIQUE или PRIMARY KEY'), 'Join cardinality lesson must distinguish foreign keys from uniqueness');
assert.deepEqual(cardinalityLesson.exampleResult.rows, [[101,3],[102,2],[105,2],[109,2],[111,2],[112,2]], 'Cardinality query must identify every order with multiple item rows');
assert.ok(joinsModule.lessons.find(lesson => lesson.title === 'Fan-out: соединение нескольких таблиц деталей').exampleResult.rows.length === 6, 'Fan-out lesson must show the 3-by-2 row multiplication');
assert.ok(joinsModule.lessons.find(lesson => lesson.title === 'INNER JOIN и LEFT JOIN').body.includes('WHERE'), 'Join lesson must explain ON versus WHERE after LEFT JOIN');
assert.equal(joinsModule.lessons.find(lesson => lesson.title === 'Что делает JOIN').exampleResult.rows.length, 4, 'Basic JOIN example must preserve one row per order when the right key is unique');
assert.equal(joinsModule.lessons.find(lesson => lesson.title === 'INNER JOIN и LEFT JOIN').exampleResult.rows.length, 3, 'LEFT JOIN with a right-side ON filter must preserve all selected left rows');
assert.ok(joinsModule.lessons.find(lesson => lesson.title === 'Anti join и semi join через EXISTS').example.includes('NOT EXISTS'), 'Anti join lesson must demonstrate NOT EXISTS');
assert.equal(joinsModule.lessons.find(lesson => lesson.title === 'JOIN ... USING, NATURAL JOIN и LATERAL').exampleResult.rows.length, 5, 'LEFT JOIN LATERAL example must preserve a store without orders');
assert.equal(joinsModule.lessons.find(lesson => lesson.title === 'FULL, CROSS и SELF JOIN').exampleResult.rows.length, 2, 'FULL JOIN reconciliation example must show orders without payments');
const conversionLesson = typesModule.lessons.find(lesson => lesson.title === 'Преобразование типов');
assert.ok(conversionLesson.example.includes('7 / 2') && conversionLesson.example.includes('7::NUMERIC / 2'), 'Type conversion lesson must contrast integer and decimal division');
const anatomyModule = modules.find(module => module.id === 'anatomy');
assert.ok(anatomyModule.lessons.find(lesson => lesson.title === 'Логический порядок обработки').body.includes('физически выполняет'), 'Logical query order lesson must distinguish logical semantics from physical execution');
assert.ok(anatomyModule.lessons.find(lesson => lesson.title === 'Логический порядок обработки').body.includes('Оконные вычисления (WINDOW)'), 'Logical query order lesson must place window calculations');
assert.ok(appSource.includes(String.raw`split(/\n\s*\n/)`), 'Lesson explanations must render as separate paragraphs');

const linkedPractice = modules.flatMap(module => module.lessons.flatMap(lesson => (lesson.practiceIds || []).map(id => ({ module, id }))));
assert.equal(linkedPractice.length, exercises.length, 'Every exercise must be linked from its intended lesson');
assert.equal(new Set(linkedPractice.map(item => item.id)).size, linkedPractice.length, 'An exercise must not be linked to multiple lessons');
for (const item of linkedPractice) assert.ok(exercises.some(exercise => exercise.id === item.id && exercise.m === item.module.id), `Practice link ${item.id} must belong to its lesson module`);
assert.ok(modules.every(module => module.lessons.every(lesson => Array.isArray(lesson.quiz))), 'Quiz data must be stored on individual lessons');
assert.ok(modules.some(module => module.lessons.some(lesson => lesson.quiz.length)), 'Lessons must include focused knowledge checks');
assert.ok(!appSource.includes('state.lessonIndex*2'), 'Lesson quizzes must not rotate through unrelated module-wide questions');
assert.ok(!appSource.includes('exercises.find(x=>x.m===state.moduleId)'), 'Lesson practice must not jump to the first arbitrary exercise in a module');
assert.ok(appSource.includes("if(state.view!=='practice')go('practice')"), 'Lesson practice links must navigate to the practice page');

assert.ok(modules.every(module => module.sources?.length), 'Every module must link to official documentation');
assert.ok(modules.every(module => module.quiz?.length >= 4), 'Every module must include a question bank');
const quizQuestions = modules.flatMap(module => module.quiz);
assert.equal(quizQuestions.length, 100, 'Expected 100 knowledge-check questions');
assert.equal(new Set(quizQuestions.map(question => question.question.replace(/\s+/g, ' ').trim().toLowerCase())).size, 100, 'The 100-question assessment bank must not repeat question wording');
assert.ok(quizQuestions.every(question => question.question && question.options?.length === 4 && Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4 && question.explanation), 'Every quiz question must have four options, a valid answer and an explanation');
const answerPositionCounts = [0,0,0,0];
for (const question of quizQuestions) answerPositionCounts[question.answer]++;
assert.deepEqual(answerPositionCounts, [25,25,25,25], 'Correct answer positions must be balanced across the 100-question assessment bank');
assert.ok(modules.every(module => module.quiz.map(question => question.answer).sort((a,b)=>a-b).join(',') === '0,1,2,3'), 'Each four-question module assessment must use each correct answer position exactly once');
assert.equal(new Set(quizQuestions.map(question => question.question.trim().toLowerCase())).size, quizQuestions.length, 'Assessment questions must be unique');
assert.ok(quizQuestions.every(question => new Set(question.options.map(option => option.trim().toLowerCase())).size === 4), 'Every assessment question must have four distinct options');
assert.ok(appSource.includes("editor('','exercise-editor'"), 'Practice editor must start empty');
assert.ok(appSource.includes('navigationScrollReset') && appSource.includes('sidebarScroll'), 'Lesson navigation must preserve scroll position');
assert.ok(appSource.includes('renderExerciseQuiz') && appSource.includes('data-exercise-quiz-answer'), 'Every practical exercise must render an interactive knowledge check');
assert.ok(appSource.includes('document.addEventListener(\'click\',event=>'), 'Navigation must use a single delegated click handler');
assert.ok(htmlSource.includes('codemirror/5.65.16'), 'The web app must load the SQL editor');
assert.equal(new Set(exercises.map(exercise => exercise.id)).size, exercises.length, 'Exercise IDs must be unique');
assert.ok(exercises.every(exercise => ids.has(exercise.m)), 'Every exercise must reference an existing module');
assert.ok(exercises.every(exercise => exercise.solution && exercise.task && exercise.hint?.trim()), 'Every exercise must have a task, unique hint and reference solution');
const orderSensitiveExerciseIds = exercises.filter(exercise => exercise.orderMatters).map(exercise => exercise.id).sort();
assert.deepEqual(orderSensitiveExerciseIds, ['e10','e11','e12','e38','e41','e56','e59','e72','e73','e74','e75','e77'], 'Only tasks that explicitly require final row order must compare it');
assert.ok(exercises.filter(exercise => exercise.orderMatters).every(exercise => exercise.solution.toUpperCase().includes('ORDER BY')), 'Every order-sensitive exercise must define an explicit final or result-defining order');
assert.ok(exercises.find(exercise => exercise.id === 'e59').solution.includes('ORDER BY n') && exercises.find(exercise => exercise.id === 'e59').task.includes('по возрастанию'), 'Recursive sequence task must state and implement ascending output order');
assert.ok(exercises.find(exercise => exercise.id === 'e38').solution.trim().endsWith('ORDER BY created_at, order_id;'), 'Running-total task must define final output order in addition to the window calculation order');
assert.equal(new Set(exercises.map(exercise => exercise.hint)).size, exercises.length, 'Every practical exercise must have a unique task-specific hint');
assert.equal(new Set(exercises.map(exercise => exercise.hint2.trim())).size, exercises.length, 'Every practical exercise must have a unique reasoning hint');
assert.equal(new Set(exercises.map(exercise => exercise.hint3.trim())).size, exercises.length, 'Every practical exercise must have a unique query-structure hint');
const progressiveHintExercises = exercises.filter(exercise => exercise.hint2 || exercise.hint3);
assert.equal(progressiveHintExercises.length, exercises.length, 'All practical tasks must expose three progressive hint levels');
assert.ok(progressiveHintExercises.every(exercise => exercise.hint2?.trim() && exercise.hint3?.trim()), 'Every practical task must provide reasoning and a query-structure hint level');
assert.ok(appSource.includes('function renderExerciseHints') && appSource.includes('exercise.hint3'), 'Practice must render optional hints as separately revealed levels');
assert.ok(appSource.includes('${renderExerciseHints(active)}'), 'The active practice task must render its own hint data instead of a shared generic hint');
const hintStart = appSource.indexOf('function renderExerciseHints');
const hintEnd = appSource.indexOf('function renderPractice()', hintStart);
const renderHints = new Function('esc', appSource.slice(hintStart, hintEnd) + '; return renderExerciseHints;')(escapeHtml);
const progressiveHintHtml = renderHints({ hint: 'direction', hint2: 'reasoning', hint3: 'structure' });
assert.ok(progressiveHintHtml.includes('direction') && progressiveHintHtml.includes('reasoning') && progressiveHintHtml.includes('structure'), 'All supplied hint levels must be rendered');
assert.equal((progressiveHintHtml.match(/<details/g) || []).length, 3, 'Each hint level must remain independently collapsed until requested');
assert.ok(appSource.includes('state.expected.size !== exercises.length') && appSource.includes('failures.length'), 'The SQL engine must not become ready when any expected exercise result is missing');
assert.ok(appSource.includes('function renderAssessment') && appSource.includes('data-assessment-module') && appSource.includes('data-assessment-answer'), 'Module question banks must be accessible through a dedicated assessment flow');
assert.ok(appSource.includes('assessment-submit') && appSource.includes('assessment-retry') && appSource.includes('assessmentResults'), 'Module assessments must support submission, retakes and persistent best results');
assert.ok(appSource.includes('Math.ceil(bank.length*0.75)'), 'Module assessment pass threshold must be explicit and consistent');
assert.ok(cssSource.includes('.assessment-grid') && cssSource.includes('@media(max-width:700px){.assessment-grid{grid-template-columns:1fr}'), 'Module assessments must adapt to mobile screens');
assert.ok(cssSource.includes('var(--line)') && !cssSource.includes('var(--border)') && !cssSource.includes('var(--card)'), 'Assessment styles must use the existing design tokens');
assert.ok(htmlSource.includes('data-nav="assessment"'), 'Module assessments must be reachable from main navigation');
assert.equal((htmlSource.match(/data-nav="assessment"/g)||[]).length,1,'Assessment navigation must appear exactly once');
assert.ok(modules.every(module => module.quiz.length === 4), 'Every module assessment must contain four bank questions');
assert.ok(appSource.includes('assessmentResults:state.assessmentResults'),'Progress migration must preserve completed assessment results');
assert.ok(appSource.includes("setEditorValue('exercise-editor',ex.solution)"),'Reference solutions must be inserted without rewriting SQL literals or comments');
assert.ok(!appSource.includes('function formatSql(sql)'), 'Unused regex SQL formatter must be removed');
assert.equal(sandboxTaskTopics.length, 14, 'Expected fourteen selectable random-task topics');
assert.equal(sandboxTaskCount, 350, 'Expected 350 random sandbox tasks');
assert.ok(sandboxTaskTopics.every(topic => topic.tasks.length === 25 && new Set(topic.tasks.map(item => item.prompt)).size === 25 && new Set(topic.tasks.map(item => item.hint)).size === 25), 'Every random-task topic must contain 25 unique prompts and hints');
assert.ok(sandboxTaskTopics.every(topic => topic.tasks.every(item => item.title && item.prompt && item.hint && item.solution)), 'Every random task must include a title, task condition, specific hint and reference solution');
assert.ok(appSource.includes('data-random-topic') && appSource.includes('new-random-task') && appSource.includes('check-random-task'), 'Playground must provide topic selection, random task generation and checking');
assert.deepEqual(modules.filter(module=>module.track==='core').map(module=>module.id), learningTracks.find(track=>track.id==='core').moduleIds, 'Core modules must follow the declared analyst route');
assert.deepEqual(modules.filter(module=>module.track==='postgresql').map(module=>module.id), learningTracks.find(track=>track.id==='postgresql').moduleIds, 'PostgreSQL modules must follow the declared optional route');
assert.equal(learningTracks.length,2,'The curriculum must expose exactly two learning routes');
assert.ok(modules.every(module=>['core','postgresql'].includes(module.track)&&Number.isInteger(module.trackOrder)), 'Every module must belong to an explicit learning route');
const lessonIds=modules.flatMap(module=>module.lessons.map(lesson=>lesson.id));
assert.equal(new Set(lessonIds).size,173,'Every lesson must have a unique stable ID');
assert.ok(lessonIds.every(id=>typeof id==='string'&&id.length>4),'Every lesson ID must be stable and non-empty');
assert.ok(appSource.includes('migrateProgress(saved,modules)')&&appSource.includes('state.completedLessons=new Set(progress.lessons)'), 'Application must restore normalized stable-ID progress before rendering');
assert.ok(appSource.includes('data-open-course=')&&appSource.includes('state.roadmapTrack=track.id'),'The course catalog must open a selected course program without mixing routes');
assert.ok(modules.findIndex(module => module.id === 'select') < modules.findIndex(module => module.id === 'ddl'), 'Read-query fundamentals must be taught before schema modification');
assert.ok(modules.findIndex(module=>module.id==='workflow')<modules.findIndex(module=>module.id==='ddl'),'The optional PostgreSQL route must follow the complete analyst route');
assert.ok(modules.findIndex(module => module.id === 'analytics') === modules.findIndex(module => module.id === 'windows') + 1, 'Professional analytics must follow window functions directly');
const windowRankingQualityModule = modules.find(module => module.id === 'windows');
assert.deepEqual(windowRankingQualityModule.lessons.find(lesson => lesson.title === 'NTILE, PERCENT_RANK и CUME_DIST').exampleResult.rows.map(row => row.slice(2)), [[1,0,0.2],[1,0.25,0.4],[2,0.5,0.6],[3,0.75,1],[4,0.75,1]], 'NTILE may split peers deterministically while percentile functions retain equal-value peers');
assert.ok(windowRankingQualityModule.lessons.find(lesson => lesson.title === 'Фильтрация оконного результата и top-N на группу').body.includes('RANK() с сортировкой только по выручке'), 'Top-N lesson must explain how to include ties at the cutoff');
assert.ok(windowRankingQualityModule.lessons.find(lesson => lesson.title === 'Фильтрация оконного результата и top-N на группу').example.includes('ORDER BY category, rn'), 'Top-N output must define a stable final order');
const rankingLesson = modules.find(module => module.id === 'windows').lessons.find(lesson => lesson.id === 'windows.row-number-rank-i-dense-rank');
assert.ok(rankingLesson.example.includes('(1, 101, 100)') && rankingLesson.example.includes('(1, 102, 100)') && rankingLesson.example.includes('(1, 103, 80)'), 'Ranking example must include a tie and a lower value in the same partition');
assert.deepEqual(rankingLesson.exampleResult.rows.map(row => row.slice(3)), [[1,1,1],[2,1,1],[3,3,2],[1,1,1],[2,2,2]], 'ROW_NUMBER, RANK and DENSE_RANK must demonstrate distinct tie behavior');

for (const id of ['e46','e101','e102']) {
  const exercise = exercises.find(item => item.id === id);
  assert.ok(exercise && exercise.mode === 'explain', `EXPLAIN exercise ${id} must exist`);
  assert.ok(exercise.requiredPatterns?.length, `EXPLAIN exercise ${id} must validate its requested query`);
  const query = sqlLexer.explainStatementBody(exercise.solution);
  assert.ok(exercise.requiredPatterns.every(pattern => new RegExp(pattern, 'i').test(query)), `Reference query for ${id} must satisfy every required pattern`);
  assert.ok(exercise.requiredPatterns.some(pattern => !new RegExp(pattern, 'i').test('SELECT 1')), `EXPLAIN exercise ${id} must reject an unrelated query`);
}
assert.ok(appSource.includes('ex.requiredPatterns'), 'EXPLAIN exercises must validate task-specific query requirements');

const db = new PGlite();
try {
  await db.exec(seedSQL);
  const fanOutExercise = exercises.find(exercise => exercise.id === 'e103');
  assert.ok(fanOutExercise && fanOutExercise.m === 'joins' && fanOutExercise.mode === 'select', 'The dedicated fan-out exercise must exist in the JOIN course');
  const baseFanOutMetrics = await db.query(fanOutExercise.solution);
  assert.equal(baseFanOutMetrics.rows.length, 12, 'Fan-out solution must return exactly one row for every seeded order');
  assert.equal(new Set(baseFanOutMetrics.rows.map(row => row.order_id)).size, 12, 'Fan-out solution must preserve one row per order');
  const firstFanOutOrder = baseFanOutMetrics.rows.find(row => Number(row.order_id) === 101);
  assert.ok(firstFanOutOrder, 'Fan-out solution must retain order 101');
  assert.deepEqual([Number(firstFanOutOrder.items_amount), Number(firstFanOutOrder.events_count)], [1200, 2], 'Order 101 must total three item lines once and count its two events once');
  const orderWithoutEvents = baseFanOutMetrics.rows.find(row => Number(row.order_id) === 104);
  assert.ok(orderWithoutEvents, 'An order without events must remain in the result');
  assert.equal(Number(orderWithoutEvents.events_count), 0, 'An order without events must report zero events rather than disappear');

  // Compare all random JOIN variants with independent query oracles.
  // The task solutions use joins/aggregations; the oracles use correlated subqueries
  // so the expected rows are not produced by re-running the same solution shape.
  const joinRandomTasks = sandboxTaskTopics.find(topic => topic.id === 'joins')?.tasks || [];
  assert.equal(joinRandomTasks.length, 25, 'JOIN random practice must contain exactly 25 variants');
  const joinOracleCases = [
    {
      params: ['Москва','Казань','Пермь','Омск','Тверь'],
      expectedCounts: [3,4,3,0,0],
      query: `SELECT o.order_id,
                     (SELECT c.customer_name FROM customers c WHERE c.customer_id = o.customer_id) AS customer_name,
                     o.status, o.total_amount
              FROM orders o
              WHERE EXISTS (
                SELECT 1 FROM customers c
                WHERE c.customer_id = o.customer_id AND c.city = $1
              )
              ORDER BY o.order_id`
    },
    {
      params: [],
      expectedCounts: [5,5,5,5,5],
      query: `SELECT s.store_name, s.city,
                     (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.store_id) AS orders_count
              FROM stores s
              ORDER BY s.city, s.store_name`
    },
    {
      params: ['delivered','shipped','new','cancelled','delivered'],
      expectedCounts: [5,5,5,5,5],
      query: `SELECT e.employee_id, e.employee_name,
                     (SELECT COUNT(*) FROM orders o
                      WHERE o.employee_id = e.employee_id AND o.status = $1) AS orders_count
              FROM employees e
              ORDER BY orders_count DESC, e.employee_id`
    },
    {
      params: ['Техника','Посуда','Продукты','Аксессуары','Подарки'],
      expectedCounts: [2,2,1,1,0],
      query: `SELECT p.product_name,
                     (SELECT COUNT(DISTINCT oi.order_id) FROM order_items oi WHERE oi.product_id = p.product_id) AS orders_count,
                     (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.product_id = p.product_id) AS units_sold
              FROM products p
              WHERE p.category = $1
                AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.product_id)
              ORDER BY units_sold DESC`
    },
    {
      params: ['delivered','shipped','new','cancelled','delivered'],
      expectedCounts: [6,3,2,1,1], // The fifth task additionally filters delivered orders to amounts of at least 2000.
      query: `SELECT o.order_id, o.total_amount,
                     COALESCE((SELECT SUM(p.amount) FROM payments p
                               WHERE p.order_id = o.order_id AND p.payment_status = 'paid'), 0) AS paid_amount
              FROM orders o
              WHERE o.status = $1
              ORDER BY o.order_id`
    }
  ];
  for (let pattern = 0; pattern < joinOracleCases.length; pattern++) {
    const oracleCase = joinOracleCases[pattern];
    for (let variant = 0; variant < 5; variant++) {
      const task = joinRandomTasks[pattern * 5 + variant];
      assert.ok(task && task.id === `rnd-joins-${String(pattern * 5 + variant + 1).padStart(2,'0')}`, 'JOIN task order must remain grouped into its five documented families');
      if (pattern === 1) {
      const storeOracleQueries = [
        "SELECT s.store_id,s.store_name,s.city,(SELECT COUNT(*) FROM orders o WHERE o.store_id=s.store_id) AS orders_count FROM stores s ORDER BY s.city,s.store_name",
        "SELECT s.store_id,s.store_name,s.city,COALESCE((SELECT SUM(o.total_amount) FROM orders o WHERE o.store_id=s.store_id),0) AS revenue FROM stores s ORDER BY revenue DESC,s.store_id",
        "SELECT s.store_id,s.store_name,(SELECT COUNT(DISTINCT o.customer_id) FROM orders o WHERE o.store_id=s.store_id) AS customers_count FROM stores s ORDER BY customers_count DESC,s.store_id",
        "SELECT s.store_id,s.store_name,(SELECT ROUND(AVG(o.total_amount),2) FROM orders o WHERE o.store_id=s.store_id) AS avg_order_amount FROM stores s ORDER BY avg_order_amount DESC NULLS LAST,s.store_id",
        "SELECT s.store_id,s.store_name,(SELECT MAX(o.created_at) FROM orders o WHERE o.store_id=s.store_id) AS last_order_date,(SELECT COUNT(*) FROM orders o WHERE o.store_id=s.store_id) AS orders_count FROM stores s ORDER BY last_order_date DESC NULLS LAST,s.store_id"
      ];
      const actual = await db.query(task.solution);
      const expected = await db.query(storeOracleQueries[variant]);
      assert.equal(actual.rows.length, 5, `JOIN task ${task.id} must retain every store`);
      assert.equal(new Set(actual.rows.map(row => row.store_id)).size, 5, `JOIN task ${task.id} must preserve one row per store`);
      assert.equal(resultMatches(normalize(actual), normalize(expected), task.orderMatters), true, `JOIN task ${task.id} must match its independent store-level oracle`);
      continue;
    }
    const params = oracleCase.params.length ? [oracleCase.params[variant]] : [];
      const actual = await db.query(task.solution);
      let expected;
      if (pattern === 2 && variant === 4) {
        expected = await db.query("SELECT e.employee_id,e.employee_name,(SELECT COUNT(*) FROM orders o WHERE o.employee_id=e.employee_id AND o.status=$1 AND o.created_at >= DATE '2026-01-13') AS orders_count FROM employees e ORDER BY orders_count DESC,e.employee_id", params);
      } else if (pattern === 4 && variant === 4) {
        expected = await db.query("SELECT o.order_id,o.total_amount,COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id=o.order_id AND p.payment_status='paid'),0) AS paid_amount FROM orders o WHERE o.status=$1 AND o.total_amount >= 2000 ORDER BY o.order_id", params);
      } else {
        expected = await db.query(oracleCase.query, params);
      }
      assert.equal(actual.rows.length, oracleCase.expectedCounts[variant], `JOIN task ${task.id} must return the expected number of rows`);
      const grainColumn = ['order_id','store_name','employee_id','product_name','order_id'][pattern];
      assert.equal(
        new Set(actual.rows.map(row => row[grainColumn])).size,
        actual.rows.length,
        `JOIN task ${task.id} must preserve one result row per ${grainColumn}`
      );
      assert.equal(
        resultMatches(normalize(actual), normalize(expected), task.orderMatters),
        true,
        `JOIN task ${task.id} must match its independent correlated-subquery oracle`
      );
    }
  }
  const storeZeroOrderCount = await db.query(joinOracleCases[1].query);
  assert.equal(Number(storeZeroOrderCount.rows.find(row => row.store_name === 'Запасной')?.orders_count), 0, 'A store without orders must remain with a zero count');
  const employeeZeroCounts = await db.query(joinOracleCases[2].query, ['new']);
  assert.ok(employeeZeroCounts.rows.every(row => Number(row.orders_count) === 0), 'Employees without orders of the selected status must remain with zero counts');
  assert.equal(Number(employeeZeroCounts.rows.find(row => Number(row.employee_id) === 5)?.orders_count), 0, 'An employee without any assigned orders must remain with zero counts');
  const coffeeProduct = await db.query(joinOracleCases[3].query, ['Продукты']);
  assert.deepEqual(
    coffeeProduct.rows.map(row => [Number(row.orders_count), Number(row.units_sold)]),
    [[4,5]],
    'Product metrics must distinguish four distinct orders from five physical units'
  );
  const unpaidNewOrder = await db.query(joinOracleCases[4].query, ['new']);
  assert.equal(Number(unpaidNewOrder.rows[0]?.paid_amount), 0, 'An order without a successful payment must report zero');
  const refundedOrder = await db.query(joinOracleCases[4].query.replace('WHERE o.status = $1','WHERE o.order_id = 106'), []);
  assert.equal(Number(refundedOrder.rows[0]?.paid_amount), 0, 'A refunded payment must not count as a successful payment');
  console.log('Verified all 25 random JOIN variants against independent correlated-subquery oracles.');
  const equivalentSelect = await db.query("SELECT order_id, status FROM orders WHERE status = 'delivered'");
  const equivalentCte = await db.query("WITH delivered_orders AS (SELECT status, order_id FROM orders WHERE status IN ('delivered')) SELECT status, order_id FROM delivered_orders");
  assert.equal(resultMatches(normalize(equivalentSelect),normalize(equivalentCte)),true,'Equivalent SELECT and CTE solutions must match even when output columns are reordered');
  const differentGrain = await db.query("SELECT DISTINCT customer_id, status FROM orders WHERE status = 'delivered'");
  assert.equal(resultMatches(normalize(equivalentSelect),normalize(differentGrain)),false,'A query with a different grain and output shape must not be accepted as equivalent');
  const duplicatePreserving = await db.query("SELECT customer_id FROM orders WHERE status = 'delivered'");
  const duplicateLosing = await db.query("SELECT DISTINCT customer_id FROM orders WHERE status = 'delivered'");
  assert.equal(resultMatches(normalize(duplicatePreserving),normalize(duplicateLosing)),false,'DISTINCT must not hide duplicate rows when the task expects them');
  const alternativeJoin = await db.query("SELECT s.store_name, COUNT(*)::int AS order_count FROM stores s JOIN orders o USING (store_id) WHERE o.status = 'delivered' GROUP BY s.store_name");
  const alternativeSubquery = await db.query("SELECT store_name, order_count FROM (SELECT store_id, COUNT(*)::int AS order_count FROM orders WHERE status = 'delivered' GROUP BY store_id) totals JOIN stores USING (store_id)");
  assert.equal(resultMatches(normalize(alternativeJoin),normalize(alternativeSubquery)),true,'Equivalent JOIN and pre-aggregated subquery solutions must match');
  const nullPredicate = await db.query("SELECT order_id FROM orders WHERE employee_id IS NULL ORDER BY order_id");
  const nullSafePredicate = await db.query("SELECT order_id FROM orders WHERE employee_id IS NOT DISTINCT FROM NULL ORDER BY order_id");
  assert.equal(resultMatches(normalize(nullPredicate,true),normalize(nullSafePredicate,true),true),true,'Equivalent NULL predicates must return the same rows and preserve requested ordering');
  const filteredAggregate = await db.query("SELECT COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered_count FROM orders");
  const conditionalAggregate = await db.query("SELECT SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END)::int AS delivered_count FROM orders");
  assert.equal(resultMatches(normalize(filteredAggregate),normalize(conditionalAggregate)),true,'FILTER and conditional aggregation must match when they express the same metric');
  const windowDirect = await db.query("SELECT order_id, ROW_NUMBER() OVER (ORDER BY created_at DESC, order_id DESC)::int AS position FROM orders ORDER BY position");
  const windowCte = await db.query("WITH ranked_orders AS (SELECT order_id, created_at, ROW_NUMBER() OVER (ORDER BY created_at DESC, order_id DESC)::int AS position FROM orders) SELECT position, order_id FROM ranked_orders ORDER BY position");
  assert.equal(resultMatches(normalize(windowDirect,true),normalize(windowCte,true),true),true,'Equivalent window calculations through a CTE must match with an explicit output order');
  const customersWithDeliveredIn = await db.query("SELECT c.customer_id FROM customers c WHERE c.customer_id IN (SELECT o.customer_id FROM orders o WHERE o.status = 'delivered') ORDER BY c.customer_id");
  const customersWithDeliveredExists = await db.query("SELECT c.customer_id FROM customers c WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.status = 'delivered') ORDER BY c.customer_id");
  assert.equal(resultMatches(normalize(customersWithDeliveredIn),normalize(customersWithDeliveredExists),true),true,'IN and EXISTS must match even when the subquery contains duplicate customer IDs');

  const employeesNotInNullableSet = await db.query("SELECT employee_id FROM employees WHERE employee_id NOT IN (SELECT employee_id FROM orders) ORDER BY employee_id");
  const employeesNotExists = await db.query("SELECT e.employee_id FROM employees e WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.employee_id = e.employee_id) ORDER BY e.employee_id");
  assert.equal(employeesNotInNullableSet.rows.length,0,'NOT IN must expose the UNKNOWN trap when its subquery contains NULL');
  assert.equal(employeesNotExists.rows.length,1,'NOT EXISTS must still find employees with no orders');
  assert.equal(resultMatches(normalize(employeesNotInNullableSet),normalize(employeesNotExists),true),false,'NOT IN with a nullable subquery must not be treated as equivalent to NOT EXISTS');
  const employeesNotInNullSafe = await db.query("SELECT employee_id FROM employees WHERE employee_id NOT IN (SELECT employee_id FROM orders WHERE employee_id IS NOT NULL) ORDER BY employee_id");
  assert.equal(resultMatches(normalize(employeesNotInNullSafe),normalize(employeesNotExists),true),true,'Filtering NULL from the NOT IN subquery must restore equivalence with NOT EXISTS');

  const deliveredOrShipped = await db.query("SELECT order_id FROM orders WHERE status = 'delivered' OR status = 'shipped' ORDER BY order_id");
  const deliveredUnionShipped = await db.query("SELECT order_id FROM orders WHERE status = 'delivered' UNION SELECT order_id FROM orders WHERE status = 'shipped' ORDER BY order_id");
  assert.equal(resultMatches(normalize(deliveredOrShipped),normalize(deliveredUnionShipped),true),true,'OR and UNION must match for disjoint order-level predicates');
  const customerUnion = await db.query("SELECT customer_id FROM orders WHERE status = 'delivered' UNION SELECT customer_id FROM orders WHERE status = 'shipped' ORDER BY customer_id");
  const customerUnionAll = await db.query("SELECT customer_id FROM orders WHERE status = 'delivered' UNION ALL SELECT customer_id FROM orders WHERE status = 'shipped' ORDER BY customer_id");
  assert.equal(resultMatches(normalize(customerUnion),normalize(customerUnionAll),true),false,'UNION and UNION ALL must remain different when customers have multiple matching orders');

  const storeMetricsJoined = await db.query("SELECT s.store_id, COUNT(o.order_id)::int AS order_count, COALESCE(SUM(o.total_amount),0)::numeric AS revenue FROM stores s LEFT JOIN orders o ON o.store_id = s.store_id GROUP BY s.store_id ORDER BY s.store_id");
  const storeMetricsPreAggregated = await db.query("WITH order_metrics AS (SELECT store_id, COUNT(*)::int AS order_count, SUM(total_amount) AS revenue FROM orders GROUP BY store_id) SELECT s.store_id, COALESCE(m.order_count,0)::int AS order_count, COALESCE(m.revenue,0)::numeric AS revenue FROM stores s LEFT JOIN order_metrics m ON m.store_id = s.store_id ORDER BY s.store_id");
  assert.equal(resultMatches(normalize(storeMetricsJoined,true),normalize(storeMetricsPreAggregated,true),true),true,'LEFT JOIN aggregation and pre-aggregation must match at store grain, including stores without orders');
  const correlatedCounts = await db.query("SELECT c.customer_id, (SELECT COUNT(*)::int FROM orders o WHERE o.customer_id = c.customer_id) AS order_count FROM customers c ORDER BY c.customer_id");
  const joinedCounts = await db.query("SELECT c.customer_id, COUNT(o.order_id)::int AS order_count FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.customer_id ORDER BY c.customer_id");
  assert.equal(resultMatches(normalize(correlatedCounts,true),normalize(joinedCounts,true),true),true,'A correlated scalar subquery and LEFT JOIN aggregation must match for customers with and without orders');
  const customersWithoutOrdersExcept = await db.query("SELECT customer_id FROM customers EXCEPT SELECT customer_id FROM orders ORDER BY customer_id");
  const customersWithoutOrdersNotExists = await db.query("SELECT c.customer_id FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id) ORDER BY c.customer_id");
  assert.equal(resultMatches(normalize(customersWithoutOrdersExcept,true),normalize(customersWithoutOrdersNotExists,true),true),true,'EXCEPT and NOT EXISTS must match for a set-valued customer exclusion');
  const customersWithOrdersIntersect = await db.query("SELECT customer_id FROM customers INTERSECT SELECT customer_id FROM orders ORDER BY customer_id");
  const customersWithOrdersExists = await db.query("SELECT DISTINCT c.customer_id FROM customers c WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id) ORDER BY c.customer_id");
  assert.equal(resultMatches(normalize(customersWithOrdersIntersect,true),normalize(customersWithOrdersExists,true),true),true,'INTERSECT and EXISTS with DISTINCT must match for customers with orders');
  const groupedSets = await db.query("SELECT CASE WHEN GROUPING(store_id) = 1 THEN 'all' ELSE 'store' END AS grouping_level, store_id, COUNT(*)::int AS order_count, SUM(total_amount)::numeric AS revenue FROM orders GROUP BY GROUPING SETS ((store_id), ()) ORDER BY grouping_level, store_id NULLS LAST");
  const groupedUnion = await db.query("SELECT 'store'::text AS grouping_level, store_id, COUNT(*)::int AS order_count, SUM(total_amount)::numeric AS revenue FROM orders GROUP BY store_id UNION ALL SELECT 'all'::text AS grouping_level, NULL::bigint AS store_id, COUNT(*)::int AS order_count, SUM(total_amount)::numeric AS revenue FROM orders ORDER BY grouping_level, store_id NULLS LAST");
  assert.equal(resultMatches(normalize(groupedSets,true),normalize(groupedUnion,true),true),true,'GROUPING SETS and an explicit UNION ALL of store totals and grand total must match');
  const runningRows = await db.query("SELECT created_at, order_id, SUM(total_amount) OVER (ORDER BY created_at, order_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total FROM orders ORDER BY created_at, order_id");
  const runningRange = await db.query("SELECT created_at, order_id, SUM(total_amount) OVER (ORDER BY created_at RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total FROM orders ORDER BY created_at, order_id");
  assert.equal(resultMatches(normalize(runningRows,true),normalize(runningRange,true),true),false,'ROWS and RANGE frames must remain distinct when multiple orders share a date');

  const itemRevenue = await db.query("SELECT SUM(unit_price) AS revenue FROM order_items");
  const distinctItemRevenue = await db.query("SELECT SUM(DISTINCT unit_price) AS revenue FROM order_items");
  assert.equal(resultMatches(normalize(itemRevenue),normalize(distinctItemRevenue)),false,'SUM(DISTINCT price) must not be accepted as equivalent to summing every order item');
  const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
  assert.equal(tables.rows.length, schema.length, 'Seed database table count must match the schema catalog');
  assert.equal(schema.filter(table => !['analytics','product'].includes(table.dataset)).length, 9, 'The compact beginner dataset must remain a separate nine-table schema');
  assert.equal(schema.filter(table => table.dataset === 'analytics').length, 4, 'The historical analytics dataset must contain four explicitly grouped tables');
  assert.equal(schema.filter(table => table.dataset === 'product').length, 1, 'Product Analytics must use a separate event table');
  const productEventStats = await db.query(`SELECT COUNT(*)::int AS events,
      COUNT(DISTINCT customer_id)::int AS customers,
      COUNT(DISTINCT session_id)::int AS sessions,
      COUNT(DISTINCT product_id)::int AS products
    FROM product_events`);
  assert.deepEqual(productEventStats.rows[0], { events: productEventStats.rows[0].events, customers: 48, sessions: 576, products: 7 }, 'Product analytics seed must include 48 customers, 576 sessions, and seven products');
  const productStages = await db.query(`SELECT
      COUNT(DISTINCT session_id) FILTER (WHERE event_type='page_view')::int AS page_view,
      COUNT(DISTINCT session_id) FILTER (WHERE event_type='product_view')::int AS product_view,
      COUNT(DISTINCT session_id) FILTER (WHERE event_type='add_to_cart')::int AS add_to_cart,
      COUNT(DISTINCT session_id) FILTER (WHERE event_type='checkout_started')::int AS checkout_started,
      COUNT(DISTINCT session_id) FILTER (WHERE event_type='purchase')::int AS purchase
    FROM product_events`);
  const funnel = productStages.rows[0];
  assert.ok(funnel.page_view >= funnel.product_view && funnel.product_view >= funnel.add_to_cart && funnel.add_to_cart >= funnel.checkout_started && funnel.checkout_started >= funnel.purchase && funnel.purchase > 0, 'Product events must preserve a realistic non-increasing session funnel');
  const sessionSequence = await db.query(`SELECT COUNT(*)::int AS invalid_sessions
    FROM (
      SELECT session_id,
        MIN(event_at) FILTER (WHERE event_type='page_view') AS page_view_at,
        MIN(event_at) FILTER (WHERE event_type='product_view') AS product_view_at,
        MIN(event_at) FILTER (WHERE event_type='add_to_cart') AS add_to_cart_at,
        MIN(event_at) FILTER (WHERE event_type='checkout_started') AS checkout_at,
        MIN(event_at) FILTER (WHERE event_type='purchase') AS purchase_at
      FROM product_events GROUP BY session_id
    ) stages
    WHERE page_view_at IS NULL
       OR (product_view_at IS NOT NULL AND product_view_at < page_view_at)
       OR (add_to_cart_at IS NOT NULL AND (product_view_at IS NULL OR add_to_cart_at < product_view_at))
       OR (checkout_at IS NOT NULL AND (add_to_cart_at IS NULL OR checkout_at < add_to_cart_at))
       OR (purchase_at IS NOT NULL AND (checkout_at IS NULL OR purchase_at < checkout_at))`);
  assert.equal(sessionSequence.rows[0].invalid_sessions,0,'Every product session must preserve the intended event order');
  const starterOrderCount = await db.query("SELECT COUNT(*)::int AS count FROM orders");
  assert.equal(starterOrderCount.rows[0].count, 12, 'The beginner orders fixture must remain unchanged when historical data is added');
  const analyticsCustomers = await db.query("SELECT COUNT(*)::int AS customers FROM analytics_customers");
  assert.equal(analyticsCustomers.rows[0].customers, 48, 'Historical analytics seed must contain 48 deterministic customers');
  const analyticsStats = await db.query(`SELECT COUNT(*)::int AS orders,
    COUNT(DISTINCT customer_id)::int AS purchasing_customers,
    COUNT(DISTINCT DATE_TRUNC('month', created_at))::int AS active_months,
    MIN(created_at)::date::text AS first_order,
    MAX(created_at)::date::text AS last_order,
    COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_orders,
    COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded_orders,
    COUNT(*) FILTER (WHERE refund_amount > 0 AND refund_amount < total_amount)::int AS partial_refunds
    FROM analytics_orders`);
  const analytics = analyticsStats.rows[0];
  assert.ok(analytics.orders >= 700, 'Historical analytics seed must contain enough orders for repeat-purchase analysis');
  assert.equal(analytics.purchasing_customers, 48, 'Every seeded analytics customer must have at least one order');
  assert.equal(analytics.active_months, 36, 'Historical analytics orders must cover all 36 months from 2023 through 2025');
  assert.ok(analytics.first_order.startsWith('2023-01') && analytics.last_order.startsWith('2025-12'), 'Historical analytics orders must span January 2023 through December 2025');
  assert.ok(analytics.cancelled_orders > 0 && analytics.refunded_orders > 0 && analytics.partial_refunds > 0, 'Historical data must include cancelled orders, full refunds and partial refunds');
  const repeatBuyers = await db.query("SELECT COUNT(*)::int AS customers FROM (SELECT customer_id FROM analytics_orders GROUP BY customer_id HAVING COUNT(*) > 1) repeated");
  assert.equal(repeatBuyers.rows[0].customers, 48, 'The historical dataset must support repeat-purchase analysis for every customer');
  const itemConsistency = await db.query(`SELECT COUNT(*) FILTER (WHERE ABS(o.total_amount - COALESCE(i.item_total,0)) > 0.01)::int AS mismatches
    FROM analytics_orders o
    LEFT JOIN (SELECT order_id, SUM(quantity * unit_price) AS item_total FROM analytics_order_items GROUP BY order_id) i USING (order_id)`);
  assert.equal(itemConsistency.rows[0].mismatches, 0, 'Historical order totals must equal their item-level totals before refunds');
  const eventCoverage = await db.query("SELECT COUNT(DISTINCT event_type)::int AS event_types, COUNT(DISTINCT order_id)::int AS orders_with_events FROM analytics_order_events");
  assert.ok(eventCoverage.rows[0].event_types >= 5 && eventCoverage.rows[0].orders_with_events === analytics.orders, 'Every historical order must have a lifecycle event and the event log must include at least five event types');
  const monthlyRevenue = await db.query("SELECT DATE_TRUNC('month', created_at)::date AS month, COUNT(*)::int AS order_count, SUM(total_amount - refund_amount)::numeric AS net_revenue FROM analytics_orders WHERE status IN ('delivered','shipped','refunded') GROUP BY 1 ORDER BY 1");
  assert.equal(monthlyRevenue.rows.length, 36, 'Historical monthly revenue query must return all 36 calendar months');
  const customerCohorts = await db.query("SELECT DATE_TRUNC('month', first_order)::date AS cohort_month, COUNT(*)::int AS cohort_size FROM (SELECT customer_id, MIN(created_at) AS first_order FROM analytics_orders GROUP BY customer_id) cohorts GROUP BY 1 ORDER BY 1");
  assert.ok(customerCohorts.rows.length >= 10, 'Historical customer activity must span enough acquisition cohorts');
  const deliveryDurations = await db.query(`WITH milestones AS (
    SELECT order_id,
      MIN(event_at) FILTER (WHERE event_type = 'created') AS created_at,
      MIN(event_at) FILTER (WHERE event_type = 'shipped') AS shipped_at,
      MIN(event_at) FILTER (WHERE event_type = 'delivered') AS delivered_at
    FROM analytics_order_events GROUP BY order_id
  )
  SELECT COUNT(*)::int AS delivered_orders,
    COUNT(*) FILTER (WHERE created_at < shipped_at AND shipped_at < delivered_at)::int AS ordered_transitions,
    COUNT(DISTINCT EXTRACT(EPOCH FROM shipped_at - created_at))::int AS distinct_ship_delays,
    COUNT(DISTINCT EXTRACT(EPOCH FROM delivered_at - shipped_at))::int AS distinct_delivery_delays,
    ROUND(AVG(EXTRACT(EPOCH FROM shipped_at - created_at) / 3600.0)::numeric,2)::text AS avg_create_to_ship_hours,
    ROUND(AVG(EXTRACT(EPOCH FROM delivered_at - shipped_at) / 3600.0)::numeric,2)::text AS avg_ship_to_delivery_hours,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM delivered_at - created_at) / 3600.0)::numeric(10,2)::text AS median_total_hours,
    percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM delivered_at - created_at) / 3600.0)::numeric(10,2)::text AS p90_total_hours
  FROM milestones
  WHERE created_at IS NOT NULL AND shipped_at IS NOT NULL AND delivered_at IS NOT NULL`);
  const delivery = deliveryDurations.rows[0];
  assert.equal(delivery.delivered_orders, 874, 'Historical lifecycle fixture must contain 874 fully delivered orders');
  assert.equal(delivery.ordered_transitions, delivery.delivered_orders, 'Every delivered order must follow created → shipped → delivered chronology');
  assert.ok(delivery.distinct_ship_delays > 1 && delivery.distinct_delivery_delays > 1, 'Historical stage durations must vary instead of collapsing to a single artificial value');
  assert.equal(delivery.avg_create_to_ship_hours, '47.89', 'Average create-to-ship time must match the deterministic historical fixture');
  assert.equal(delivery.avg_ship_to_delivery_hours, '97.26', 'Average ship-to-delivery time must match the deterministic historical fixture');
  assert.equal(delivery.median_total_hours, '144.00', 'Median total delivery time must match the deterministic historical fixture');
  assert.equal(delivery.p90_total_hours, '192.00', 'P90 total delivery time must match the deterministic historical fixture');

  const projectResults = new Map();
  for (const project of projects) {
    for (const task of project.tasks) {
      const result = await db.query(task.solution);
      assert.ok(result && Array.isArray(result.rows) && Array.isArray(result.fields), `Project task ${task.id} must execute and return a result set`);
      assert.ok(result.fields.length > 0, `Project task ${task.id} must return at least one output column`);
      projectResults.set(task.id, result);
    }
  }

  const repeatBuyerTask = projects.find(project => project.id === 'ecommerce').tasks.find(task => task.id === 'ecommerce-repeat-customers');
  const repeatBuyerRows = projectResults.get(repeatBuyerTask.id).rows;
  const directRepeatBuyerRows = await db.query(`WITH customer_purchases AS (
    SELECT c.acquisition_channel, c.customer_id, COUNT(*)::int AS purchases
    FROM analytics_customers c
    JOIN analytics_orders o USING (customer_id)
    WHERE o.status IN ('delivered','shipped')
    GROUP BY c.acquisition_channel, c.customer_id
  )
  SELECT acquisition_channel,
         COUNT(*)::int AS customers,
         COUNT(*) FILTER (WHERE purchases > 1)::int AS repeat_customers,
         ROUND(100.0 * COUNT(*) FILTER (WHERE purchases > 1) / NULLIF(COUNT(*),0),2)::numeric(6,2) AS repeat_customer_pct
  FROM customer_purchases
  GROUP BY acquisition_channel
  ORDER BY acquisition_channel`);
  assert.deepEqual(repeatBuyerRows, directRepeatBuyerRows.rows, 'E-commerce repeat-purchase metrics must use only customers with qualifying purchases in both numerator and denominator');

  await db.exec('BEGIN;');
  try {
    await db.exec(`INSERT INTO analytics_customers(customer_id,registered_at,city,segment,acquisition_channel)
      VALUES (199999, DATE '2025-12-01', 'Тестовый город', 'test', 'no-orders');`);
    const noBuyerResults = await db.query(repeatBuyerTask.solution);
    const noBuyerChannel = noBuyerResults.rows.find(row => row.acquisition_channel === 'no-orders');
    assert.deepEqual(noBuyerChannel, { acquisition_channel: 'no-orders', customers: 0, repeat_customers: 0, repeat_customer_pct: null }, 'A channel with no qualifying purchases must not count its customer in the buyer denominator');
  } finally {
    await db.exec('ROLLBACK;');
  }

  const deliveryCancellationTask = projects.find(project => project.id === 'delivery').tasks.find(task => task.id === 'delivery-cancellations-by-channel');
  const deliveryCancellationRows = projectResults.get(deliveryCancellationTask.id).rows;
  const directDeliveryCancellationRows = await db.query(`SELECT s.store_name, o.sales_channel,
         COUNT(*)::int AS total_orders,
         COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_orders,
         ROUND(100.0 * COUNT(*) FILTER (WHERE o.status = 'cancelled') / COUNT(*),2)::numeric(6,2) AS cancellation_pct
  FROM analytics_orders o
  JOIN stores s USING (store_id)
  GROUP BY s.store_id, s.store_name, o.sales_channel
  ORDER BY s.store_name, o.sales_channel`);
  assert.deepEqual(deliveryCancellationRows, directDeliveryCancellationRows.rows, 'Delivery cancellations must be comparable by store and sales channel without changing order grain');
  assert.equal(deliveryCancellationRows.reduce((sum,row) => sum + row.total_orders,0), analytics.orders, 'Store/channel cancellation groups must cover every historical order exactly once');
  assert.equal(deliveryCancellationRows.reduce((sum,row) => sum + row.cancelled_orders,0), analytics.cancelled_orders, 'Store/channel cancellation groups must preserve the full cancelled-order count');

  const productFunnelTask = projects.find(project => project.id === 'product').tasks.find(task => task.id === 'product-session-funnel');
  const productFunnelBefore = projectResults.get(productFunnelTask.id).rows[0];
  await db.exec('BEGIN;');
  try {
    await db.exec(`INSERT INTO product_events(event_id,customer_id,session_id,event_type,product_id,event_at) VALUES
      (99999991,1001,9999999,'page_view',1,'2025-12-01 10:00:00'),
      (99999992,1001,9999999,'product_view',1,'2025-12-01 09:59:00'),
      (99999993,1001,9999999,'add_to_cart',1,'2025-12-01 10:01:00'),
      (99999994,1001,9999999,'checkout_started',1,'2025-12-01 10:02:00'),
      (99999995,1001,9999999,'purchase',1,'2025-12-01 10:03:00');`);
    const productFunnelAfter = (await db.query(productFunnelTask.solution)).rows[0];
    assert.equal(productFunnelAfter.sessions, productFunnelBefore.sessions + 1, 'A newly observed malformed session must be included in the total session count');
    assert.equal(productFunnelAfter.page_view_sessions, productFunnelBefore.page_view_sessions + 1, 'The malformed session must still count at its first event');
    for (const field of ['product_view_sessions','cart_sessions','checkout_sessions','purchase_sessions']) {
      assert.equal(productFunnelAfter[field], productFunnelBefore[field], `An out-of-order funnel event must not increase ${field}`);
    }
  } finally {
    await db.exec('ROLLBACK;');
  }

  const employeeSchema = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' ORDER BY ordinal_position");
  assert.ok(employeeSchema.rows.some(row => row.column_name === 'employee_id'), 'The generic public dataset must use employee_id');

  const historicalProductSevenBefore = await db.query("SELECT COUNT(*)::int AS count FROM analytics_order_items WHERE product_id = 7");
  const productEventSevenBefore = await db.query("SELECT COUNT(*)::int AS count FROM product_events WHERE product_id = 7");
  assert.ok(historicalProductSevenBefore.rows[0].count > 0, 'Historical order items must retain product 7 snapshot references');
  assert.ok(productEventSevenBefore.rows[0].count > 0, 'Historical product events must retain product 7 snapshot references');
  await db.exec('BEGIN;');
  try {
    await db.exec("DELETE FROM products WHERE product_id = 7;");
    const historicalProductSevenAfter = await db.query("SELECT COUNT(*)::int AS count FROM analytics_order_items WHERE product_id = 7");
    const productEventSevenAfter = await db.query("SELECT COUNT(*)::int AS count FROM product_events WHERE product_id = 7");
    assert.equal(
      historicalProductSevenAfter.rows[0].count,
      historicalProductSevenBefore.rows[0].count,
      'Deleting a starter catalog product must not remove or block historical order-item facts'
    );
    assert.equal(
      productEventSevenAfter.rows[0].count,
      productEventSevenBefore.rows[0].count,
      'Deleting a starter catalog product must not remove or block historical product event facts'
    );
  } finally {
    await db.exec('ROLLBACK;');
  }

  let checked = 0;
  let randomChecked = 0;
  for (const exercise of exercises) {
    if (exercise.mode === 'mutation') {
      await db.exec('BEGIN;');
      try {
        const executionResult = exercise.id === 'e112' ? await db.query(exercise.solution) : await db.exec(exercise.solution);
        const observed = await db.query(exercise.checkQuery);
        assert.ok(observed.rows.length > 0, `Mutation exercise ${exercise.id} did not produce a checkable state`);
        if (exercise.id === 'e61') {
          assert.deepEqual(observed.rows, [
            { column_name: 'category_id', data_type: 'integer', is_nullable: 'NO', is_primary_key: true },
            { column_name: 'category_name', data_type: 'text', is_nullable: 'NO', is_primary_key: false }
          ], 'Table-creation task must verify both NOT NULL and the primary key');
        } else if (exercise.id === 'e62') {
          assert.deepEqual(observed.rows.map(row => [row.product_id, row.product_name, row.category, Number(row.price)]), [[99, 'Sample item', 'Accessories', 450]], 'INSERT task must verify the exact inserted product');
        } else if (exercise.id === 'e63') {
          assert.deepEqual(observed.rows.map(row => [row.product_id, Number(row.price)]), [[1, 2750]], 'UPDATE task must verify the exact 10% price increase');
        } else if (exercise.id === 'e64') {
          assert.equal(Number(observed.rows[0].remaining_rows), 0, 'DELETE task must verify that the target row is absent');
        } else if (exercise.id === 'e65') {
          assert.deepEqual(observed.rows.map(row => [row.product_id, row.product_name, row.category, Number(row.price)]), [[1, 'Coffee machine', 'Equipment', 2750]], 'UPSERT task must verify the final row values');
        } else if (exercise.id === 'e104') {
          assert.deepEqual(observed.rows.map(row => row.contype).sort(), ['f','n','n','n','p','u'], 'Integrity task must verify primary, unique, foreign-key and three NOT NULL constraints');
        } else if (exercise.id === 'e105') {
          assert.deepEqual(observed.rows.map(row => [row.column_name,row.data_type,row.is_nullable]), [['client_id','integer','NO'],['full_name','text','YES'],['email','text','NO']], 'ALTER TABLE task must verify the final column names and nullability');
        } else if (exercise.id === 'e106') {
          assert.deepEqual(observed.rows, [{ticket_id:1,status:'new'},{ticket_id:2,status:'new'}], 'Identity/default task must verify generated IDs and default values');
        } else if (exercise.id === 'e107') {
          assert.deepEqual(observed.rows.map(row => [Number(row.base_table_count),Number(row.view_count),Number(row.orders_count),Number(row.total_amount)]), [[1,1,2,300]], 'Schema/view task must verify both objects and the view result');
        } else if (exercise.id === 'e108') {
          assert.equal(observed.rows.length,1,'Composite foreign-key task must create one FK');
          assert.ok(observed.rows[0].definition.includes('FOREIGN KEY (tenant_id, order_id)') && observed.rows[0].definition.includes('REFERENCES practice_order_headers(tenant_id, order_id)'), 'Composite FK must reference the matching parent key pair');
        } else if (exercise.id === 'e109') {
          assert.equal(observed.rows.length,1,'Migration task must leave one validated constraint');
          assert.equal(observed.rows[0].convalidated,true,'Migration task must validate historical rows');
          assert.equal(Number(observed.rows[0].invalid_rows),0,'Migration task must leave no NULL or empty source values');
          assert.ok(observed.rows[0].definition.includes('source IS NOT NULL') && observed.rows[0].definition.includes("source <> ''"),'Migration CHECK must reject both NULL and empty values');
        } else if (exercise.id === 'e66') {
          assert.ok(observed.rows.length >= 2, 'Constraint task must create both a primary key and a CHECK constraint');
          assert.ok(observed.rows.some(row => row.definition.includes('PRIMARY KEY')));
          assert.ok(observed.rows.some(row => row.definition.includes('CHECK') && row.definition.includes('>=') && row.definition.includes('<=')), 'CHECK constraint must enforce both range boundaries');
        } else if (exercise.id === 'e67') {
          assert.deepEqual(observed.rows.map(row => [row.product_id, row.product_name, Number(row.price)]), [[1, 'Кофемашина', 2500], [3, 'Чайник', 1500]], 'INSERT ... SELECT task must copy exactly the products in the requested category');
        } else if (exercise.id === 'e110') {
          assert.deepEqual(observed.rows, [{import_id:1,status:'queued',source:'manual'}], 'DEFAULT/RETURNING task must verify the generated ID and default status');
        } else if (exercise.id === 'e111') {
          assert.deepEqual(observed.rows.map(row => [row.product_id,row.product_name,row.category,Number(row.price)]), [[201,'Desk lamp','Home',1200],[202,'Notebook','Office',150]], 'Multi-row INSERT task must verify both inserted products and all values');
        } else if (exercise.id === 'e112') {
          assert.deepEqual(executionResult.rows, [{customer_id:9,customer_name:'Екатерина',city:'Krakow'}], 'UPDATE ... RETURNING must return the exact row and its new values');
          assert.deepEqual(observed.rows, [{customer_id:9,customer_name:'Екатерина',city:'Krakow'}], 'RETURNING task must leave only the selected customer updated');
        } else if (exercise.id === 'e113') {
          assert.deepEqual(observed.rows, [{product_id:1,product_name:'Coffee beans',quantity:12},{product_id:2,product_name:'Tea',quantity:20},{product_id:3,product_name:'Mug',quantity:5}], 'MERGE task must update the matching row, preserve unmatched target rows and insert the new source row');
        } else if (exercise.id === 'e115') {
          assert.deepEqual(observed.rows, [{task_id:201,project_id:2}], 'ON DELETE CASCADE must remove only children of the deleted parent');
        } else if (exercise.id === 'e116') {
          assert.deepEqual(observed.rows, [{row_count:6,total_amount:10740}], 'VIEW task must expose only delivered orders and their exact total');
        } else if (exercise.id === 'e117') {
          assert.deepEqual(observed.rows, [{delivered_revenue:10840}], 'Materialized view task must show refreshed revenue after the source update');
        } else if (exercise.id === 'e118') {
          assert.deepEqual(observed.rows, [{taxed_amount:120}], 'SQL function task must return the correct tax-inclusive amount');
        } else if (exercise.id === 'e119') {
          assert.deepEqual(observed.rows, [{customer_name:'Updated name',timestamp_updated:true}], 'BEFORE UPDATE trigger must replace updated_at before the row is stored');
        } else if (exercise.id === 'e120') {
          assert.deepEqual(observed.rows, [{large_label:'large',regular_label:'regular'}], 'PL/pgSQL IF function must return the correct label in both branches');
        } else if (exercise.id === 'e121') {
          assert.deepEqual(observed.rows, [{row_count:1,retained_name:'Existing'}], 'EXCEPTION block must catch unique_violation without replacing the original row');
        } else if (exercise.id === 'e122') {
          assert.deepEqual(observed.rows, [{definition_ok:true}], 'Composite index must preserve key order and INCLUDE column');
        } else if (exercise.id === 'e123') {
          assert.deepEqual(observed.rows, [{predicate_ok:true}], 'Partial index must preserve the requested WHERE predicate');
        } else if (exercise.id === 'e124') {
          assert.deepEqual(observed.rows, [{stats_count:1}], 'CREATE STATISTICS must register the extended statistics object');
        } else if (exercise.id === 'e126') {
          assert.deepEqual(observed.rows, [{event_id:1,partition_name:'practice_events_2026_01'},{event_id:2,partition_name:'practice_events_2026_02'}], 'Range partitioning must route each event into the matching month partition');
        } else if (exercise.id === 'e127') {
          assert.deepEqual(observed.rows, [{match_count:2,first_id:1,last_id:3,index_count:1}], 'Full-text search must find only matching documents and create the GIN index');
        } else if (exercise.id === 'e129') {
          assert.deepEqual(observed.rows, [{result_count:6,first_order_id:101,last_order_id:111}], 'Parameterized SQL function must return only delivered orders for the supplied value');
        } else if (exercise.id === 'e130') {
          assert.deepEqual(observed.rows, [{delivered_count:2}], 'Dynamic SQL must quote the approved identifier and bind the status value safely');
        } else if (exercise.id === 'e68') {
          assert.equal(observed.rows.length, 1, 'Index task must create the requested index');
          assert.match(observed.rows[0].indexdef, /\(status\)/i, 'Index task must index the status column');
        }
      } finally {
        await db.exec('ROLLBACK;');
      }
    } else if (exercise.mode === 'transaction') {
      const isolated = new PGlite();
      try {
        await isolated.exec(seedSQL);
        for (const pattern of exercise.requiredPatterns || []) {
          assert.ok(new RegExp(pattern, 'i').test(exercise.solution), `Transaction exercise ${exercise.id} is missing a required transaction command`);
        }
        if (exercise.id === 'e69') {
          assert.equal((exercise.solution.match(/\bUPDATE\b/gi) || []).length, 2, 'Money transfer must contain both debit and credit updates');
        } else if (exercise.id === 'e114') {
          assert.ok(exercise.solution.indexOf('INSERT INTO practice_child') < exercise.solution.indexOf('INSERT INTO practice_parent'), 'Deferred foreign-key task must insert the child before its parent');
        }
        await isolated.exec(exercise.solution);
        const observed = await isolated.query(exercise.checkQuery);
        assert.ok(observed.rows.length > 0, `Transaction exercise ${exercise.id} did not produce a checkable state`);
        for (const [column, expectedValue] of Object.entries(exercise.expectedCheck || {})) {
          assert.equal(observed.rows[0][column], expectedValue, `Transaction exercise ${exercise.id} failed final-state assertion: ${column}`);
        }
      } finally {
        await isolated.close();
      }
    } else {
      const result = await db.query(exercise.solution);
      assert.ok(result && Array.isArray(result.rows), `Exercise ${exercise.id} did not return a query result`);
    }
    checked++;
  }

  const e128Task = exercises.find(exercise => exercise.id === 'e128');
  assert.ok(e128Task && e128Task.mode === 'select', 'Schema-inspection task must be a read-only SELECT');
  const e128Result = await db.query(e128Task.solution);
  assert.deepEqual(e128Result.rows.map(row => [row.column_name, row.data_type]), [['order_id','bigint'],['store_id','bigint'],['employee_id','bigint'],['customer_id','bigint'],['status','text'],['total_amount','numeric'],['created_at','date']], 'information_schema task must return the real orders column names and types in ordinal order');

  // Analytical exercises must return the intended metrics, not merely execute.
  const runSelectExercise = async id => {
    const task = exercises.find(item => item.id === id);
    assert.ok(task && task.mode === 'select', `Analytical exercise ${id} must exist as a SELECT task`);
    return db.query(task.solution);
  };

  const e89Result = await runSelectExercise('e89');
  const e89Oracle = await db.query(`
    WITH store_revenue AS (
      SELECT s.store_id, s.store_name, s.city,
             (SELECT SUM(o.total_amount) FROM orders o WHERE o.store_id = s.store_id) AS revenue
      FROM stores s
      WHERE EXISTS (SELECT 1 FROM orders o WHERE o.store_id = s.store_id)
    )
    SELECT store_name, city, revenue,
           ROUND(100.0 * revenue / NULLIF((
             SELECT SUM(o.total_amount)
             FROM stores city_store
             JOIN orders o ON o.store_id = city_store.store_id
             WHERE city_store.city = store_revenue.city
           ), 0), 2) AS city_share_pct,
           ROUND(100.0 * revenue / NULLIF((SELECT SUM(total_amount) FROM orders), 0), 2) AS total_share_pct
    FROM store_revenue
    ORDER BY city, store_name
  `);
  assert.deepEqual(e89Result.rows, e89Oracle.rows, 'e89 city and global revenue shares must match independent correlated totals');

  const e90Result = await runSelectExercise('e90');
  assert.deepEqual(
    e90Result.rows.map(row => [
      (row.month_start instanceof Date ? row.month_start.toISOString().slice(0, 10) : String(row.month_start).slice(0, 10)),
      Number(row.revenue),
      row.previous_revenue === null ? null : Number(row.previous_revenue),
      row.growth_pct === null ? null : Number(row.growth_pct)
    ]),
    [
      ['2026-01-01', 1000, null, null],
      ['2026-02-01', 1250, 1000, 25],
      ['2026-03-01', 1000, 1250, -20]
    ],
    'e90 must compare each month with the preceding month and leave the first comparison undefined'
  );

  const e92Result = await runSelectExercise('e92');
  assert.deepEqual(
    e92Result.rows.map(row => [row.stage, Number(row.users_count)]),
    [['view', 4], ['cart_after_view', 2], ['purchase_after_cart', 1]],
    'e92 must reject missing and out-of-order funnel events'
  );

  const e96Result = await runSelectExercise('e96');
  assert.deepEqual(
    e96Result.rows.map(row => [row.month, row.net_revenue, row.previous_month_revenue, row.mom_change_pct]),
    [
      ['2025-10-01', '136440.00', '139720.00', '-2.35'],
      ['2025-11-01', '123040.00', '136440.00', '-9.82'],
      ['2025-12-01', '125300.00', '123040.00', '1.84']
    ],
    'e96 must calculate Q4 net revenue with calendar-correct month comparisons'
  );

  await db.exec('BEGIN;');
  try {
    const removedNovemberFacts = await db.query(`
      UPDATE analytics_orders
      SET status = 'new'
      WHERE created_at >= TIMESTAMP '2025-11-01'
        AND created_at < TIMESTAMP '2025-12-01'
        AND status IN ('delivered', 'shipped', 'refunded')
      RETURNING order_id
    `);
    assert.ok(removedNovemberFacts.rows.length > 0, 'The e96 gap regression must remove all qualifying November revenue from the fixture');
    const gapRows = (await runSelectExercise('e96')).rows;
    const october = gapRows.find(row => row.month === '2025-10-01');
    const november = gapRows.find(row => row.month === '2025-11-01');
    const december = gapRows.find(row => row.month === '2025-12-01');
    assert.ok(october && november && december, 'e96 calendar must retain every reporting month when November has no qualifying orders');
    assert.equal(Number(november.net_revenue), 0, 'An empty qualifying month must be represented by zero net revenue');
    assert.equal(Number(november.previous_month_revenue), Number(october.net_revenue), 'November must compare with October');
    assert.equal(Number(november.mom_change_pct), -100, 'A month falling from positive revenue to zero must show -100%');
    assert.equal(Number(december.previous_month_revenue), 0, 'December must compare with zero-filled November, not skip back to October');
    assert.equal(december.mom_change_pct, null, 'MoM change from a zero previous-month denominator must remain NULL');
  } finally {
    await db.exec('ROLLBACK;');
  }

  const e97Result = await runSelectExercise('e97');
  const e97Oracle = await db.query(`
    WITH first_created AS (
      SELECT order_id, MIN(event_at) AS created_at
      FROM order_events
      WHERE event_type = 'created'
      GROUP BY order_id
    )
    SELECT 'created' AS stage, COUNT(*)::int AS orders_count
    FROM first_created
    UNION ALL
    SELECT 'shipped_after_created', COUNT(*)::int
    FROM first_created c
    WHERE EXISTS (
      SELECT 1 FROM order_events shipped
      WHERE shipped.order_id = c.order_id
        AND shipped.event_type = 'shipped'
        AND shipped.event_at > c.created_at
    )
    UNION ALL
    SELECT 'delivered_after_shipped', COUNT(*)::int
    FROM first_created c
    WHERE EXISTS (
      SELECT 1
      FROM order_events shipped
      JOIN order_events delivered
        ON delivered.order_id = shipped.order_id
       AND delivered.event_type = 'delivered'
       AND delivered.event_at > shipped.event_at
      WHERE shipped.order_id = c.order_id
        AND shipped.event_type = 'shipped'
        AND shipped.event_at > c.created_at
    )
  `);
  assert.deepEqual(e97Result.rows, e97Oracle.rows, 'e97 ordered funnel counts must match an independent EXISTS-based oracle');

  const e98Result = await runSelectExercise('e98');
  const e98Oracle = await db.query(`
    WITH metrics AS (
      SELECT s.store_id, s.store_name,
             (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.store_id) AS all_orders,
             (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.store_id AND o.status = 'delivered') AS delivered_orders
      FROM stores s
    )
    SELECT store_id, store_name, all_orders, delivered_orders,
           ROUND(100.0 * delivered_orders / NULLIF(all_orders, 0), 2) AS delivered_pct
    FROM metrics
    ORDER BY delivered_pct DESC NULLS LAST, store_id
  `);
  assert.deepEqual(e98Result.rows, e98Oracle.rows, 'e98 must preserve stores without orders and calculate delivery conversion correctly');

  const e99Result = await runSelectExercise('e99');
  const e99Oracle = await db.query(`
    WITH customer_city AS (
      SELECT s.city, c.customer_id, c.customer_name,
             COUNT(*) AS orders_count, SUM(o.total_amount) AS revenue
      FROM orders o
      JOIN customers c ON c.customer_id = o.customer_id
      JOIN stores s ON s.store_id = o.store_id
      WHERE o.status <> 'cancelled'
      GROUP BY s.city, c.customer_id, c.customer_name
    ),
    ranked AS (
      SELECT current_row.*,
             (SELECT SUM(other_row.revenue)
              FROM customer_city other_row
              WHERE other_row.city = current_row.city) AS city_revenue,
             1 + (SELECT COUNT(*)
                  FROM customer_city other_row
                  WHERE other_row.city = current_row.city
                    AND (
                      other_row.revenue > current_row.revenue
                      OR (
                        other_row.revenue = current_row.revenue
                        AND other_row.customer_id < current_row.customer_id
                      )
                    )) AS position
      FROM customer_city current_row
    )
    SELECT city, customer_name, orders_count, revenue,
           ROUND(100.0 * revenue / NULLIF(city_revenue, 0), 2) AS city_share_pct
    FROM ranked
    WHERE position <= 2
    ORDER BY city, position
  `);
  assert.deepEqual(e99Result.rows, e99Oracle.rows, 'e99 top-two customers and city shares must match independent correlated ranking');

  await db.exec("INSERT INTO orders VALUES (113, 1, NULL, 1, 'new', 0, '2026-01-16');");
  const fanOutWithEmptyOrder = await db.query(fanOutExercise.solution);
  assert.equal(fanOutWithEmptyOrder.rows.length, 13, 'Fan-out solution must retain an order with no item lines and no events');
  const emptyDetailOrder = fanOutWithEmptyOrder.rows.find(row => Number(row.order_id) === 113);
  assert.ok(emptyDetailOrder, 'Order without either detail source must remain in the result');
  assert.deepEqual([Number(emptyDetailOrder.items_amount), Number(emptyDetailOrder.events_count)], [0, 0], 'Missing item and event details must be represented as zero metrics');

  await db.exec('CREATE TEMP TABLE practice_categories (category_id INTEGER NOT NULL, category_name TEXT NOT NULL);');
  const invalidPrimaryKeyResult = await db.query(exercises.find(exercise => exercise.id === 'e61').checkQuery);
  assert.ok(invalidPrimaryKeyResult.rows.every(row => !row.is_primary_key), 'A table without PRIMARY KEY must fail the e61 structural check');
  await db.exec('DROP TABLE practice_categories;');
  const lessonExampleDb = new PGlite();
  try {
    await lessonExampleDb.exec(seedSQL);
    let runnableExamples = 0;
    for (const module of modules) {
      for (const lesson of module.lessons) {
        const example = lesson.example || '';
        if (!example.trim() || /pg_stat_statements|does_not_exist|\$\d+|^\s*psql\b|CREATE\s+(OR\s+REPLACE\s+)?(TEMP(ORARY)?\s+)?TABLE|CREATE\s+(OR\s+REPLACE\s+)?VIEW|CREATE\s+(OR\s+REPLACE\s+)?FUNCTION|CREATE\s+TRIGGER/i.test(example)) continue;
        const statements = sqlLexer.splitStatements(example);
        if (!statements.length || statements.some(statement => !['SELECT','WITH','EXPLAIN'].includes(sqlLexer.firstSqlKeyword(statement)))) continue;
        for (const statement of statements) {
          const keyword = sqlLexer.firstSqlKeyword(statement);
          if (keyword === 'EXPLAIN') continue;
          assert.equal(sqlLexer.readOnlyQueryKeyword(statement), 'SELECT', `Lesson example ${module.id}/${lesson.title} must be read-only`);
          const result = await lessonExampleDb.query(statement);
          assert.ok(result && Array.isArray(result.rows), `Lesson example ${module.id}/${lesson.title} must execute`);
        }
        runnableExamples++;
      }
    }
    const expectedExamples = modules.flatMap(module=>module.lessons.map(lesson=>({module,lesson}))).filter(item=>item.lesson.exampleResult);
    assert.ok(expectedExamples.length >= 14, 'Key lessons must show expected query results');
    assert.ok(appSource.includes('lesson?.tipTokens')&&!appSource.includes('${renderExampleBreakdown(l.example,l)}'), 'Lesson highlighting must use explicit topic tokens and avoid repetitive generic line explanations');
    for (const {module,lesson} of expectedExamples) {
      const statements = sqlLexer.splitStatements(lesson.example || '');
      assert.equal(statements.length,1, `Expected-result example ${module.id}/${lesson.title} must contain exactly one SQL statement`);
      const result = await lessonExampleDb.query(statements[0]);
      const expected = lesson.exampleResult;
      assert.deepEqual(result.rows.map(row=>expected.columns.map(column=>row[column])), expected.rows, `Expected result mismatch in ${module.id}/${lesson.title}`);
    }
    console.log(`Verified ${expectedExamples.length} lesson example result tables.`);
    assert.ok(runnableExamples >= 90, `Expected at least 90 executable lesson examples, got ${runnableExamples}`);
    console.log(`Executed ${runnableExamples} read-only lesson examples against the teaching schema.`);
  } finally {
    await lessonExampleDb.close();
  }
  for (const topic of sandboxTaskTopics) {
    for (const item of topic.tasks) {
      assert.equal(sqlLexer.readOnlyQueryKeyword(item.solution), 'SELECT', `Random task ${item.id} must be a read-only SELECT/CTE`);
      const result = await db.query(item.solution);
      assert.ok(result && Array.isArray(result.rows), `Random task ${item.id} did not execute`);
      randomChecked++;
    }
  }
  let projectTasksChecked = 0;
  for (const project of projects) {
    for (const task of project.tasks) {
      assert.equal(sqlLexer.readOnlyQueryKeyword(task.solution), 'SELECT', `Project task ${task.id} must be a read-only SELECT/CTE`);
      const result = await db.query(task.solution);
      assert.ok(result && Array.isArray(result.rows) && result.fields?.length > 0, `Project task ${task.id} must execute and return a tabular result`);
      assert.ok(result.rows.length > 0, `Project task ${task.id} must return data from the project dataset`);
      assert.ok(projectOracles[task.id], `Project task ${task.id} must have an independent result oracle`);
      const expected = await db.query(projectOracles[task.id]);
      assert.equal(resultMatches(normalize(result), normalize(expected), true), true, `Project task ${task.id} must match its independent analytical oracle`);
      projectTasksChecked++;
    }
  }
  assert.equal(projectTasksChecked, projectTaskCount, 'All nine analytical project tasks must execute against the seeded analytics datasets');
  console.log(`Executed ${projectTasksChecked} SQL solutions from the three analytical projects.`);
  console.log(`SQL Academy smoke test passed: ${modules.length} modules, ${modules.reduce((sum, module) => sum + module.lessons.length, 0)} lessons, ${quizQuestions.length} knowledge checks, ${glossary.length} glossary terms, ${reference.length} reference groups, ${checked} runnable exercises, ${randomChecked} random sandbox tasks, ${tables.rows.length} seed tables.`);
} finally {
  await db.close();
}

assert.ok((await readFile(new URL('../app.js', import.meta.url), 'utf8')).includes("PGlite.create({dataDir:'memory://'})"), 'Browser playground must initialize an explicit in-memory PGlite database');
assert.ok(!/(?<!\$)\$\('[^']+'\)\.forEach\s*\(/.test(appSource), 'All DOM collection iterations must use querySelectorAll helper');
assert.ok(appSource.includes("$$('[data-random-topic]').forEach("), 'Random topic checkboxes must be selected as a collection');

class BackupTestStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const backupSource = new BackupTestStorage();
backupSource.setItem('sql-academy-progress-v1', JSON.stringify({
  lessons: ['foundations.relational-model'], exercises: ['e1'],
  quizAnswers: { 'foundations.relational-model:0': 1 }, exerciseQuizAnswers: { e1: 0 },
  assessmentResults: { foundations: { attempts: 2, bestScore: 4, passed: true } }
}));
backupSource.setItem('sql-academy-editor-v1', 'SELECT 1;');
backupSource.setItem('sql-academy-project-progress-v1', JSON.stringify(['ecommerce-monthly-net-revenue']));
backupSource.setItem('sql-academy-project-drafts-v1', JSON.stringify({ 'ecommerce-monthly-net-revenue': 'SELECT 2;' }));
backupSource.setItem('sql-academy-project-notes-v1', JSON.stringify({ ecommerce: 'Revenue grew.' }));
backupSource.setItem('sql-academy-project-reviews-v1', JSON.stringify({ ecommerce: 1 }));
backupSource.setItem('sql-academy-theme', 'light');
const learningBackup = createBackup(backupSource, '2026-11-08T20:00:00.000Z');
assert.equal(learningBackup.format, BACKUP_FORMAT);
assert.equal(learningBackup.version, BACKUP_VERSION);
assert.deepEqual(Object.keys(learningBackup.storage), [...BACKUP_STORAGE_KEYS]);
assert.deepEqual(parseBackup(JSON.stringify(learningBackup)), learningBackup);
const backupTarget = new BackupTestStorage();
backupTarget.setItem('sql-academy-editor-v1', 'SELECT 999;');
restoreBackup(backupTarget, learningBackup);
for (const key of BACKUP_STORAGE_KEYS) assert.equal(backupTarget.getItem(key), backupSource.getItem(key), 'Backup must restore ' + key);
const emptyBackup = parseBackup(createBackup(new BackupTestStorage()));
assert.ok(BACKUP_STORAGE_KEYS.every(key => emptyBackup.storage[key] === null), 'An empty browser profile must also be exportable');
assert.throws(() => parseBackup('{broken'), /корректный JSON/);
assert.throws(() => parseBackup({ ...learningBackup, format: 'other' }), /не резервная копия/i);
assert.throws(() => parseBackup({ ...learningBackup, version: 99 }), /не поддерживается/);
assert.throws(() => parseBackup({ ...learningBackup, storage: { ...learningBackup.storage, unknown: 'value' } }), /неизвестные разделы/);
assert.throws(() => parseBackup({ ...learningBackup, storage: { ...learningBackup.storage, 'sql-academy-theme': 'neon' } }), /тема оформления/);
assert.throws(() => parseBackup({ ...learningBackup, storage: { ...learningBackup.storage, 'sql-academy-project-progress-v1': '{bad' } }), /повреждённые данные/i);
assert.throws(() => parseBackup({ ...learningBackup, storage: { ...learningBackup.storage, 'sql-academy-project-notes-v1': JSON.stringify({ ecommerce: 42 }) } }), /объектом строк/);
class BackupFailingStorage extends BackupTestStorage {
  failOnce = true;
  setItem(key, value) {
    if (this.failOnce && key === 'sql-academy-project-drafts-v1') { this.failOnce = false; throw new Error('simulated quota failure'); }
    super.setItem(key, value);
  }
}
const failingTarget = new BackupFailingStorage();
failingTarget.failOnce = false;
for (const key of BACKUP_STORAGE_KEYS) {
  const value = backupSource.getItem(key);
  if (value !== null) failingTarget.setItem(key, 'old:' + value);
}
failingTarget.failOnce = true;
const beforeRollback = Object.fromEntries(BACKUP_STORAGE_KEYS.map(key => [key, failingTarget.getItem(key)]));
assert.throws(() => restoreBackup(failingTarget, learningBackup), /прежние данные сохранены/i);
assert.deepEqual(
  Object.fromEntries(BACKUP_STORAGE_KEYS.map(key => [key, failingTarget.getItem(key)])),
  beforeRollback,
  'A failed restore must roll back the original local data'
);
console.log('Progress backup checks passed: export, version and schema validation, restore, empty state and rollback.');
