import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { modules, exercises, schema, seedSQL, glossary, reference } from '../curriculum.js';

const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const htmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const cssSource = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
assert.ok(Array.isArray(glossary) && glossary.length >= 30, 'Glossary must contain at least 30 usable terms');
assert.ok(Array.isArray(reference) && reference.length >= 8, 'SQL quick reference must contain usable topic groups');
assert.ok(exercises.every(exercise => ['select','explain','mutation','transaction'].includes(exercise.mode)), 'Every exercise must have a supported explicit mode');
assert.equal(exercises.filter(exercise => exercise.mode === 'select').length, 59, 'Expected 59 SELECT exercises');
assert.equal(exercises.filter(exercise => exercise.mode === 'explain').length, 1, 'Expected one EXPLAIN exercise');
const parserStart = appSource.indexOf('function skipSqlTrivia');
const parserEnd = appSource.indexOf('\nasync function runEditorQuery', parserStart);
assert.ok(parserStart >= 0 && parserEnd > parserStart, 'SQL lexer functions must exist');
const sqlLexer = new Function(appSource.slice(parserStart, parserEnd) + '; return { firstSqlKeyword, sqlAfterKeyword, explainStatementKeyword, splitStatements };')();
assert.equal(sqlLexer.firstSqlKeyword("-- leading comment\nSELECT 1"), 'SELECT', 'Leading line comments must be ignored');
assert.equal(sqlLexer.firstSqlKeyword('/* outer /* nested */ comment */ WITH q AS (SELECT 1) SELECT * FROM q'), 'WITH', 'Nested block comments must be ignored');
assert.equal(sqlLexer.firstSqlKeyword(sqlLexer.sqlAfterKeyword('EXPLAIN /* comment */ SELECT 1', 'EXPLAIN')), 'SELECT', 'Comments after EXPLAIN must be ignored');
assert.equal(sqlLexer.explainStatementKeyword('EXPLAIN ANALYZE SELECT 1'), 'SELECT', 'EXPLAIN ANALYZE must be accepted');
assert.equal(sqlLexer.explainStatementKeyword('EXPLAIN (ANALYZE, BUFFERS) SELECT 1'), 'SELECT', 'EXPLAIN options must be accepted');
assert.equal(sqlLexer.explainStatementKeyword('EXPLAIN (FORMAT JSON) WITH q AS (SELECT 1) SELECT * FROM q'), 'WITH', 'EXPLAIN FORMAT JSON with CTE must be accepted');
assert.equal(sqlLexer.splitStatements("SELECT ';'; SELECT 2;").length, 2, 'Semicolons inside string literals must not split statements');
assert.deepEqual(sqlLexer.splitStatements(String.raw`SELECT E'it\'s; still text'; SELECT 2;`).map(sqlLexer.firstSqlKeyword), ['SELECT','SELECT'], 'Escaped E-string quotes must not split statements');
assert.equal(exercises.filter(exercise => exercise.orderMatters).length, 11, 'Ordering-sensitive tasks must compare row order');
assert.equal(sqlLexer.splitStatements('DO $body$ BEGIN PERFORM 1; PERFORM 2; END $body$; SELECT 3;').length, 2, 'Dollar-quoted procedural blocks must remain a single statement');
assert.ok(appSource.includes("if(ex.mode==='explain')"), 'EXPLAIN mode must be handled separately from normal SELECT exercises');
assert.ok(appSource.includes('firstSqlKeyword(parts[0])'), 'Exercise validation must use the SQL lexer');
assert.ok(appSource.includes('preserveOrder=false'), 'Result normalization must support order-sensitive exercises');
assert.ok(appSource.includes('meta[name="theme-color"]'), 'Theme toggle must update browser theme color');
assert.ok(htmlSource.includes('data-nav="reference"') && htmlSource.includes('data-nav="glossary"'), 'Reference and glossary navigation buttons must exist');
assert.ok(cssSource.includes(':root.light .CodeMirror'), 'Light theme must style the SQL editor');

const ids = new Set(modules.map(module => module.id));
assert.equal(modules.reduce((sum, module) => sum + module.lessons.length, 0), 148, 'Expected 148 lessons');
assert.equal(glossary.length, 72, 'Expected 72 glossary terms');
assert.equal(reference.length, 13, 'Expected 13 reference groups');
const normalizeStart = appSource.indexOf('function normalizeResult');
const normalizeEnd = appSource.indexOf('function skipSqlTrivia', normalizeStart);
const normalize = new Function(appSource.slice(normalizeStart, normalizeEnd) + '; return normalizeResult;')();
const orderedA = { rows: [{id:1},{id:2}], fields: [{name:'id'}] };
const orderedB = { rows: [{id:2},{id:1}], fields: [{name:'id'}] };
assert.deepEqual(normalize(orderedA), normalize(orderedB), 'Unordered tasks must ignore row order');
assert.notDeepEqual(normalize(orderedA, true), normalize(orderedB, true), 'Ordering-sensitive tasks must compare row order');
assert.equal(modules.length, 24, 'Expected 24 ordered modules');
assert.ok(modules.every(module => module.lessons.length > 0), 'Every module must have lessons');
assert.ok(modules.every(module => module.lessons.every(lesson => lesson.title && lesson.body && lesson.example && lesson.note)), 'Every lesson must contain title, theory, example and note');
assert.ok(modules.every(module => module.lessons.every(lesson => lesson.simple)), 'Every lesson must include a plain-language explanation');
assert.ok(modules.every(module => module.sources?.length), 'Every module must link to official documentation');
assert.ok(modules.every(module => module.quiz?.length >= 4), 'Every module must include a question bank');
const quizQuestions = modules.flatMap(module => module.quiz);
assert.equal(quizQuestions.length, 96, 'Expected 96 knowledge-check questions');
assert.ok(quizQuestions.every(question => question.question && question.options?.length === 4 && Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4 && question.explanation), 'Every quiz question must have four options, a valid answer and an explanation');
assert.ok(appSource.includes("editor('','exercise-editor'"), 'Practice editor must start empty');
assert.ok(appSource.includes('navigationScrollReset') && appSource.includes('sidebarScroll'), 'Lesson navigation must preserve scroll position');
assert.ok(appSource.includes('renderExerciseQuiz') && appSource.includes('data-exercise-quiz-answer'), 'Every practical exercise must render an interactive knowledge check');
assert.ok(appSource.includes('document.addEventListener(\'click\',event=>'), 'Navigation must use a single delegated click handler');
assert.ok(htmlSource.includes('codemirror/5.65.16'), 'The web app must load the SQL editor');
assert.equal(new Set(exercises.map(exercise => exercise.id)).size, exercises.length, 'Exercise IDs must be unique');
assert.ok(exercises.every(exercise => ids.has(exercise.m)), 'Every exercise must reference an existing module');
assert.ok(exercises.every(exercise => exercise.solution && exercise.task), 'Every exercise must have a task and reference solution');

const db = new PGlite();
try {
  await db.exec(seedSQL);
  const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
  assert.equal(tables.rows.length, schema.length, 'Seed database table count must match the schema catalog');

  const employeeSchema = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' ORDER BY ordinal_position");
  assert.ok(employeeSchema.rows.some(row => row.column_name === 'employee_id'), 'The generic public dataset must use employee_id');


  let checked = 0;
  for (const exercise of exercises) {
    if (exercise.mode === 'mutation') {
      await db.exec('BEGIN;');
      try {
        await db.query(exercise.solution);
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
  console.log(`SQL Academy smoke test passed: ${modules.length} modules, ${modules.reduce((sum, module) => sum + module.lessons.length, 0)} lessons, ${quizQuestions.length} knowledge checks, ${glossary.length} glossary terms, ${reference.length} reference groups, ${checked} runnable exercises, ${tables.rows.length} seed tables.`);
} finally {
  await db.close();
}
