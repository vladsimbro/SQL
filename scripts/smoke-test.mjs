import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { modules, learningTracks, exercises, schema, seedSQL, glossary, reference } from '../curriculum.js';
import { sandboxTaskTopics, sandboxTaskCount } from '../sandbox-tasks.js';

const curriculumSource = await readFile(new URL('../curriculum.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const sqlUtilsSource = await readFile(new URL('../sql-utils.js', import.meta.url), 'utf8');
const htmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const cssSource = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const buildVersion = JSON.parse(await readFile(new URL('../version.json', import.meta.url), 'utf8')).build;
const importedAssetVersions = [...appSource.matchAll(/from\s+['"]\.\/[^'"]+\.js\?v=([^'"]+)['"]/g)].map(match => match[1]);
assert.equal(importedAssetVersions.length, 3, 'Application must import all three local modules with cache versions');
assert.ok(importedAssetVersions.every(version => version === buildVersion), 'Local JavaScript imports must use the current release build to avoid stale cached curriculum and SQL utilities');
assert.ok(curriculumSource.includes('export const exercises = ['), 'Practice exercises must be exported as a named dataset');
assert.ok(curriculumSource.includes('export const learningTracks = [') && curriculumSource.includes('export const exercises = ['), 'Learning routes and practice arrays must be exported separately');
assert.ok(Array.isArray(glossary) && glossary.length >= 30, 'Glossary must contain at least 30 usable terms');
assert.ok(Array.isArray(reference) && reference.length >= 8, 'SQL quick reference must contain usable topic groups');
assert.ok(exercises.every(exercise => ['select','explain','mutation','transaction'].includes(exercise.mode)), 'Every exercise must have a supported explicit mode');
assert.equal(exercises.filter(exercise => exercise.mode === 'select').length, 88, 'Expected 88 SELECT exercises');
assert.equal(exercises.filter(exercise => exercise.mode === 'explain').length, 3, 'Expected three EXPLAIN exercises');
assert.equal(exercises.filter(exercise => exercise.mode === 'mutation').length, 8, 'Expected eight mutation exercises');
assert.equal(exercises.filter(exercise => exercise.mode === 'transaction').length, 3, 'Expected three transaction exercises');
assert.equal(exercises.length, 102, 'Expected 102 total practice exercises');
assert.equal(exercises.filter(exercise => exercise.mode === 'mutation').length, 8, 'Expected eight mutation exercises');
assert.equal(exercises.filter(exercise => exercise.mode === 'transaction').length, 3, 'Expected three transaction exercises');
assert.ok(exercises.every(exercise => modules.some(module => module.id === exercise.m)), 'Every exercise must belong to a real module');
assert.ok(appSource.includes("from './sql-utils.js?v="), 'Application must use the shared SQL parser module');
const sqlLexer = new Function(sqlUtilsSource.replaceAll('export function ', 'function ') + '; return { firstSqlKeyword, sqlAfterKeyword, explainStatementKeyword, readOnlyQueryKeyword, splitStatements };')();
assert.equal(sqlLexer.firstSqlKeyword("-- leading comment\nSELECT 1"), 'SELECT', 'Leading line comments must be ignored');
assert.equal(sqlLexer.firstSqlKeyword('/* outer /* nested */ comment */ WITH q AS (SELECT 1) SELECT * FROM q'), 'WITH', 'Nested block comments must be ignored');
assert.equal(sqlLexer.firstSqlKeyword(sqlLexer.sqlAfterKeyword('EXPLAIN /* comment */ SELECT 1', 'EXPLAIN')), 'SELECT', 'Comments after EXPLAIN must be ignored');
assert.equal(sqlLexer.explainStatementKeyword('EXPLAIN ANALYZE SELECT 1'), 'SELECT', 'EXPLAIN ANALYZE must be accepted');
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
assert.equal(exercises.filter(exercise => exercise.orderMatters).length, 17, 'Expected 17 ordering-sensitive tasks');
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
assert.equal(walkthroughLessons.length, 40, 'Only substantive, hand-authored worked scenarios should remain');
assert.ok(walkthroughLessons.every(lesson => lesson.walkthrough.title && lesson.walkthrough.scenario && lesson.walkthrough.steps?.length >= 3 && lesson.walkthrough.result && lesson.walkthrough.pitfall), 'Every retained worked scenario must include context, reasoning, result and pitfall');
assert.ok(modules.every(module => module.lessons.every(lesson => !lesson.walkthrough || !lesson.walkthrough.scenario.startsWith('Представь, что ты решаешь рабочую задачу'))), 'Generic template walkthroughs must not be shown');
const explanationStart = appSource.indexOf('function lessonFocusTokens');
const explanationEnd = appSource.indexOf('function renderWorkedExample', explanationStart);
const explanationCode = appSource.slice(explanationStart, explanationEnd);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const explanationApi = new Function('esc','sqlTokenTips', explanationCode + '; return { lessonFocusTokens, renderAnnotatedSql, renderExampleBreakdown };')(escapeHtml, {
  JOIN:'Joins tables.', LEFT:'Keeps all rows from the left side.', ON:'Defines the join condition.',
  SELECT:'Selects output columns.', FROM:'Defines the source.', WHERE:'Filters rows.'
});
const joinLesson = { title: 'INNER JOIN и LEFT JOIN', simple: 'Соединение таблиц по ключам.' };
const joinHtml = explanationApi.renderAnnotatedSql("SELECT o.id FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = 7 -- note", joinLesson);
assert.ok(joinHtml.includes('data-tip=') && joinHtml.includes('>LEFT</span>') && joinHtml.includes('>JOIN</span>') && joinHtml.includes('>ON</span>'), 'JOIN topic should highlight only relevant join syntax');
assert.ok(!joinHtml.includes('>SELECT</span>') && !joinHtml.includes('>FROM</span>') && !joinHtml.includes('>orders</span>') && !joinHtml.includes('>7</span>') && !joinHtml.includes('>note</span>'), 'Unrelated clauses, identifiers, numbers and comments must not be highlighted');
const neutralHtml = explanationApi.renderAnnotatedSql("SELECT 'COUNT(*)' AS label, 12 FROM orders -- comment", { title: 'Клиент и сервер' });
assert.ok(!neutralHtml.includes('data-tip='), 'Unrelated lessons must not highlight generic SQL tokens or literals');
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
const normalizeStart = appSource.indexOf('function normalizeResult');
const normalizeEnd = appSource.indexOf('\nasync function runEditorQuery', normalizeStart);
const normalize = new Function(appSource.slice(normalizeStart, normalizeEnd) + '; return normalizeResult;')();
const orderedA = { rows: [{id:1},{id:2}], fields: [{name:'id'}] };
const orderedB = { rows: [{id:2},{id:1}], fields: [{name:'id'}] };
assert.deepEqual(normalize(orderedA), normalize(orderedB), 'Unordered tasks must ignore row order');
assert.notDeepEqual(normalize(orderedA, true), normalize(orderedB, true), 'Ordering-sensitive tasks must compare row order');
assert.equal(modules.length, 25, 'Expected 25 ordered modules');
assert.ok(modules.every(module => module.lessons.length > 0), 'Every module must have lessons');
assert.ok(modules.every(module => module.lessons.every(lesson => lesson.title && lesson.body && lesson.example && lesson.note)), 'Every lesson must contain title, theory, example and note');
assert.ok(modules.every(module => module.lessons.every(lesson => lesson.simple === undefined || typeof lesson.simple === 'string')), 'Optional plain-language summaries must be valid when present');
assert.ok(modules.every(module => module.lessons.every(lesson => !lesson.walkthrough || (lesson.walkthrough.title && lesson.walkthrough.scenario && lesson.walkthrough.steps?.length >= 3 && lesson.walkthrough.result && lesson.walkthrough.pitfall))), 'Every retained worked scenario must be complete');
assert.equal(new Set(walkthroughLessons.map(lesson => lesson.walkthrough.title)).size, 40, 'Retained worked-scenario titles must be unique');
assert.ok(modules.every(module => module.lessons.every(lesson => Array.isArray(lesson.outcomes) && lesson.outcomes.length >= 2)), 'Every lesson must have lesson-specific outcomes');
assert.ok(modules.filter(module => ['foundations','relational','types','anatomy','ddl','inserts','select','where','sorting','expressions','aggregates','joins','subqueries','cte','setops','dml','constraints','windows','views','analytics','performance','advanced','security','workflow'].includes(module.id)).every(module => module.lessons.every(lesson => lesson.body.split(/\n\s*\n/).filter(Boolean).length >= 2)), 'Rewritten lesson explanations must be divided into readable paragraphs');
assert.ok(modules.filter(module => ['foundations','relational','types','anatomy','ddl','inserts','select','where','sorting','expressions','aggregates','joins','subqueries','cte','setops','dml','constraints','windows','views'].includes(module.id)).every(module => module.lessons.every(lesson => lesson.quiz.every(q => q.options.length === 4 && new Set(q.options).size === 4))), 'Rewritten lesson quiz options must be distinct and substantive');
assert.ok(modules.every(module => module.lessons.every(lesson => lesson.quiz.every(q => q.explanation && q.question && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length))), 'Every lesson quiz must have a valid answer and explanation');

const ddlModule = modules.find(module => module.id === 'ddl');
assert.ok(ddlModule.lessons.some(lesson => lesson.title === 'CHECK: проверка бизнес-правил' && lesson.body.includes('TRUE или NULL')), 'DDL must explain CHECK and UNKNOWN semantics');
assert.ok(ddlModule.lessons.some(lesson => lesson.title === 'Составные ограничения и составные внешние ключи'), 'DDL must explain composite constraints');
assert.ok(ddlModule.lessons.some(lesson => lesson.title === 'PostgreSQL: ограничения и блокировки при миграциях' && lesson.body.includes('NOT VALID') && lesson.body.includes('VALIDATE CONSTRAINT')), 'DDL must explain PostgreSQL-specific constraint validation and migration locks');
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
assert.deepEqual(analyticsModule.lessons.find(lesson => lesson.title === 'Качество данных и проверки').exampleResult.rows, [[19,12,7]], 'Join-grain check must expose row multiplication from order items');
assert.ok(analyticsModule.lessons.find(lesson => lesson.title === 'Медиана и перцентили').example.includes('event_times') && !analyticsModule.lessons.find(lesson => lesson.title === 'Медиана и перцентили').example.includes('JOIN order_events delivered'), 'Delivery percentile calculation must pre-aggregate event types to one row per order');
assert.deepEqual(analyticsModule.lessons.find(lesson => lesson.title === 'Медиана и перцентили').exampleResult.rows, [[300,444]], 'Delivery percentiles must be computed once per order');

assert.equal(analyticsModule.lessons.length, 13, 'Analytics module must include period comparisons, conversion and combined-query workflow');
assert.deepEqual(analyticsModule.lessons.find(lesson => lesson.title === 'Когортный анализ').exampleResult.rows, [['2026-01-01',3],['2026-02-01',2]], 'Cohort example must show separate cohort sizes across months');
assert.deepEqual(analyticsModule.lessons.find(lesson => lesson.title === 'Retention: когортное удержание').exampleResult.rows, [['2026-01-01',0,3,3,'100.00'],['2026-01-01',1,3,2,'66.67'],['2026-01-01',2,3,2,'66.67'],['2026-02-01',0,2,2,'100.00'],['2026-02-01',1,2,1,'50.00']], 'Retention example must compare active users against the fixed original cohort size');

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
const dmlQualityModule = modules.find(module => module.id === 'dml');
assert.ok(dmlQualityModule.lessons.find(lesson => lesson.title === 'UPDATE').example.includes('WHERE product_id = 1'), 'UPDATE example must target a specific existing product');
assert.ok(dmlQualityModule.lessons.find(lesson => lesson.title === 'DELETE и TRUNCATE').example.includes("DATE '2026-01-13'"), 'DELETE example must target a matching cancelled order in the teaching data');
const ddlQualityModule = modules.find(module => module.id === 'ddl');
assert.ok(ddlQualityModule.lessons.find(lesson => lesson.title === 'PostgreSQL: ограничения и блокировки при миграциях').example.includes('VALIDATE CONSTRAINT'), 'Migration lesson must demonstrate deferred constraint validation');
const transactionQualityModule = modules.find(module => module.id === 'constraints');
assert.ok(transactionQualityModule.lessons.find(lesson => lesson.title === 'ACID').example.includes('ON COMMIT DROP'), 'ACID example must clean up its temporary teaching table');
assert.ok(transactionQualityModule.lessons.find(lesson => lesson.title === 'SAVEPOINT и частичный откат').example.includes('ROLLBACK TO SAVEPOINT'), 'Savepoint example must demonstrate a partial rollback');
const aggregateModule = modules.find(module => module.id === 'aggregates');
assert.deepEqual(aggregateModule.lessons.find(lesson => lesson.title === 'DISTINCT внутри агрегатов').exampleResult.rows, [[3,4000,3000]], 'SUM(DISTINCT amount) must demonstrate lost revenue when two orders share an amount');
assert.ok(aggregateModule.lessons.find(lesson => lesson.title === 'DISTINCT внутри агрегатов').body.includes('дедуплицируй по order_id'), 'Aggregate DISTINCT lesson must direct entity deduplication to the business key');

assert.ok(aggregateModule.lessons.find(lesson => lesson.title === 'Агрегатные функции').body.includes('COUNT(DISTINCT employee_id)'), 'Aggregate lesson must distinguish row, non-null and distinct-value counts');
assert.ok(aggregateModule.lessons.find(lesson => lesson.title === 'GROUP BY и зерно результата').body.includes('COUNT(o.order_id)'), 'GROUP BY lesson must explain COUNT(*) versus COUNT(right_key) after LEFT JOIN');
assert.ok(aggregateModule.lessons.find(lesson => lesson.title === 'Условная агрегация и FILTER').body.includes('только для того агрегата'), 'FILTER lesson must explain its local scope');
assert.ok(aggregateModule.lessons.find(lesson => lesson.title === 'Предварительная агрегация до нужного зерна').body.includes('одну строку на order_id'), 'Pre-aggregation lesson must define the target grain');
const joinsModule = modules.find(module => module.id === 'joins');
assert.ok(joinsModule.lessons.find(lesson => lesson.title === 'Кардинальность и размножение строк').body.includes('UNIQUE или PRIMARY KEY'), 'Join cardinality lesson must distinguish foreign keys from uniqueness');
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
assert.ok(quizQuestions.every(question => question.question && question.options?.length === 4 && Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4 && question.explanation), 'Every quiz question must have four options, a valid answer and an explanation');
assert.ok(appSource.includes("editor('','exercise-editor'"), 'Practice editor must start empty');
assert.ok(appSource.includes('navigationScrollReset') && appSource.includes('sidebarScroll'), 'Lesson navigation must preserve scroll position');
assert.ok(appSource.includes('renderExerciseQuiz') && appSource.includes('data-exercise-quiz-answer'), 'Every practical exercise must render an interactive knowledge check');
assert.ok(appSource.includes('document.addEventListener(\'click\',event=>'), 'Navigation must use a single delegated click handler');
assert.ok(htmlSource.includes('codemirror/5.65.16'), 'The web app must load the SQL editor');
assert.equal(new Set(exercises.map(exercise => exercise.id)).size, exercises.length, 'Exercise IDs must be unique');
assert.ok(exercises.every(exercise => ids.has(exercise.m)), 'Every exercise must reference an existing module');
assert.ok(exercises.every(exercise => exercise.solution && exercise.task && exercise.hint?.trim()), 'Every exercise must have a task, unique hint and reference solution');
assert.equal(new Set(exercises.map(exercise => exercise.hint)).size, exercises.length, 'Every practical exercise must have a unique task-specific hint');
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
assert.ok(appSource.includes('legacyIds.get(value)')&&appSource.includes('quizKey('),'Progress migration must convert legacy positional lesson and quiz keys');
assert.ok(appSource.includes('data-track=')&&appSource.includes('state.roadmapTrack'),'Roadmap must allow switching between core and optional routes');
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
  const query = exercise.solution.replace(/^EXPLAIN\s+/i, '');
  assert.ok(exercise.requiredPatterns.every(pattern => new RegExp(pattern, 'i').test(query)), `Reference query for ${id} must satisfy every required pattern`);
  assert.ok(exercise.requiredPatterns.some(pattern => !new RegExp(pattern, 'i').test('SELECT 1')), `EXPLAIN exercise ${id} must reject an unrelated query`);
}
assert.ok(appSource.includes('ex.requiredPatterns'), 'EXPLAIN exercises must validate task-specific query requirements');

const db = new PGlite();
try {
  await db.exec(seedSQL);
  const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
  assert.equal(tables.rows.length, schema.length, 'Seed database table count must match the schema catalog');

  const employeeSchema = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' ORDER BY ordinal_position");
  assert.ok(employeeSchema.rows.some(row => row.column_name === 'employee_id'), 'The generic public dataset must use employee_id');


  let checked = 0;
  let randomChecked = 0;
  for (const exercise of exercises) {
    if (exercise.mode === 'mutation') {
      await db.exec('BEGIN;');
      try {
        await db.exec(exercise.solution);
        const observed = await db.query(exercise.checkQuery);
        assert.ok(observed.rows.length > 0, `Mutation exercise ${exercise.id} did not produce a checkable state`);
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
  console.log(`SQL Academy smoke test passed: ${modules.length} modules, ${modules.reduce((sum, module) => sum + module.lessons.length, 0)} lessons, ${quizQuestions.length} knowledge checks, ${glossary.length} glossary terms, ${reference.length} reference groups, ${checked} runnable exercises, ${randomChecked} random sandbox tasks, ${tables.rows.length} seed tables.`);
} finally {
  await db.close();
}

assert.ok((await readFile(new URL('../app.js', import.meta.url), 'utf8')).includes("PGlite.create({dataDir:'memory://'})"), 'Browser playground must initialize an explicit in-memory PGlite database');
assert.ok(!/(?<!\$)\$\('[^']+'\)\.forEach\s*\(/.test(appSource), 'All DOM collection iterations must use querySelectorAll helper');
assert.ok(appSource.includes("$('[data-random-topic]').forEach("), 'Random topic checkboxes must be selected as a collection');
