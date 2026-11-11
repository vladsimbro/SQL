import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { modules, seedSQL } from '../curriculum.js';
import { cumulativeCheckpoints, checkpointTaskIds } from '../checkpoints.js';
import { migrateProgress } from '../progress-utils.js';

assert.equal(cumulativeCheckpoints.length, 3, 'The first release must contain three cumulative checkpoints');
assert.equal(checkpointTaskIds.length, 6, 'Each checkpoint in the first release must contain two independent SQL tasks');
assert.equal(new Set(checkpointTaskIds).size, checkpointTaskIds.length, 'Checkpoint task IDs must be unique');
for (const checkpoint of cumulativeCheckpoints) {
  assert.equal(checkpoint.track, 'core');
  assert.ok(modules.some(module => module.id === checkpoint.afterModule && module.track === checkpoint.track), checkpoint.id + ' requires a real module');
  assert.equal(checkpoint.tasks.length, 2, checkpoint.id + ' must have two tasks');
  assert.ok(checkpoint.skills.length >= 3);
  for (const task of checkpoint.tasks) {
    assert.ok(task.title && task.prompt && task.solution);
    assert.match(task.solution, /^(SELECT|WITH)\b/i, task.id + ' must use read-only SQL');
    assert.doesNotMatch(task.prompt, /\b(используй|примени)\s+(?:JOIN|WHERE|GROUP BY|HAVING|ROW_NUMBER|CTE)\b/i, task.id + ' should not prescribe a technique');
  }
}
const prior=migrateProgress({lessons:[],exercises:[],checkpointTasks:['core-foundation-orders','core-foundation-orders',7],checkpointDrafts:{'core-foundation-orders':'SELECT 1',bad:2}},modules);
assert.deepEqual(prior.progress.checkpointTasks,['core-foundation-orders']);
assert.deepEqual(prior.progress.checkpointDrafts,{'core-foundation-orders':'SELECT 1'});
assert.equal(migrateProgress(prior.progress,modules).changed,false,'Migrated checkpoint state must be stable');

const db=await PGlite.create({dataDir:'memory://'});
try {
  await db.exec(seedSQL);
  for (const checkpoint of cumulativeCheckpoints) {
    for (const task of checkpoint.tasks) {
      const result=await db.query(task.solution);
      assert.ok(result.fields.length>=2, task.id + ' must return a real report with multiple columns');
      assert.ok(result.rows.length>=1, task.id + ' must not be a vacuous empty result');
      assert.equal(new Set(result.fields.map(column=>column.name)).size,result.fields.length,task.id + ' must use unique column names');
    }
  }
  const stores=await db.query(cumulativeCheckpoints[2].tasks[0].solution);
  assert.equal(stores.rows.length,5,'Store count control must include the store without orders');
  assert.ok(stores.rows.some(row=>row.store_name==='Запасной' && Number(row.delivered_orders)===0),'Unmatched stores must appear with zero deliveries');
  const wrong=await db.query("SELECT order_id, created_at, total_amount FROM orders WHERE status = 'shipped' ORDER BY total_amount DESC, order_id LIMIT 5");
  const correct=await db.query(cumulativeCheckpoints[0].tasks[0].solution);
  assert.notDeepEqual(wrong.rows,correct.rows,'A plausible wrong filter must produce a different result');
  console.log('Cumulative checkpoint verification passed: 3 checkpoints, 6 runnable SQL solutions, progress migration, and unmatched LEFT JOIN rows.');
} finally {
  await db.close();
}
