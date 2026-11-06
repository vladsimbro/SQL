import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { modules, exercises, schema, seedSQL } from '../curriculum.js';

const ids = new Set(modules.map(module => module.id));
assert.equal(modules.length, 24, 'Expected 24 ordered modules');
assert.ok(modules.every(module => module.lessons.length > 0), 'Every module must have lessons');
assert.ok(modules.every(module => module.lessons.every(lesson => lesson.title && lesson.body && lesson.example && lesson.note)), 'Every lesson must contain title, theory, example and note');
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
  console.log(`SQL Academy smoke test passed: ${modules.length} modules, ${modules.reduce((sum, module) => sum + module.lessons.length, 0)} lessons, ${checked} runnable exercises, ${tables.rows.length} seed tables.`);
} finally {
  await db.close();
}
