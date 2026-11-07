import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { modules, exercises, schema, seedSQL, glossary, reference } from '../curriculum.js';
import { sandboxTaskTopics, sandboxTaskCount } from '../sandbox-tasks.js';

const curriculumSource = await readFile(new URL('../curriculum.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const sqlUtilsSource = await readFile(new URL('../sql-utils.js', import.meta.url), 'utf8');
const htmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const cssSource = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
assert.ok(curriculumSource.includes('export const exercises = ['), 'Practice exercises must be exported as a named dataset');
assert.ok(curriculumSource.includes('];\n\nexport const exercises = ['), 'Module and practice arrays must be closed as separate declarations');
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
assert.ok(appSource.includes('function renderAnnotatedSql') && appSource.includes('function renderExampleBreakdown'), 'Lesson examples must include SQL hover explanations and line-by-line breakdowns');
const walkthroughLessons = modules.flatMap(module => module.lessons.filter(lesson => lesson.walkthrough));
assert.equal(walkthroughLessons.length, 173, 'Every lesson must have a complete worked scenario');
assert.ok(walkthroughLessons.every(lesson => lesson.walkthrough.title && lesson.walkthrough.scenario && lesson.walkthrough.steps?.length >= 3 && lesson.walkthrough.result && lesson.walkthrough.pitfall), 'Every worked scenario must include context, ordered reasoning, result and common pitfall');
assert.ok(appSource.includes('function renderWorkedExample') && appSource.includes('renderWorkedExample(l.walkthrough)'), 'Worked lesson scenarios must be rendered in the lesson page');
assert.ok(cssSource.includes('.worked-example') && cssSource.includes('.worked-steps'), 'Worked scenarios must have dedicated responsive styling');

assert.ok(cssSource.includes('.sql-tooltip') && cssSource.includes('.breakdown-list'), 'SQL hover explanations and walkthroughs must have dedicated styles');
assert.equal(modules.find(module => module.id === 'performance').lessons.length, 16, 'Optimization stage must contain sixteen focused lessons');
assert.ok(appSource.includes('meta[name="theme-color"]'), 'Theme toggle must update browser theme color');
assert.ok(htmlSource.includes('data-nav="reference"') && htmlSource.includes('data-nav="glossary"'), 'Reference and glossary navigation buttons must exist');
assert.ok(cssSource.includes(':root.light .CodeMirror') && cssSource.includes(':root.light .reference-card') && cssSource.includes(':root.light .glossary-item'), 'Light theme must style the editor, reference and glossary');

const ids = new Set(modules.map(module => module.id));
assert.equal(modules.reduce((sum, module) => sum + module.lessons.length, 0), 173, 'Expected 173 lessons');
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
assert.ok(modules.every(module => module.lessons.every(lesson => lesson.simple)), 'Every lesson must include a plain-language explanation');
assert.ok(modules.every(module => module.lessons.every(lesson => lesson.walkthrough && lesson.walkthrough.title && lesson.walkthrough.scenario && lesson.walkthrough.steps?.length >= 4 && lesson.walkthrough.result && lesson.walkthrough.pitfall)), 'Every lesson must include a complete, lesson-specific worked scenario with at least four reasoning steps');
assert.ok(new Set(modules.flatMap(module => module.lessons.map(lesson => lesson.walkthrough.title))).size === 173, 'Every lesson must have its own worked-scenario title');
assert.ok(modules.every(module => module.lessons.every(lesson => Array.isArray(lesson.outcomes) && lesson.outcomes.length >= 2)), 'Every lesson must have lesson-specific outcomes');
assert.ok(modules.filter(module => ['foundations','relational','types','anatomy','ddl','inserts','select','where','sorting','expressions','aggregates','joins','subqueries','cte','setops','dml','constraints','windows','views','analytics','performance','advanced','security','workflow'].includes(module.id)).every(module => module.lessons.every(lesson => lesson.body.split(/\n\s*\n/).filter(Boolean).length >= 2)), 'Rewritten lesson explanations must be divided into readable paragraphs');
assert.ok(modules.filter(module => ['foundations','relational','types','anatomy','ddl','inserts','select','where','sorting','expressions','aggregates','joins','subqueries','cte','setops','dml','constraints','windows','views'].includes(module.id)).every(module => module.lessons.every(lesson => lesson.quiz.every(q => q.options.length === 4 && new Set(q.options).size === 4))), 'Rewritten lesson quiz options must be distinct and substantive');
assert.ok(modules.every(module => module.lessons.every(lesson => lesson.quiz.every(q => q.explanation && q.question && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length))), 'Every lesson quiz must have a valid answer and explanation');

const ddlModule = modules.find(module => module.id === 'ddl');
assert.ok(ddlModule.lessons.some(lesson => lesson.title === 'CHECK: проверка бизнес-правил' && lesson.body.includes('TRUE или NULL')), 'DDL must explain CHECK and UNKNOWN semantics');
assert.ok(ddlModule.lessons.some(lesson => lesson.title === 'Составные ограничения и составные внешние ключи'), 'DDL must explain composite constraints');
assert.ok(ddlModule.lessons.some(lesson => lesson.title === 'Безопасное изменение схемы и миграции' && lesson.body.includes('NOT VALID')), 'DDL must explain safe schema migrations');
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
assert.ok(appSource.includes("curriculum.js?v=20261107-34") && appSource.includes("sql-utils.js?v=20261107-34") && appSource.includes("sandbox-tasks.js?v=20261107-34"), 'Application module dependencies must use the current cache version');


const windowModule = modules.find(module => module.id === 'windows');
assert.equal(windowModule.lessons.length, 10, 'Window-function module must include advanced value, distribution and filtering lessons');
assert.deepEqual(windowModule.lessons.flatMap(lesson => lesson.practiceIds || []).sort(), ['e35','e36','e39','e37','e38','e80','e81','e82','e91','e93','e94','e95','e100'].sort(), 'Window-function lessons must link all thirteen dedicated practice tasks exactly once');
const analyticsModule = modules.find(module => module.id === 'analytics');
assert.equal(analyticsModule.lessons.length, 13, 'Analytics module must include period comparisons, conversion and combined-query workflow');
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
assert.ok(typesModule.lessons.find(lesson => lesson.title === 'Дата, время и часовые пояса').body.includes('без явного смещения'), 'Timestamp lesson must explain session timezone interpretation');
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
assert.deepEqual(modules.map(module => module.stage.split(' · ')[0]), Array.from({length:25},(_,i)=>String(i+1).padStart(2,'0')), 'Roadmap stages must be consecutive and match module order');
assert.ok(modules.findIndex(module => module.id === 'select') < modules.findIndex(module => module.id === 'ddl'), 'Read-query fundamentals must be taught before schema modification');
assert.ok(modules.findIndex(module => module.id === 'analytics') === modules.findIndex(module => module.id === 'windows') + 1, 'Professional analytics must follow window functions directly');

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
