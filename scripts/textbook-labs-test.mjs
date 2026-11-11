import assert from 'node:assert/strict';
import { modules } from '../curriculum.js';
import { workshopPromptsByModule, getWorkshopPrompt } from '../lesson-workshops.js';
import { lessonInsightsByModule, getLessonInsight } from '../lesson-insights.js';
import { migrateProgress } from '../progress-utils.js';

assert.equal(modules.length,25,'The platform must retain all 25 existing modules');
assert.equal(modules.flatMap(m=>m.lessons).length,173,'The new textbook must cover all 173 existing lessons');
assert.deepEqual(Object.keys(workshopPromptsByModule).sort(),modules.map(m=>m.id).sort(),'Every module must have workshop content');
const prompts=[];
const insights=[];
for(const module of modules){
  const activities=workshopPromptsByModule[module.id];
  assert.ok(Array.isArray(activities)&&activities.length===module.lessons.length,module.id+' must have exactly one activity per lesson');
  assert.equal(lessonInsightsByModule[module.id]?.length,module.lessons.length,module.id+' needs one unique deep-dive per lesson');
  for(let i=0;i<module.lessons.length;i++){
    const prompt=getWorkshopPrompt(module.id,i);
    assert.ok(typeof prompt==='string' && prompt.length>=60,module.id+' lesson '+i+' needs a specific reasoning task');
    assert.ok(/\?$|[.?!]$/.test(prompt),module.id+' lesson '+i+' must use a complete question or instruction');
    prompts.push(prompt);
    const insight=getLessonInsight(module.id,i);
    assert.ok(typeof insight==='string'&&insight.length>140,module.id+' lesson '+i+' needs substantive explanation');
    insights.push(insight);
  }
}
assert.equal(new Set(prompts).size,173,'All workshop prompts must be unique');
assert.equal(new Set(insights).size,173,'All added theoretical deep-dives must be individually authored');
const first=modules[0].lessons[0];
assert.match(first.example,/^SELECT\b/,'The first lesson must allow a working SELECT experiment');
const migrated=migrateProgress({
  lessons:[first.id],exercises:[],lessonLabDrafts:{[first.id]:'SELECT 42 AS answer;','old-lesson':'SELECT 1'},lessonLabNotes:{[first.id]:'Данные становятся результатом запроса.'}
},modules);
assert.deepEqual(migrated.progress.lessonLabDrafts,{[first.id]:'SELECT 42 AS answer;'},'Known saved SQL must survive migration and unknown IDs must be discarded');
assert.deepEqual(migrated.progress.lessonLabNotes,{[first.id]:'Данные становятся результатом запроса.'},'Lesson notes must survive migration');
assert.equal(migrateProgress(migrated.progress,modules).changed,false,'Stable lesson workshop progress must remain unchanged after migration');
console.log('Textbook workshop checks passed: 173 individual exercises in 25 modules, stable IDs, early SQL, safe progress migration.');
