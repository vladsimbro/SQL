import { modules, learningTracks, exercises, glossary, reference, schema, seedSQL } from './curriculum.js?v=20261110-128';
import { sandboxTaskTopics, sandboxTaskCount } from './sandbox-tasks.js?v=20261110-128';
import { firstSqlKeyword, explainStatementKeyword, explainStatementBody, splitStatements, readOnlyQueryKeyword } from './sql-utils.js?v=20261110-128';
import { migrateProgress, getTrackProgress, findNextLesson } from './progress-utils.js?v=20261110-128';
import { projects, projectTaskCount } from './projects.js?v=20261110-128';
import { createBackup, parseBackup, restoreBackup } from './backup-utils.js?v=20261110-128';
import { buildQuizOptionOrders, quizOptionKey } from './quiz-options.js?v=20261110-128';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const quizOptionOrders = buildQuizOptionOrders(modules);
const STORE_KEY = 'sql-academy-progress-v1';
const EDITOR_KEY = 'sql-academy-editor-v1';
const PROJECT_PROGRESS_KEY = 'sql-academy-project-progress-v1';
const PROJECT_DRAFTS_KEY = 'sql-academy-project-drafts-v1';
const PROJECT_NOTES_KEY = 'sql-academy-project-notes-v1';
const PROJECT_REVIEWS_KEY = 'sql-academy-project-reviews-v1';
const PGLITE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.15/dist/index.js';
let pgliteImportAttempt = 0;
let pgliteModulePromise = null;
const loadPGliteModule = () => {
  if (!pgliteModulePromise) {
    const attempt = ++pgliteImportAttempt;
    pgliteModulePromise = import(`${PGLITE_MODULE_URL}?sql-academy-attempt=${attempt}`).catch(error => {
      pgliteModulePromise = null;
      throw error;
    });
  }
  return pgliteModulePromise;
};
const state = {
  view:'dashboard', moduleId:modules[0].id, lessonIndex:0, exerciseId:exercises[0].id, roadmapTrack:'core',
  completedLessons:new Set(), completedExercises:new Set(), practiceTrack:'core',
  projectId:'ecommerce', projectTaskId:'ecommerce-monthly-net-revenue', completedProjectTasks:new Set(), projectDrafts:{}, projectNotes:{}, projectReviews:{}, projectSolutionVisible:false,
  db:null, expected:new Map(), randomTask:null, randomTopics:new Set(sandboxTaskTopics.map(topic=>topic.id)),
  engineReady:false, engineLoading:false, engineError:null, currentRows:[], quizAnswers:{}, exerciseQuizAnswers:{}, assessmentTrack:'core', assessmentModuleId:null, assessmentAnswers:{}, assessmentSubmitted:false, assessmentResults:{}, editors:new Map(), navigationScrollReset:false, theme:localStorage.getItem('sql-academy-theme') || 'dark'
};
const moduleById = id => modules.find(m=>m.id===id);
const lessonKey = (mid,idx)=>moduleById(mid)?.lessons[idx]?.id || mid+':'+idx;
const quizKey = (mid,idx,questionIndex)=>lessonKey(mid,idx)+':'+questionIndex;
const moduleLessons = trackId => modules.filter(module=>module.track===trackId);
const esc = value => String(value ?? 'NULL').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
const label = {dashboard:'Главная',courses:'Курсы',roadmap:'Программа курса',study:'Учебник',practice:'Практика',projects:'Проекты',project:'Проект',playground:'SQL-песочница',schema:'Учебная база',reference:'Шпаргалка',glossary:'Глоссарий',assessment:'Контрольные работы'};
const loadProgress = () => {
  try {
    const saved=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
    const migrated=migrateProgress(saved,modules);
    const progress=migrated.progress;
    state.completedLessons=new Set(progress.lessons);
    state.completedExercises=new Set(progress.exercises);
    state.quizAnswers=progress.quizAnswers;
    state.exerciseQuizAnswers=progress.exerciseQuizAnswers;
    state.assessmentResults=progress.assessmentResults;
    if(migrated.changed)localStorage.setItem(STORE_KEY,JSON.stringify(progress));
  } catch (error) {
    console.warn('Could not restore SQL Academy progress:',error);
  }
};
const saveProgress = () => {
  localStorage.setItem(STORE_KEY,JSON.stringify({lessons:[...state.completedLessons],exercises:[...state.completedExercises],quizAnswers:state.quizAnswers,exerciseQuizAnswers:state.exerciseQuizAnswers,assessmentResults:state.assessmentResults}));
  updateProgress();
};
const loadProjectState = () => {
  try {
    state.completedProjectTasks = new Set(JSON.parse(localStorage.getItem(PROJECT_PROGRESS_KEY)||'[]'));
    state.projectDrafts = JSON.parse(localStorage.getItem(PROJECT_DRAFTS_KEY)||'{}');
    state.projectNotes = JSON.parse(localStorage.getItem(PROJECT_NOTES_KEY)||'{}');
    state.projectReviews = JSON.parse(localStorage.getItem(PROJECT_REVIEWS_KEY)||'{}');
  } catch (error) {
    console.warn('Could not restore project progress:',error);
    state.completedProjectTasks = new Set();
    state.projectDrafts = {};
  }
};
const saveProjectProgress = () => localStorage.setItem(PROJECT_PROGRESS_KEY,JSON.stringify([...state.completedProjectTasks]));
const saveProjectDraft = (taskId,value) => {
  state.projectDrafts[taskId]=value;
  localStorage.setItem(PROJECT_DRAFTS_KEY,JSON.stringify(state.projectDrafts));
};
const saveProjectNote = (projectId,value) => {
  state.projectNotes[projectId]=value;
  localStorage.setItem(PROJECT_NOTES_KEY,JSON.stringify(state.projectNotes));
};
const saveProjectReview = (projectId,choice) => {
  state.projectReviews[projectId]=choice;
  localStorage.setItem(PROJECT_REVIEWS_KEY,JSON.stringify(state.projectReviews));
};
const updateProgress = () => {
  const activeTrackId=state.view==='study'?(moduleById(state.moduleId)?.track||'core'):state.view==='roadmap'?state.roadmapTrack:state.view==='practice'?state.practiceTrack:state.view==='assessment'?state.assessmentTrack:'core';
  const activeTrack=learningTracks.find(track=>track.id===activeTrackId)||learningTracks[0];
  const {completed,total,percent}=getTrackProgress(modules,state.completedLessons,activeTrackId);
  $('#side-progress-label').textContent=percent+'%';
  $('#side-progress-bar').style.width=percent+'%';
  $('#side-progress-detail').textContent=completed+' из '+total+' уроков · '+activeTrack.title;
  $('#exercise-count').textContent=exercises.length;
  const projectCount=$('#project-count');if(projectCount)projectCount.textContent=projectTaskCount;
};
const toast = message => {
  const el=document.createElement('div'); el.className='toast'; el.textContent=message; document.body.append(el); setTimeout(()=>el.remove(),2200);
};
const setMobileMenuOpen = (open, { restoreFocus = false } = {}) => {
  const sidebar=$('#sidebar'),button=$('#mobile-menu');
  if(!sidebar||!button)return;
  const expanded=Boolean(open)&&window.innerWidth<760;
  sidebar.classList.toggle('open',expanded);
  button.setAttribute('aria-expanded',String(expanded));
  button.setAttribute('aria-label',expanded?'Закрыть меню':'Открыть меню');
  if(expanded)sidebar.querySelector('[data-nav]')?.focus({preventScroll:true});
  else if(restoreFocus)button.focus({preventScroll:true});
};
const routeUrl = () => {
  const params=new URLSearchParams();
  params.set('view',state.view);
  if(state.view==='roadmap')params.set('track',state.roadmapTrack);
  if(state.view==='study'){
    params.set('module',state.moduleId);
    const lesson=moduleById(state.moduleId)?.lessons?.[state.lessonIndex];
    if(lesson?.id)params.set('lesson',lesson.id);
  }
  if(state.view==='practice'){
    params.set('track',state.practiceTrack);
    if(state.exerciseId)params.set('exercise',state.exerciseId);
  }
  if(state.view==='assessment'){
    params.set('track',state.assessmentTrack);
    if(state.assessmentModuleId)params.set('module',state.assessmentModuleId);
  }
  if(state.view==='project'){
    params.set('project',state.projectId);
    if(state.projectTaskId)params.set('task',state.projectTaskId);
  }
  return location.pathname+location.search+'#'+params.toString();
};
const applyRoute = () => {
  const params=new URLSearchParams(location.hash.slice(1));
  if(!params.has('view'))return false;
  const view=params.get('view');
  const allowed=['dashboard','courses','roadmap','study','practice','projects','project','assessment','playground','schema','reference','glossary'];
  if(!allowed.includes(view)){state.view='dashboard';return false;}
  state.view=view;
  if(view==='roadmap'){
    const track=learningTracks.find(item=>item.id===params.get('track'));
    if(track)state.roadmapTrack=track.id;
  }
  if(view==='study'){
    const module=moduleById(params.get('module'));
    if(!module){state.view='courses';return false;}
    state.moduleId=module.id;
    const lessonId=params.get('lesson');
    const lessonIndex=lessonId?module.lessons.findIndex(item=>item.id===lessonId):0;
    if(lessonIndex<0){state.view='roadmap';state.roadmapTrack=module.track||'core';return false;}
    state.lessonIndex=lessonIndex;
    state.roadmapTrack=module.track||'core';
  }
  if(view==='practice'){
    const track=learningTracks.find(item=>item.id===params.get('track'));
    if(track)state.practiceTrack=track.id;
    const exercise=exercises.find(item=>item.id===params.get('exercise'));
    if(exercise){state.exerciseId=exercise.id;state.practiceTrack=moduleById(exercise.m)?.track||state.practiceTrack;}
  }
  if(view==='assessment'){
    const track=learningTracks.find(item=>item.id===params.get('track'));
    if(track)state.assessmentTrack=track.id;
    const module=moduleById(params.get('module'));
    state.assessmentModuleId=module?.track===state.assessmentTrack?module.id:null;
  }
  if(view==='project'){
    const project=projects.find(item=>item.id===params.get('project'));
    if(!project){state.view='projects';return false;}
    state.projectId=project.id;
    state.projectTaskId=project.tasks.some(item=>item.id===params.get('task'))?params.get('task'):project.tasks[0].id;
  }
  return true;
};
const syncRoute = (replace=true) => {
  const url=routeUrl();
  if(location.pathname+location.search+location.hash===url)return;
  history[replace?'replaceState':'pushState']({sqlAcademy:true},'',url);
};
const go = view => {
  state.navigationScrollReset=true;
  state.view=view;
  syncRoute(false);
  render();
  if(innerWidth<760)setMobileMenuOpen(false,{restoreFocus:true});
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({top:0,behavior:reducedMotion?'instant':'smooth'});
};
const progressForModule = m => m.lessons.filter((_,i)=>state.completedLessons.has(lessonKey(m.id,i))).length;
const modulePct = m => Math.round(progressForModule(m)/m.lessons.length*100);
const getModuleForExercise = ex => moduleById(ex.m);

function render() {
  syncRoute(true);
  const host=$('#app-content'),preserveScroll=!state.navigationScrollReset,windowY=preserveScroll?window.scrollY:0;
  const sidebarScroll=preserveScroll?($('.lesson-sidebar')?.scrollTop||0):0,exerciseScroll=preserveScroll?($('.exercise-list')?.scrollTop||0):0;
  for(const cm of state.editors.values()){try{cm.toTextArea();}catch{}}
  state.editors.clear();
  const activeView=['roadmap','study'].includes(state.view)?'courses':state.view==='project'?'projects':state.view;
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===activeView));
  $('#breadcrumb-current').textContent=label[state.view]||'Учебник';
  updateProgress();
  const pages={dashboard:renderDashboard,courses:renderCourses,roadmap:renderRoadmap,study:renderStudy,practice:renderPractice,projects:renderProjects,project:renderProject,assessment:renderAssessment,playground:renderPlayground,schema:renderSchema,reference:renderReference,glossary:renderGlossary};
  const engineError=state.engineError?'<div class="feedback fail" role="alert" style="margin-bottom:16px"><strong>Не удалось запустить PostgreSQL.</strong><p>Этап: '+esc(state.engineError.stage)+'</p><p>'+esc(state.engineError.message)+'</p><details><summary>Технические подробности</summary><pre>'+esc(state.engineError.detail)+'</pre></details><button class="btn primary" data-action="retry-engine">Повторить запуск</button></div>':'';
  host.innerHTML=engineError+(pages[state.view]||renderDashboard)();
  bindPage();
  requestAnimationFrame(()=>{
    if(state.view==='study')$('.lesson-sidebar')?.scrollTo({top:sidebarScroll,behavior:'instant'});
    if(state.view==='practice')$('.exercise-list')?.scrollTo({top:exerciseScroll,behavior:'instant'});
    window.scrollTo({top:windowY,behavior:'instant'});
    state.navigationScrollReset=false;
    for(const cm of state.editors.values())cm.refresh();
  });
}
function pageHead(kicker,title,desc,action='') {
  return `<div class="page-head"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${desc}</p></div>${action}</div>`;
}
function moduleRow(m,index) {
  const done=progressForModule(m),pct=modulePct(m);
  return `<div class="module-row" data-module="${m.id}"><div class="module-number">${String(index+1).padStart(2,'0')}</div><div class="module-info"><strong>${esc(m.title)}</strong><small>${esc(m.desc)}</small></div><div class="module-meta">${done}/${m.lessons.length} · ${pct}%</div><i class="module-status ${pct===100?'done':''}"></i></div>`;
}
function renderDashboard() {
  const core=moduleLessons('core');
  const coreProgress=getTrackProgress(modules,state.completedLessons,'core');
  const next=findNextLesson(modules,state.completedLessons);
  const recent=core.slice(0,5);
  const courseCounts=learningTracks.map(track=>{
    const total=moduleLessons(track.id).reduce((sum,module)=>sum+module.lessons.length,0);
    const name=track.id==='core'?'SQL':track.title;
    return `<span data-course-count="${track.id}">${esc(name)} · ${total}</span>`;
  }).join('');
  return `
    <section class="hero"><div class="eyebrow">КУРС SQL · JUNIOR DATA ANALYST</div><h1>SQL — не набор команд.<br>Это способ думать о данных.</h1><p>Курс ведёт от реляционной модели к самостоятельной аналитике. PostgreSQL изучается отдельно, со своей программой и прогрессом.</p><div class="hero-actions"><button class="btn primary" data-action="continue">Продолжить обучение →</button><button class="btn ghost" data-nav="courses">Каталог курсов</button></div></section>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-label">Самостоятельных курсов</span><strong>${learningTracks.length}</strong><div class="stat-course-counts">${courseCounts}</div></div>
      <div class="stat-card"><span class="stat-label">Практических задач</span><strong>${exercises.length}</strong><small>С реальной проверкой SQL</small></div>
      <div class="stat-card"><span class="stat-label">Пройдено в курсе SQL</span><strong>${coreProgress.completed}</strong><small>Из ${coreProgress.total} уроков Junior Data Analyst</small></div>
      <div class="stat-card"><span class="stat-label">Решено задач</span><strong>${state.completedExercises.size}</strong><small>Из ${exercises.length} практических</small></div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="eyebrow">СЛЕДУЮЩИЙ ШАГ</div><div class="continue-card" style="margin-top:12px"><div class="continue-icon">↗</div><div><h3>${next?esc(next.lesson.title):'Все уроки пройдены'}</h3><p>${next?`${esc(next.module.title)} · урок ${next.index+1} из ${next.module.lessons.length}`:'Оба курса завершены.'}</p>${next?'<button class="btn primary small" data-action="open-next">Открыть урок</button>':'<button class="btn small" data-nav="courses">Открыть курсы</button>'}</div></div></div>
      <div class="card"><div class="eyebrow">ОБУЧЕНИЕ В БРАУЗЕРЕ</div><h3 style="margin:8px 0 5px;font-size:15px">Настоящий PostgreSQL, а не имитация</h3><p style="color:var(--muted);font-size:11px;margin:0">Запросы исполняются локально через WebAssembly. Учебная схема уже заполнена данными, а прогресс сохраняется в браузере.</p></div>
    </div>
    <div class="section-row"><h2>Основной курс</h2><button class="btn small" data-nav="courses">Все курсы →</button></div>
    <div class="module-list">${recent.map((m)=>moduleRow(m,modules.indexOf(m))).join('')}</div>
    <div class="section-row"><h2>Быстрый доступ</h2><span>Рабочие инструменты курса</span></div>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-label">SQL-песочница</span><strong style="font-size:17px">›_</strong><small>Свободные запросы</small><button class="btn small" data-nav="playground" style="margin-top:9px">Открыть</button></div>
      <div class="stat-card"><span class="stat-label">Практика</span><strong style="font-size:17px">${exercises.length} задач</strong><small>Проверка результата</small><button class="btn small" data-nav="practice" style="margin-top:9px">Решать</button></div>
      <div class="stat-card"><span class="stat-label">Учебная схема</span><strong style="font-size:17px">9 таблиц</strong><small>Интернет-магазин</small><button class="btn small" data-nav="schema" style="margin-top:9px">Изучить</button></div>
      <div class="stat-card"><span class="stat-label">Справочник</span><strong style="font-size:17px">SQL ref</strong><small>Синтаксис и термины</small><button class="btn small" data-nav="reference" style="margin-top:9px">Открыть</button></div>
    </div>
    <section class="backup-panel card" aria-labelledby="backup-title">
      <div class="backup-copy"><div class="eyebrow">СОХРАННОСТЬ ПРОГРЕССА</div><h2 id="backup-title">Резервная копия обучения</h2><p>Сохрани прогресс курсов, контрольные работы, SQL-черновики и результаты проектов в файл. Его можно восстановить в другом браузере.</p><small>Восстановление заменит текущие локальные данные. Перед этим экспортируй их, если хочешь сохранить обе версии.</small></div>
      <div class="backup-actions"><button class="btn primary" data-action="export-backup">Скачать копию</button><button class="btn" data-action="import-backup">Восстановить из файла</button><input id="backup-import-file" type="file" accept=".json,application/json" hidden></div>
    </section>`;
}
function renderCourses() {
  const cards=learningTracks.map(track=>{
    const trackModules=moduleLessons(track.id);
    const lessons=trackModules.reduce((sum,module)=>sum+module.lessons.length,0);
    const progress=getTrackProgress(modules,state.completedLessons,track.id);
    return `<article class="course-card">
      <div class="course-card-top"><span class="eyebrow">${track.required?'ОСНОВНОЙ КУРС':'УГЛУБЛЁННЫЙ КУРС'}</span><span class="course-level">${esc(track.courseLevel)}</span></div>
      <h2>${esc(track.title)}</h2>
      <p class="course-goal">${esc(track.courseGoal)}</p>
      <div class="course-facts">
        <div><strong>Для кого</strong><p>${esc(track.courseAudience)}</p></div>
        <div><strong>Предварительные знания</strong><p>${esc(track.coursePrerequisites)}</p></div>
      </div>
      <div class="course-metrics"><span>${trackModules.length} модулей</span><span>${lessons} уроков</span></div>
      <div class="course-progress"><div><span>Прогресс курса</span><strong>${progress.completed} / ${progress.total} · ${progress.percent}%</strong></div><div class="progress-track"><span style="width:${progress.percent}%"></span></div></div>
      <button class="btn primary" data-open-course="${track.id}">Открыть программу →</button>
    </article>`;
  }).join('');
  return pageHead('ОБУЧЕНИЕ','Курсы','Самостоятельные учебные программы. У каждого курса своя последовательность, практика и прогресс.')+
    `<div class="course-grid">${cards}</div>`;
}
function renderProjects() {
  const cards=projects.map(project=>{
    const completed=project.tasks.filter(task=>state.completedProjectTasks.has(task.id)).length;
    const percent=Math.round(completed/project.tasks.length*100);
    return `<article class="project-card">
      <div class="project-card-top"><span class="eyebrow">АНАЛИТИЧЕСКИЙ КЕЙС</span><span class="project-level">${esc(project.level)}</span></div>
      <h2>${esc(project.title)}</h2>
      <p class="project-subtitle">${esc(project.subtitle)}</p>
      <p class="project-description">${esc(project.objective)}</p>
      <div class="project-audience"><strong>Для кого</strong><p>${esc(project.audience)}</p></div>
      <div class="project-dataset"><strong>Данные</strong><p>${esc(project.dataset)}</p></div>
      <div class="project-progress">
        <div><span>${completed} из ${project.tasks.length} заданий</span><strong>${percent}%</strong></div>
        <div class="progress-track"><span style="width:${percent}%"></span></div>
      </div>
      <button class="btn primary" data-open-project="${project.id}">Открыть проект →</button>
    </article>`;
  }).join('');
  return pageHead('ПРАКТИЧЕСКИЕ КЕЙСЫ','Проекты','Самостоятельные бизнес-задачи, где нужно выбрать подход к анализу, проверить метрики и объяснить результат.')+
    `<div class="project-grid">${cards}</div>`;
}
function renderProjectWrapUp(project,unlocked) {
  if(!unlocked) return `<section class="project-wrapup" id="project-wrapup">
    <div class="project-wrapup-locked">
      <span class="eyebrow">ФИНАЛЬНЫЙ ЭТАП</span>
      <h2>Итоговая аналитическая записка</h2>
      <p>Сначала выполни три SQL-задания проекта. После этого откроются проверка качества выводов, вопросы для записки и проверка интерпретации.</p>
    </div>
  </section>`;
  const wrap=project.wrapUp;
  const review=wrap.review;
  const selected=Number.isInteger(state.projectReviews[project.id])?state.projectReviews[project.id]:null;
  const answered=selected!==null;
  const options=review.options.map((option,index)=>{
    const correct=index===review.correctIndex;
    const selectedClass=answered&&index===selected?(correct?' is-correct':' is-incorrect'):'';
    const revealClass=answered&&correct&&index!==selected?' is-correct':'';
    return `<button class="project-review-option${selectedClass}${revealClass}" data-project-review="${project.id}:${index}" ${answered?'disabled':''}>${String.fromCharCode(65+index)}. ${esc(option)}</button>`;
  }).join('');
  const answer=answered?(
    selected===review.correctIndex
      ? `<div class="feedback success" role="status"><strong>Верная интерпретация.</strong><p>${esc(review.explanation)}</p></div>`
      : `<div class="feedback fail" role="status"><strong>Не совсем. Верный вариант: ${String.fromCharCode(65+review.correctIndex)}.</strong><p>${esc(review.explanation)}</p></div>`
  ):'';
  return `<section class="project-wrapup" id="project-wrapup">
    <div class="project-wrapup-heading">
      <span class="eyebrow">ФИНАЛЬНЫЙ ЭТАП · ${esc(project.title)}</span>
      <h2>${esc(wrap.title)}</h2>
      <p>SQL-результат — ещё не бизнес-вывод. Проверь данные, объясни наблюдения и отдели факт от гипотезы.</p>
    </div>
    <div class="project-wrapup-grid">
      <section class="project-wrapup-panel">
        <h3>Проверка надёжности</h3>
        <ul class="project-check-list">${wrap.checks.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>
        <h3>Проверь интерпретацию</h3>
        <p class="project-review-prompt">${esc(review.prompt)}</p>
        <div class="project-review-options">${options}</div>
        <div id="project-review-feedback">${answer}</div>
      </section>
      <section class="project-wrapup-panel project-note-panel">
        <label for="project-conclusion">Черновик итоговой записки</label>
        <p>${esc(wrap.notePrompt)}</p>
        <textarea id="project-conclusion" data-project-conclusion="${project.id}" rows="9" maxlength="5000" placeholder="Наблюдения → интерпретация → ограничение → рекомендация">${esc(state.projectNotes[project.id]||'')}</textarea>
        <small>Сохраняется автоматически отдельно для каждого проекта в этом браузере.</small>
      </section>
    </div>
    <section class="project-wrapup-prompts">
      <h3>Что должно попасть в итоговый вывод</h3>
      <ol>${wrap.prompts.map(item=>`<li>${esc(item)}</li>`).join('')}</ol>
    </section>
    <p class="project-limitation"><strong>Ограничения данных.</strong> ${esc(wrap.limitation)}</p>
  </section>`;
}

function renderProject() {
  const project=projects.find(item=>item.id===state.projectId)||projects[0];
  const active=project.tasks.find(task=>task.id===state.projectTaskId)||project.tasks[0];
  state.projectId=project.id;
  state.projectTaskId=active.id;
  const completed=project.tasks.filter(task=>state.completedProjectTasks.has(task.id)).length;
  const percent=Math.round(completed/project.tasks.length*100);
  const taskNav=project.tasks.map((task,index)=>`<button class="project-task-nav ${task.id===active.id?'active':''} ${state.completedProjectTasks.has(task.id)?'done':''}" id="project-task-${task.id}" data-project-task="${task.id}">
    <span class="project-task-number">${String(index+1).padStart(2,'0')}</span><span><strong>${esc(task.title)}</strong><small>${state.completedProjectTasks.has(task.id)?'Проверено':'Самостоятельное задание'}</small></span><span class="project-task-status">${state.completedProjectTasks.has(task.id)?'✓':'→'}</span>
  </button>`).join('');
  const solution=state.projectSolutionVisible?`<details class="project-solution" open><summary>Эталонное решение</summary><pre><code>${esc(active.solution)}</code></pre></details>`:'';
  const nextIndex=project.tasks.findIndex(task=>task.id===active.id)+1;
  const nextTask=project.tasks[nextIndex];
  return pageHead('ПРОЕКТ · '+esc(project.title),esc(project.title),esc(project.subtitle),'<button class="btn" data-nav="projects">← Все проекты</button>')+
    `<section class="project-brief">
      <div><span class="eyebrow">БИЗНЕС-КОНТЕКСТ</span><p>${esc(project.context)}</p></div>
      <div><span class="eyebrow">ЦЕЛЬ ПРОЕКТА</span><p>${esc(project.objective)}</p></div>
      <div><span class="eyebrow">НАБОР ДАННЫХ</span><p>${esc(project.dataset)}</p></div>
    </section>
    <div class="project-workspace">
      <aside class="project-task-panel">
        <div class="project-progress">
          <div><strong>Выполнение проекта</strong><span id="project-progress-value">${completed}/${project.tasks.length} · ${percent}%</span></div>
          <div class="progress-track"><span id="project-progress-fill" style="width:${percent}%"></span></div>
        </div>
        <div class="project-task-list" id="project-task-list">${taskNav}</div>
      </aside>
      <section class="project-task-content">
        <div class="task-meta">ЗАДАНИЕ ${nextIndex} ИЗ ${project.tasks.length}</div>
        <h2>${esc(active.title)} ${state.completedProjectTasks.has(active.id)?'✓':''}</h2>
        <div class="project-prompt"><span class="eyebrow">СИТУАЦИЯ</span><p>${esc(active.brief)}</p></div>
        <div class="project-prompt"><span class="eyebrow">УСЛОВИЯ</span><p>${esc(active.conditions)}</p></div>
        <div class="project-prompt project-deliverable"><span class="eyebrow">ОЖИДАЕМЫЙ РЕЗУЛЬТАТ</span><p>${esc(active.expected)}</p></div>
        ${editor(state.projectDrafts[active.id]||'','project-editor','Самостоятельно напиши запрос для решения бизнес-задачи. Эталон скрыт до запроса.') }
        <div class="editor-actions project-editor-actions">
          <button class="btn primary" data-action="check-project-task" ${state.engineReady?'':'disabled'}>Проверить запрос</button>
          <button class="btn" data-action="show-project-solution">${state.projectSolutionVisible?'Скрыть эталон':'Показать эталонное решение'}</button>
          ${nextTask?`<button class="btn" data-action="next-project-task">Следующее задание →</button>`:'<button class="btn" data-nav="projects">К проектам</button>'}
        </div>
        ${solution}
        <div id="project-feedback"></div>
      </section>
    </div>
    ${renderProjectWrapUp(project,completed===project.tasks.length)}`;
}

function renderRoadmap() {
  const selected=learningTracks.find(track=>track.id===state.roadmapTrack)||learningTracks[0];
  const selectedModules=moduleLessons(selected.id);
  const groups=new Map();
  selectedModules.forEach((module,index)=>{if(!groups.has(module.stage))groups.set(module.stage,[]);groups.get(module.stage).push({module,index});});
  return pageHead('ПРОГРАММА КУРСА',esc(selected.title),selected.description,'<button class="btn" data-nav="courses">← Все курсы</button>')+
  `<div class="track-intro"><div class="eyebrow">${esc(selected.courseLevel)}</div><p>${esc(selected.description)}</p><p><strong>Предварительные знания:</strong> ${esc(selected.coursePrerequisites)}</p></div>`+
  [...groups.entries()].map(([stage,items])=>`<section class="roadmap-stage"><div class="roadmap-stage-head"><span>${esc(stage)}</span><h2>${esc(stage.split(' · ')[1])}</h2><small>${items.reduce((sum,item)=>sum+item.module.lessons.length,0)} уроков</small></div><div class="module-list">${items.map(item=>moduleRow(item.module,item.index)).join('')}</div></section>`).join('');
}
const sqlTokenTips = {
  SELECT:'Определяет столбцы и выражения, которые попадут в результат запроса.', FROM:'Указывает таблицу или другой источник строк.', WHERE:'Фильтрует отдельные строки до группировки.',
  JOIN:'Соединяет строки двух источников по условию или правилу соединения.', LEFT:'Сохраняет все строки левого источника, даже если совпадения справа нет.', RIGHT:'Сохраняет все строки правого источника.', INNER:'Оставляет только совпавшие пары строк.', FULL:'Сохраняет несовпавшие строки обеих сторон.', CROSS:'Создаёт декартово произведение.', ON:'Задаёт условие сопоставления строк таблиц.',
  AS:'Задаёт псевдоним столбцу, выражению или источнику данных.', DISTINCT:'Удаляет повторяющиеся строки результата.', GROUP:'Начинает группировку строк.', BY:'Часть GROUP BY или ORDER BY.', HAVING:'Фильтрует уже сформированные группы.', ORDER:'Начинает сортировку результата.', ASC:'Сортировка по возрастанию.', DESC:'Сортировка по убыванию.', LIMIT:'Ограничивает число возвращаемых строк.', OFFSET:'Пропускает строки перед выдачей результата.',
  WITH:'Объявляет CTE — именованный промежуточный результат запроса.', RECURSIVE:'Разрешает CTE ссылаться на себя.', UNION:'Объединяет результаты запросов и по умолчанию удаляет дубликаты.', ALL:'Сохраняет дубликаты в UNION ALL.',
  INSERT:'Добавляет новые строки.', INTO:'Указывает целевую таблицу.', VALUES:'Задаёт значения вставляемых строк.', UPDATE:'Изменяет существующие строки.', SET:'Указывает новые значения столбцов.', DELETE:'Удаляет выбранные строки.', RETURNING:'Возвращает строки, изменённые командой.', CREATE:'Создаёт объект базы данных.', INDEX:'Структура для ускорения подходящих поисков и сортировок.', INCLUDE:'Добавляет значения в индекс без включения их в ключ сортировки.', USING:'Указывает метод доступа или способ использования объекта.',
  EXPLAIN:'Показывает план, который PostgreSQL выбрал для запроса.', ANALYZE:'В EXPLAIN ANALYZE запускает запрос и измеряет фактическое выполнение; отдельно ANALYZE обновляет статистику.', BUFFERS:'Показывает чтение и попадания в буферный кеш PostgreSQL.', VERBOSE:'Показывает расширенные сведения об узлах плана.', COSTS:'Управляет выводом оценочной стоимости узлов.', VACUUM:'Обслуживает таблицу и помогает повторно использовать место старых версий строк.', MATERIALIZED:'Просит материализовать CTE в соответствующем контексте.',
  FILTER:'Ограничивает строки, учитываемые конкретной агрегатной функцией.', OVER:'Превращает функцию в оконную и задаёт её окно.', PARTITION:'Часть PARTITION BY: делит окно на независимые группы.', ROWS:'Задаёт рамку оконной функции в физических строках.', RANGE:'Задаёт рамку окна по значениям сортировки.',
  CASE:'Начинает условное выражение.', WHEN:'Задаёт условие ветки CASE.', THEN:'Задаёт результат при истинном WHEN.', ELSE:'Задаёт запасной результат CASE.', END:'Завершает выражение CASE.', AND:'Логическое И: оба условия должны быть истинными.', OR:'Логическое ИЛИ: достаточно одного истинного условия.', NOT:'Логическое отрицание; учитывай поведение NULL.', NULL:'Отсутствующее или неизвестное значение; используй IS NULL.', IS:'Используется для проверки NULL и булевых состояний.', IN:'Проверяет вхождение в список или результат подзапроса.', EXISTS:'Проверяет, вернул ли подзапрос хотя бы одну строку.', BETWEEN:'Проверяет включительный диапазон.', LIKE:'Сравнивает текст с шаблоном.', ILIKE:'PostgreSQL-вариант LIKE без учёта регистра.',
  COUNT:'Считает строки или не-NULL значения аргумента.', SUM:'Считает сумму значений.', AVG:'Вычисляет среднее арифметическое.', MIN:'Возвращает минимум.', MAX:'Возвращает максимум.', COALESCE:'Возвращает первый аргумент, который не равен NULL.', NULLIF:'Возвращает NULL, если аргументы равны.', LAG:'Берёт значение из предыдущей строки окна.', LEAD:'Берёт значение из следующей строки окна.', ROW_NUMBER:'Нумерует строки внутри окна без пропусков.', RANK:'Ранжирует значения с пропусками после совпадений.', DENSE_RANK:'Ранжирует значения без пропусков.', NTILE:'Распределяет строки окна по приблизительно равным группам.', DATE_TRUNC:'Округляет дату или время до календарной единицы.', CURRENT_DATE:'Возвращает текущую дату.', CURRENT_TIMESTAMP:'Возвращает текущие дату и время с часовым поясом сессии.', INTERVAL:'Задаёт промежуток времени.'
};
function lessonFocusTokens(lesson) {
  if(Array.isArray(lesson?.tipTokens)) return new Set(lesson.tipTokens.map(token=>String(token).toUpperCase()));
  const title=String(lesson?.title||'').toLowerCase();
  const simple=String(lesson?.simple||'').toLowerCase();
  const topic=title+' '+simple;
  const focus=new Set();
  const add=(...tokens)=>tokens.forEach(token=>focus.add(token));

  if(/join|соедин|кардинальност|зерно данных|внешн.{0,8}ключ|связ/.test(topic)) add('JOIN','LEFT','RIGHT','FULL','INNER','CROSS','ON','USING','EXISTS');
  if(/where|фильтр|услови|логическ.{0,12}оператор|and, or|предикат/.test(topic)) add('WHERE','AND','OR','NOT','IS','NULL','IN','EXISTS','BETWEEN','LIKE','ILIKE');
  if(/агрегат|group by|группиров|having|count|sum|avg|медиан|перцентил|конверси|условн.{0,12}агрегац/.test(topic)) add('SELECT','GROUP','BY','HAVING','FILTER','COUNT','SUM','AVG','MIN','MAX');
  if(/оконн|window|row_number|rank|lag|lead|рамк.{0,8}окн|rows и range/.test(topic)) add('OVER','PARTITION','BY','ROWS','RANGE','ORDER','ROW_NUMBER','RANK','DENSE_RANK','NTILE','LAG','LEAD','SUM','AVG','COUNT');
  if(/\bcte\b|\bwith\b|рекурсивн.{0,8}cte|общ.{0,8}табличн.{0,8}выражен/.test(topic)) add('WITH','RECURSIVE','UNION','ALL');
  if(/индекс|explain|план выполнен|производительност|sargable|оптимизац/.test(topic)) add('CREATE','INDEX','INCLUDE','EXPLAIN','ANALYZE','BUFFERS','VERBOSE','COSTS','ON','WHERE');
  if(/\bcase\b|условн.{0,8}выражен|ветвлен/.test(topic)) add('SELECT','CASE','WHEN','THEN','ELSE','END');
  if(/coalesce|nullif|обработк.{0,8}null|неизвестн.{0,8}значен/.test(topic)) add('COALESCE','NULLIF','NULL','IS','NOT');
  if(/транзакц|acid|изоляц.{0,8}транзакц/.test(topic)) add('BEGIN','COMMIT','ROLLBACK','SAVEPOINT');
  if(/\binsert\b|вставк|добавлен.{0,8}строк/.test(topic)) add('INSERT','INTO','VALUES','RETURNING');
  if(/\bupdate\b|обновлен.{0,8}строк|изменен.{0,8}данн/.test(topic)) add('UPDATE','SET','WHERE','RETURNING');
  if(/\bdelete\b|удален.{0,8}строк/.test(topic)) add('DELETE','FROM','WHERE','RETURNING');
  if(/сортиров|order by|пагинац|keyset/.test(topic)) add('ORDER','BY','ASC','DESC','LIMIT','OFFSET');
  if(/подзапрос|semi join|anti join|exists/.test(topic)) add('EXISTS','IN','SELECT','FROM','WHERE');
  if(/null и|null\b|неизвестн.{0,8}значен/.test(topic)) add('NULL','IS','NOT','COALESCE','NULLIF');
  if(/анатомия select|\bselect\b|выборк.{0,8}данн|структур.{0,8}select/.test(topic)) add('SELECT','FROM','WHERE','DISTINCT');
  if(/дат|времен|timestamp|интервал/.test(topic)) add('DATE_TRUNC','CURRENT_DATE','CURRENT_TIMESTAMP','INTERVAL','AT');
  return focus;
}

function tokenIsContextual(token, source, index) {
  const before=source.slice(0,index);
  const after=source.slice(index+token.length);
  const previous=(before.match(/\b([A-Za-z_]+)\s*$/)||[])[1]?.toUpperCase();
  const functions=new Set(['COUNT','SUM','AVG','MIN','MAX','COALESCE','NULLIF','LAG','LEAD','ROW_NUMBER','RANK','DENSE_RANK','NTILE','DATE_TRUNC']);
  if(functions.has(token)) return /^\s*\(/.test(after);
  if(token==='BY') return ['GROUP','ORDER','PARTITION'].includes(previous);
  if(token==='GROUP'||token==='ORDER'||token==='PARTITION') return /^\s+BY\b/i.test(after);
  if(token==='LEFT'||token==='RIGHT'||token==='FULL'||token==='INNER'||token==='CROSS') return /^\s+JOIN\b/i.test(after);
  if(token==='ON') return /\bJOIN\b[\s\S]*$/i.test(before) || /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b[\s\S]*$/i.test(before);
  if(token==='INTO') return previous==='INSERT';
  if(token==='ALL') return previous==='UNION';
  if(token==='SET') return /\bUPDATE\b[\s\S]*$/i.test(before);
  if(token==='OVER'||token==='FILTER') return /^\s*\(/.test(after);
  if(token==='ROWS'||token==='RANGE') return /\b(?:BETWEEN|PRECEDING|FOLLOWING|CURRENT ROW)\b/i.test(source);
  if(token==='EXISTS') return /^\s*\(/.test(after);
  if(token==='IN') return /^\s*\(/.test(after);
  if(token==='ANALYZE') return /^\s*(?:SELECT|WITH)/i.test(after) || /\bEXPLAIN\s*(?:\([^)]*)?$/i.test(before);
  if(token==='BUFFERS'||token==='VERBOSE'||token==='COSTS') return /\bEXPLAIN\b/i.test(source);
  return true;
}

function renderAnnotatedSql(sql, lesson) {
  const source=String(sql||'');
  const focus=lessonFocusTokens(lesson);
  if(!focus.size) return esc(source);
  const pattern=/(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|\b[A-Za-z_][A-Za-z0-9_$]*\b|\b\d+(?:\.\d+)?\b|<>|!=|<=|>=|::|[=<>])/g;
  let output='',last=0;
  for(const match of source.matchAll(pattern)){
    output+=esc(source.slice(last,match.index));
    const token=match[0];
    const upper=token.toUpperCase();
    const isComment=token.startsWith('--')||token.startsWith('/*');
    const isLiteral=token.startsWith("'")||token.startsWith('"')||/^\d/.test(token);
    const tip=!isComment&&!isLiteral&&focus.has(upper)&&sqlTokenTips[upper]&&tokenIsContextual(upper,source,match.index)?sqlTokenTips[upper]:'';
    output+=tip?'<span class="sql-tip" tabindex="0" data-tip="'+esc(tip)+'">'+esc(token)+'</span>':esc(token);
    last=match.index+token.length;
  }
  return output+esc(source.slice(last));
}

function explainSqlLine(line, index, lines, lesson) {
  const s=String(line||'').trim();
  if(!s||/^--|^\/\*|^\*\/?/.test(s)) return '';
  const focus=lessonFocusTokens(lesson);
  const windowContext=lines.slice(0,index+1).join('\n').includes('OVER');
  if(/^EXPLAIN\b/i.test(s)&&focus.has('EXPLAIN')) return 'Показывает план запроса; с ANALYZE запрос действительно выполняется.';
  if(/^SELECT\b/i.test(s)&&focus.has('SELECT')) {
    if(/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(s)) return 'Вычисляет агрегатный показатель для выбранной группы.';
    if(/\b(ROW_NUMBER|RANK|DENSE_RANK|LAG|LEAD)\s*\(/i.test(s)) return 'Добавляет оконное значение, не сворачивая строки.';
    if(/\bCASE\b/i.test(s)) return 'Формирует значение по первой подходящей ветке CASE.';
    return 'Выбирает столбцы и выражения результата.';
  }
  if(/^FROM\b/i.test(s)&&focus.has('FROM')) return 'Задаёт таблицу-источник.';
  if(/^(LEFT|RIGHT|FULL|INNER|CROSS)?\s*JOIN\b/i.test(s)&&focus.has('JOIN')) {
    const type=(s.match(/^(LEFT|RIGHT|FULL|INNER|CROSS)/i)||[])[1]||'INNER';
    const meaning={LEFT:'сохраняет все строки слева',RIGHT:'сохраняет все строки справа',FULL:'сохраняет строки с обеих сторон',CROSS:'сочетает каждую строку с каждой',INNER:'оставляет только совпавшие пары'}[type.toUpperCase()];
    return type+' JOIN '+meaning+'.';
  }
  if(/^ON\b/i.test(s)&&focus.has('ON')) return 'Задаёт ключ сопоставления таблиц.';
  if(/^WHERE\b/i.test(s)&&focus.has('WHERE')) return 'Отбирает строки до группировки.';
  if(/^GROUP\s+BY\b/i.test(s)&&focus.has('GROUP')) return 'Формирует группы по указанным полям.';
  if(/^HAVING\b/i.test(s)&&focus.has('HAVING')) return 'Фильтрует уже сформированные группы.';
  if(/^ORDER\s+BY\b/i.test(s)&&focus.has('ORDER')) return windowContext?'Задаёт порядок строк внутри окна.':'Сортирует итоговый результат.';
  if(/^LIMIT\b/i.test(s)&&focus.has('LIMIT')) return 'Ограничивает число возвращаемых строк.';
  if(/^OFFSET\b/i.test(s)&&focus.has('OFFSET')) return 'Пропускает указанное число строк.';
  if(/^WITH\b/i.test(s)&&focus.has('WITH')) return 'Объявляет CTE для использования ниже.';
  if(/^PARTITION\s+BY\b/i.test(s)&&focus.has('PARTITION')) return 'Разделяет строки на независимые оконные группы.';
  if(/^OVER\s*\(/i.test(s)&&focus.has('OVER')) return 'Задаёт окно вычисления функции.';
  if(/^(ROWS|RANGE)\s+BETWEEN\b/i.test(s)&&focus.has('ROWS')) return s.toUpperCase().startsWith('ROWS')?'Рамка задаётся количеством строк.':'Рамка задаётся диапазоном значений сортировки.';
  if(/^FILTER\s*\(/i.test(s)&&focus.has('FILTER')) return 'Ограничивает строки только для этого агрегата.';
  if(/^CASE\b/i.test(s)&&focus.has('CASE')) return 'Начинает условное выражение.';
  if(/^WHEN\b/i.test(s)&&focus.has('WHEN')) return 'Проверяет условие ветки CASE.';
  if(/^ELSE\b/i.test(s)&&focus.has('ELSE')) return 'Задаёт результат, если ни один WHEN не подошёл.';
  if(/^CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(s)&&focus.has('INDEX')) return 'Создаёт индекс для подходящих запросов.';
  if(/^INSERT\b/i.test(s)&&focus.has('INSERT')) return 'Добавляет новые строки.';
  if(/^UPDATE\b/i.test(s)&&focus.has('UPDATE')) return 'Изменяет строки, выбранные условием.';
  if(/^DELETE\b/i.test(s)&&focus.has('DELETE')) return 'Удаляет строки, выбранные условием.';
  if(/^RETURNING\b/i.test(s)&&focus.has('RETURNING')) return 'Возвращает строки, затронутые изменяющей командой.';
  if(/^BEGIN\b/i.test(s)&&focus.has('BEGIN')) return 'Начинает транзакцию.';
  if(/^COMMIT\b/i.test(s)&&focus.has('COMMIT')) return 'Фиксирует изменения транзакции.';
  if(/^ROLLBACK\b/i.test(s)&&focus.has('ROLLBACK')) return 'Отменяет незакоммиченные изменения.';
  return '';
}

function renderExampleBreakdown(sql, lesson) {
  const lines=String(sql||'').split('\n');
  const items=[];
  const seen=new Set();
  for(let index=0;index<lines.length;index++){
    const explanation=explainSqlLine(lines[index],index,lines,lesson);
    if(!explanation) continue;
    const line=lines[index].trim();
    const key=explanation;
    if(seen.has(key)) continue;
    seen.add(key);
    items.push({line,explanation});
  }
  if(!items.length) return '';
  const rows=items.slice(0,5).map(item=>'<li><code>'+renderAnnotatedSql(item.line,lesson)+'</code><p>'+esc(item.explanation)+'</p></li>').join('');
  return '<section class="example-breakdown"><div class="breakdown-heading"><h3>Ключевые части запроса</h3></div><ol class="breakdown-list">'+rows+'</ol></section>';
}

function renderExampleResult(lesson) {
  const result=lesson.exampleResult;
  if(!result?.columns?.length||!Array.isArray(result.rows))return '';
  const head=result.columns.map(column=>'<th>'+esc(column)+'</th>').join('');
  const rows=result.rows.map(row=>'<tr>'+result.columns.map((column,index)=>'<td>'+esc(row[index]===null?'NULL':String(row[index]))+'</td>').join('')+'</tr>').join('');
  return '<div class="result-panel example-result"><div class="result-head"><strong>Ожидаемый результат</strong><small>'+result.rows.length+' строк</small></div><div class="result-body">'+(rows?'<table class="result-table"><thead><tr>'+head+'</tr></thead><tbody>'+rows+'</tbody></table>':'<p class="empty-result">Запрос не вернул строк.</p>')+'</div></div>';
}
function renderWorkedExample(w) {
  if(!w?.scenario||!Array.isArray(w.steps)||!w.steps.length)return '';
  return '<section class="worked-example"><div class="eyebrow">РАЗОБРАННЫЙ СЦЕНАРИЙ</div><h3>'+esc(w.title||'Пройдём пример по шагам')+'</h3><p class="worked-scenario">'+esc(w.scenario)+'</p><ol class="worked-steps">'+w.steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol><div class="worked-result"><strong>Что должно получиться</strong><p>'+esc(w.result||'')+'</p></div>'+(w.pitfall?'<div class="worked-pitfall"><strong>Типичная ошибка</strong><p>'+esc(w.pitfall)+'</p></div>':'')+'</section>';
}
function lessonBody(l,m) {
  const simple=l.showSimple&&l.simple?`<div class="plain-language"><strong>Коротко</strong><p>${esc(l.simple)}</p></div>`:'';
  const explanation=(l.body||'').split(/\n\s*\n/).filter(Boolean).map(paragraph=>`<p>${esc(paragraph)}</p>`).join('');
  const sources=(m.sources||[]).map((url,i)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Документация PostgreSQL ${i+1} ↗</a>`).join(' · ');
  return `<div class="lesson-explanation">${explanation}</div>${simple}${renderWorkedExample(l.walkthrough)}<h2>Разберём на примере</h2><div class="code-block"><div class="code-head"><span>POSTGRESQL</span><button class="btn small" data-copy-code>Копировать</button></div><pre>${renderAnnotatedSql(l.example,l)}</pre></div>${renderExampleResult(l)}${l.note?`<div class="note-box"><strong>Важно:</strong> ${esc(l.note)}</div>`:''}${sources?`<div class="lesson-sources"><strong>Первоисточники:</strong> ${sources}</div>`:''}`;
}
function renderLessonQuiz(l) {
 const bank=l.quiz||[];if(!bank.length)return '';
 return `<section class="quiz-panel"><div class="eyebrow">МИНИ-ТЕСТ · ПОСЛЕ ОБЪЯСНЕНИЯ</div><h2>Проверь понимание</h2><p class="quiz-intro">Вопрос относится к материалу этого урока. Сначала изучи объяснение и пример, затем отвечай.</p>
 ${bank.map((q,index)=>{const key=quizKey(state.moduleId,state.lessonIndex,index),selected=state.quizAnswers[key],answered=selected!==undefined,correct=selected===q.answer,track=moduleById(state.moduleId)?.track,order=quizOptionOrders.get(quizOptionKey(q,track))||q.options.map((_,oi)=>oi);
 return `<div class="quiz-question"><div class="quiz-question-title"><span>ВОПРОС ${index+1} ИЗ ${bank.length}</span><strong>${esc(q.question)}</strong></div><div class="quiz-options">${order.map((oi,displayIndex)=>`<button class="quiz-option ${answered&&oi===selected?(correct?'correct':'incorrect'):''} ${answered&&correct&&oi===q.answer?'answer-key':''}" data-quiz-answer="${index}:${oi}" ${answered&&correct?'disabled':''}><span class="quiz-radio">${String.fromCharCode(65+displayIndex)}</span><span>${esc(q.options[oi])}</span></button>`).join('')}</div>${answered?`<div class="quiz-feedback ${correct?'correct':'incorrect'}"><strong>${correct?'Верно!':'Пока нет.'}</strong> ${esc(q.explanation)}${!correct?' Попробуй ещё раз, опираясь на объяснение выше.':''}</div>`:''}</div>`;}).join('')}
 <div class="quiz-summary">${bank.every((q,index)=>state.quizAnswers[quizKey(state.moduleId,state.lessonIndex,index)]===q.answer)?'<strong>Проверка пройдена.</strong>':'Ответь на вопрос, чтобы закрепить материал.'}</div></section>`;
}
function renderStudy() {
 const m=moduleById(state.moduleId)||modules[0];state.lessonIndex=Math.max(0,Math.min(state.lessonIndex,m.lessons.length-1));
 const l=m.lessons[state.lessonIndex],done=state.completedLessons.has(lessonKey(m.id,state.lessonIndex)),trackEnd=moduleLessons(m.track).at(-1)?.id===m.id&&state.lessonIndex===m.lessons.length-1;
 const activeTrack=learningTracks.find(track=>track.id===m.track)||learningTracks[0];
 const sidebar=`<section class="lesson-track-group"><h3>${esc(activeTrack.title)}</h3><p>${esc(activeTrack.subtitle)}</p>${moduleLessons(m.track).map(mod=>`<div style="margin-bottom:13px"><h4>${String(mod.trackOrder).padStart(2,'0')} · ${esc(mod.title)}</h4>${mod.lessons.map((lesson,li)=>`<button class="lesson-nav-item ${mod.id===m.id&&li===state.lessonIndex?'active':''} ${state.completedLessons.has(lessonKey(mod.id,li))?'done':''}" data-lesson="${mod.id}:${li}"><span class="dot">${state.completedLessons.has(lessonKey(mod.id,li))?'✓':'○'}</span>${esc(lesson.title)}</button>`).join('')}</div>`).join('')}</section>`;
 const practice=(l.practiceIds||[]).map(id=>{const ex=exercises.find(e=>e.id===id);return ex?`<button class="btn" data-exercise="${ex.id}">Практика: ${esc(ex.title)} →</button>`:''}).join('');
 const outcomes=(l.outcomes||[]).length?`<div class="lesson-card"><div class="eyebrow">РЕЗУЛЬТАТ УРОКА</div><h2>Что ты должен уметь</h2><ul>${l.outcomes.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div>`:'';
 return `${pageHead(esc(activeTrack.title).toUpperCase()+' · МОДУЛЬ '+String(m.trackOrder).padStart(2,'0'),m.title,m.desc,'<button class="btn" data-nav="roadmap">← К программе курса</button>')}<div class="split-layout"><aside class="card lesson-sidebar"><h3>Содержание курса</h3>${sidebar}</aside><article class="lesson-content">
 <div class="lesson-card"><div class="eyebrow">${esc(m.stage)} · УРОК ${state.lessonIndex+1} ИЗ ${m.lessons.length}</div><h1>${esc(l.title)}</h1>${lessonBody(l,m)}${renderLessonQuiz(l)}${practice?`<div class="lesson-footer lesson-practice-links">${practice}</div>`:''}<div class="lesson-footer"><button class="btn primary" data-action="complete-lesson">${done?'✓ Урок завершён':'Отметить урок завершённым'}</button></div></div>${outcomes}
 <div class="lesson-card"><div class="lesson-footer"><button class="btn" data-action="prev-lesson" ${state.lessonIndex===0?'disabled':''}>← Предыдущий урок</button><button class="btn primary" data-action="next-lesson" ${trackEnd?'disabled':''}>${trackEnd?(m.track==='core'?'Курс SQL для аналитика завершён':'Курс PostgreSQL завершён'):state.lessonIndex===m.lessons.length-1?'Следующий модуль →':'Следующий урок →'}</button></div></div></article></div>`;
}
function renderAssessment() {
  const available=moduleLessons(state.assessmentTrack);
  const selected=modules.find(module=>module.id===state.assessmentModuleId);
  if(!selected){
    return pageHead('ПРОВЕРКА ЗНАНИЙ','Контрольные работы','Проверь понимание целого модуля. Каждый тест содержит вопросы из отдельного банка; лучший результат сохраняется в браузере.') +
      '<div class="assessment-track-tabs">' +
      '<button class="track-tab '+(state.assessmentTrack==='core'?'active':'')+'" data-assessment-track="core"><strong>SQL для аналитика данных</strong><span>Самостоятельный курс</span></button>' +
      '<button class="track-tab '+(state.assessmentTrack==='postgresql'?'active':'')+'" data-assessment-track="postgresql"><strong>PostgreSQL</strong><span>Самостоятельный курс</span></button></div>' +
      '<div class="assessment-grid">' + available.map(module=>{
        const result=state.assessmentResults[module.id];
        return '<button class="assessment-module" data-assessment-module="'+module.id+'"><span class="eyebrow">'+module.lessons.length+' УРОКОВ · '+module.quiz.length+' ВОПРОСА</span><strong>'+esc(module.title)+'</strong><span class="assessment-module-meta">'+(result?'Попыток: '+result.attempts+' · лучший результат: '+result.bestScore+'/'+module.quiz.length:'Ещё не проходили')+'</span><span class="assessment-module-action">'+(result&&result.passed?'Зачёт получен · Повторить':'Начать проверку')+' →</span></button>';
      }).join('')+'</div>';
  }
  const bank=selected.quiz||[];
  const answered=Object.keys(state.assessmentAnswers).length;
  const score=bank.reduce((sum,q,index)=>sum+(state.assessmentAnswers[index]===q.answer?1:0),0);
  const passed=score>=Math.ceil(bank.length*0.75);
  let html=pageHead('КОНТРОЛЬНАЯ РАБОТА',esc(selected.title),'Ответь на все вопросы. Правильные ответы и объяснения откроются после отправки.','<button class="btn" data-action="assessment-back">← Все модули</button>');
  html+='<section class="card assessment-test"><div class="assessment-progress"><span>Ответы</span><strong>'+answered+' из '+bank.length+'</strong></div><div class="progress-track"><span style="width:'+(bank.length?answered/bank.length*100:0)+'%"></span></div>';
  html+=bank.map((question,index)=>{
    const chosen=state.assessmentAnswers[index],correct=chosen===question.answer;
    const order=quizOptionOrders.get(quizOptionKey(question,selected.track))||question.options.map((_,optionIndex)=>optionIndex);
    let options=order.map((optionIndex,displayIndex)=>{
      const selectedAnswer=chosen===optionIndex;
      const cls=state.assessmentSubmitted&&optionIndex===question.answer?' correct':state.assessmentSubmitted&&selectedAnswer&&!correct?' incorrect':'';
      return '<button class="quiz-option'+(selectedAnswer&&!state.assessmentSubmitted?' selected':'')+cls+'" data-assessment-answer="'+index+':'+optionIndex+'" '+(state.assessmentSubmitted?'disabled':'')+'><span class="quiz-radio">'+String.fromCharCode(65+displayIndex)+'</span><span>'+esc(question.options[optionIndex])+'</span></button>';
    }).join('');
    return '<article class="assessment-question"><div class="eyebrow">ВОПРОС '+(index+1)+' ИЗ '+bank.length+'</div><h3>'+esc(question.question)+'</h3><div class="quiz-options">'+options+'</div>'+(state.assessmentSubmitted?'<div class="quiz-feedback '+(correct?'correct':'incorrect')+'"><strong>'+(correct?'Верно':'Неверно')+'</strong> '+esc(question.explanation)+'</div>':'')+'</article>';
  }).join('');
  if(state.assessmentSubmitted){
    html+='<div class="assessment-result '+(passed?'passed':'not-passed')+'"><strong>'+(passed?'Зачёт получен':'Нужно повторить материал')+'</strong><span>'+score+' из '+bank.length+' · '+Math.round(score/bank.length*100)+'%</span><p>'+(passed?'Порог зачёта — 75%. Результат сохранён.':'Для зачёта нужно не менее '+Math.ceil(bank.length*0.75)+' правильных ответов. Изучи объяснения и попробуй ещё раз.')+'</p></div><div class="assessment-actions"><button class="btn" data-action="assessment-back">К списку модулей</button><button class="btn primary" data-action="assessment-retry">Повторить работу</button></div>';
  }else{
    html+='<div class="assessment-actions"><span class="assessment-hint">Ответь на все вопросы, чтобы отправить работу.</span><button class="btn primary" data-action="assessment-submit" '+(answered!==bank.length?'disabled':'')+'>Завершить и проверить</button></div>';
  }
  return html+'</section>';
}
function renderExerciseQuiz(ex) {
 const q=ex.quiz;if(!q)return '';const selected=state.exerciseQuizAnswers[ex.id],answered=selected!==undefined,correct=selected===q.answer;
 return `<section class="exercise-quiz"><div class="eyebrow">ПРОВЕРЬ ПОНЯТИЕ ПЕРЕД ПРАКТИКОЙ</div><strong class="exercise-quiz-question">${esc(q.question)}</strong><div class="quiz-options">${q.options.map((option,oi)=>`<button class="quiz-option ${answered&&oi===selected?(correct?'correct':'incorrect'):''}" data-exercise-quiz-answer="${oi}" ${answered&&correct?'disabled':''}><span class="quiz-radio">${String.fromCharCode(65+oi)}</span><span>${esc(option)}</span></button>`).join('')}</div>${answered?`<div class="quiz-feedback ${correct?'correct':'incorrect'}"><strong>${correct?'Верно!':'Не совсем.'}</strong> ${esc(q.explanation)}</div>`:''}</section>`;
}
function renderExerciseHints(exercise) {
  const levels = [
    ['Подсказка 1 · направление', exercise.hint],
    ['Подсказка 2 · логика', exercise.hint2],
    ['Подсказка 3 · структура', exercise.hint3]
  ].filter(([, value]) => value);
  return levels.map(([label, value]) => `<details class="hint"><summary>${label}</summary><p>${esc(value)}</p></details>`).join('');
}
function engineNotice() {
  if(state.engineReady || state.engineError) return '';
  return '<div class="callout" role="status" style="margin-bottom:14px"><strong>Подготавливаем учебную базу.</strong> Редактор и теория доступны, проверка запросов откроется после запуска PostgreSQL и расчёта эталонных результатов.</div>';
}
function renderPractice() {
  const trackExercises=exercises.filter(exercise=>moduleById(exercise.m)?.track===state.practiceTrack);
  const active=trackExercises.find(exercise=>exercise.id===state.exerciseId)||trackExercises[0]||exercises[0];
  state.exerciseId=active.id;
  const m=getModuleForExercise(active);
  const activeTrack=learningTracks.find(track=>track.id===state.practiceTrack)||learningTracks[0];
  const tabs=learningTracks.map(track=>{
    const count=exercises.filter(exercise=>moduleById(exercise.m)?.track===track.id).length;
    return `<button class="track-tab ${track.id===state.practiceTrack?'active':''}" data-practice-track="${track.id}" aria-pressed="${track.id===state.practiceTrack}"><strong>${esc(track.title)}</strong><span>${count} заданий</span></button>`;
  }).join('');
  const list=trackExercises.map((exercise,index)=>`<button class="exercise-item ${exercise.id===active.id?'active':''}" data-exercise="${exercise.id}"><span class="exercise-check">${state.completedExercises.has(exercise.id)?'✓':String(index+1).padStart(2,'0')}</span><span><strong>${esc(exercise.title)}</strong><small>${esc(moduleById(exercise.m).title.split(':')[0])}</small></span></button>`).join('');
  const activeIndex=trackExercises.findIndex(exercise=>exercise.id===active.id);
  return `
  ${pageHead(`ПРАКТИКА · ${esc(activeTrack.title)}`,'Практика','Выбери курс. В списке остаются только задания, связанные с его модулями; результаты и прогресс сохраняются отдельно.')}
  <div class="track-switch practice-course-switch">${tabs}</div>
  ${engineNotice()}
  <div class="exercise-layout"><aside><input class="exercise-filter" id="exercise-search" placeholder="Найти задачу по названию…"><div class="exercise-list" id="exercise-list">${list}</div></aside>
  <section><div class="task-card"><div class="task-meta">ЗАДАНИЕ ${activeIndex+1} ИЗ ${trackExercises.length} · ${esc(m.title)}</div><h2>${esc(active.title)} ${state.completedExercises.has(active.id)?'✓':''}</h2><p>${esc(active.task)}</p>${renderExerciseHints(active)}</div>
  ${renderExerciseQuiz(active)}
  ${editor('','exercise-editor','Напиши SQL-запрос. Эталонное решение скрыто до нажатия «Показать решение».')}
  <div class="editor-actions" style="margin-top:10px"><button class="btn primary" data-action="check-exercise" ${state.engineReady?'':'disabled'}>Проверить решение</button>${(active.mode==='mutation'||active.mode==='transaction')?'':`<button class="btn" data-action="run-exercise" ${state.engineReady?'':'disabled'}>Выполнить запрос</button>`}<button class="btn" data-action="show-solution">Показать решение</button><button class="btn" data-action="reset-db" ${state.engineReady?'':'disabled'}>Сбросить базу</button></div>
  <div id="exercise-feedback"></div><div id="exercise-results"></div>
  <div class="lesson-footer" style="margin-top:16px"><button class="btn" data-action="prev-exercise" ${activeIndex===0?'disabled':''}>← Предыдущее</button><button class="btn" data-action="next-exercise" ${activeIndex===trackExercises.length-1?'disabled':''}>Следующее →</button></div></section></div>`;
}
function editor(value,id,placeholder='') {
 const reset=id==='playground-editor'?'<button class="btn small" data-action="reset-editor">Восстановить пример</button>':'';
 return `<div class="editor-card"><div class="editor-top"><span>SQL EDITOR · POSTGRESQL</span><div class="editor-actions"><button class="btn small" data-action="clear-editor">Очистить</button>${reset}</div></div><textarea class="sql-editor" id="${id}" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="${esc(placeholder)}">${esc(value)}</textarea><div class="editor-bottom"><span>Ctrl + Enter · ${id==='project-editor'?'проверить':'выполнить'} · Tab · отступ</span><span>PostgreSQL · номера строк · подсветка SQL</span></div></div>`;
}
function getEditorValue(id){return state.editors.get(id)?.getValue()??$('#'+id)?.value??'';}
function setEditorValue(id,value){const cm=state.editors.get(id);if(cm){cm.setValue(value);cm.focus();}else{const el=$('#'+id);if(el)el.value=value;}}
function renderRandomTaskPanel() {
  const selected=state.randomTopics.size,active=state.randomTask;
  const topics=sandboxTaskTopics.map(topic=>`<label class="random-topic-option"><input type="checkbox" data-random-topic="${topic.id}" ${state.randomTopics.has(topic.id)?'checked':''}><span>${esc(topic.title)}</span><small>25</small></label>`).join('');
  const taskCard=active?`<div class="random-task-card"><div class="task-meta">${esc(sandboxTaskTopics.find(topic=>topic.id===active.topic)?.title||'SQL')} · ${esc(active.id)}</div><h3>${esc(active.title)}</h3><p>${esc(active.prompt)}</p><details class="hint"><summary>Подсказка</summary><p>${esc(active.hint)}</p></details><details class="hint"><summary>Показать эталонное решение</summary><pre class="random-solution">${esc(active.solution)}</pre><button class="btn small" data-action="insert-random-solution">Вставить решение в редактор</button></details><div id="random-task-feedback"></div><button class="btn primary small" data-action="check-random-task" ${state.engineReady?'':'disabled'}>Проверить мой запрос</button></div>`:'<div class="random-task-empty">Выбери одну или несколько тем и нажми «Случайное задание». Каждое задание можно проверить на текущей учебной базе.</div>';
  return `<section class="random-task-panel"><div class="random-task-head"><div><div class="eyebrow">ТРЕНАЖЁР · ${sandboxTaskCount} ЗАДАНИЙ</div><h2>Случайное задание</h2><p>Выбирай несколько тем одновременно. Задания требуют не только знать конструкции, но и сочетать фильтрацию, JOIN, агрегацию, CTE и оконные функции.</p></div><div class="random-task-actions"><button class="btn small" data-action="select-all-random-topics">Все темы</button><button class="btn small" data-action="clear-random-topics">Снять выбор</button></div></div><div class="random-topic-grid">${topics}</div><div class="random-task-controls"><span>${selected} из ${sandboxTaskTopics.length} тем выбрано</span><button class="btn primary" data-action="new-random-task" ${selected?'':'disabled'}>Случайное задание</button></div>${taskCard}</section>`;
}
function renderPlayground() {
  const val=localStorage.getItem(EDITOR_KEY)||"SELECT status, COUNT(*) AS orders_count\nFROM orders\nGROUP BY status\nORDER BY orders_count DESC;";
  return `
    ${pageHead('SQL LAB · СВОБОДНЫЙ РЕЖИМ','SQL-песочница','Пиши любые запросы к учебной базе. Можно читать и изменять данные, создавать временные таблицы и экспериментировать. Кнопка сброса пересоздаёт учебную схему и данные.')}
    ${engineNotice()}
    <div class="grid-2" style="margin-bottom:14px"><div class="callout"><strong>Подключение:</strong> PostgreSQL в WebAssembly, запущенный внутри браузера. Запросы не отправляются на сервер курса. После перезагрузки песочница создаётся заново.</div><div class="callout"><strong>Горячая клавиша:</strong> Ctrl + Enter выполняет SQL. Для нескольких команд можно вводить их через точку с запятой.</div></div>
    ${renderRandomTaskPanel()}
    ${editor(val,'playground-editor')}
    <div class="editor-actions" style="margin-top:10px"><button class="btn primary" data-action="run-playground" ${state.engineReady?'':'disabled'}>▶ Выполнить SQL</button><button class="btn" data-action="reset-db" ${state.engineReady?'':'disabled'}>Сбросить учебную базу</button><button class="btn" data-action="insert-sample">Вставить пример JOIN</button></div>
    <div id="playground-results"></div>`;
}
function renderSchema() {
  const starterSchema=schema.filter(table=>!['analytics','product'].includes(table.dataset));
  const analyticsSchema=schema.filter(table=>table.dataset==='analytics');
  const productSchema=schema.filter(table=>table.dataset==='product');
  const renderCards=tables=>tables.map(t=>`<div class="schema-card"><div class="schema-card-head"><strong>${esc(t.name)}</strong><small>${t.columns.length} поля</small></div><p>${esc(t.grain)}</p><div class="schema-cols">${t.columns.map(c=>`<div class="schema-col"><strong>${esc(c[0])}</strong><span>${esc(c[1])}</span><em>${esc(c[2])}</em></div>`).join('')}</div></div>`).join('');
  return `
    ${pageHead('DATASET · УЧЕБНАЯ МОДЕЛЬ','Учебная база данных','Три набора для разных задач: компактная стартовая схема, историческая e-commerce модель и отдельные пользовательские события Product Analytics.')}
    <div class="callout" style="margin-bottom:16px"><strong>Стартовый набор:</strong> 9 таблиц с небольшим числом записей. Здесь удобно изучать связи, NULL, JOIN и зерно без сотен строк на экране.</div>
    <div class="schema-grid">${renderCards(starterSchema)}</div>
    <div class="section-row"><h2>Исторический аналитический набор</h2><span>4 таблицы · 36 месяцев · повторные покупки</span></div>
    <div class="callout" style="margin-bottom:16px"><strong>Отдельное зерно:</strong> analytics_orders — одна строка на заказ; analytics_order_items — одна строка на товарную позицию; analytics_order_events — одна строка на событие. Поле refund_amount позволяет считать чистую выручку, не приравнивая сумму заказа к полученным деньгам.</div>
    <div class="schema-grid">${renderCards(analyticsSchema)}</div>
    <div class="section-row"><h2>Событийная модель Product Analytics</h2><span>576 пользовательских сессий</span></div>
    <div class="callout" style="margin-bottom:16px"><strong>Зерно события:</strong> одна запись описывает одно действие пользователя в рамках сессии. События имеют временной порядок от просмотра страницы до покупки; незавершённые воронки сохранены, а не достроены искусственно.</div>
    <div class="schema-grid">${renderCards(productSchema)}</div>
    <div class="section-row"><h2>Быстрые исследовательские запросы</h2><span>Откроются в песочнице</span></div>
    <div class="module-list">
      <div class="module-row" data-sample="SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"><div class="module-number">01</div><div class="module-info"><strong>Посмотреть таблицы</strong><small>information_schema.tables</small></div><span>→</span></div>
      <div class="module-row" data-sample="SELECT o.order_id, s.store_name, c.employee_name, o.status, o.total_amount FROM orders o JOIN stores s ON s.store_id = o.store_id LEFT JOIN employees c ON c.employee_id = o.employee_id ORDER BY o.order_id;"><div class="module-number">02</div><div class="module-info"><strong>Заказы стартового набора</strong><small>INNER JOIN + LEFT JOIN</small></div><span>→</span></div>
      <div class="module-row" data-sample="SELECT DATE_TRUNC('month', created_at)::date AS month, COUNT(*) AS orders, SUM(total_amount - refund_amount) AS net_revenue FROM analytics_orders WHERE status IN ('delivered','shipped','refunded') GROUP BY 1 ORDER BY 1;"><div class="module-number">03</div><div class="module-info"><strong>Чистая выручка по месяцам</strong><small>Отмены и неоплаченные заказы исключены, возвраты вычтены</small></div><span>→</span></div>
      <div class="module-row" data-sample="SELECT customer_id, COUNT(*) AS orders_count, MIN(created_at)::date AS first_order, MAX(created_at)::date AS last_order FROM analytics_orders GROUP BY customer_id HAVING COUNT(*) > 1 ORDER BY orders_count DESC, customer_id LIMIT 20;"><div class="module-number">04</div><div class="module-info"><strong>Повторные покупки клиентов</strong><small>GROUP BY + HAVING + ORDER BY</small></div><span>→</span></div>
    </div>`;
}
function renderReference() {
  return `
    ${pageHead('QUICK REFERENCE','Шпаргалка SQL','Краткий справочник основных конструкций. Это дополнение к урокам, а не замена пониманию порядка выполнения и зерна запроса.')}
    <div class="reference-grid">${reference.map(g=>`<div class="reference-card"><h3>${esc(g.group)}</h3>${g.items.map(x=>`<div class="reference-row"><code>${esc(x[0])}</code><span>${esc(x[1])}</span></div>`).join('')}</div>`).join('')}</div>
    <div class="section-row"><h2>Логический порядок SELECT</h2></div><div class="card"><div class="module-list">${['FROM / JOIN — формирование источника строк','WHERE — фильтрация исходных строк','GROUP BY — формирование групп','HAVING — фильтрация групп','SELECT — вычисление выражений','DISTINCT — устранение дублей','ORDER BY — сортировка результата','LIMIT / OFFSET — ограничение выдачи'].map((x,i)=>`<div class="module-row" style="cursor:default"><div class="module-number">${String(i+1).padStart(2,'0')}</div><div class="module-info"><strong>${esc(x)}</strong></div></div>`).join('')}</div></div>`;
}
function renderGlossary() {
  return `
    ${pageHead('DICTIONARY','Глоссарий SQL','Ключевые термины, которые встречаются в уроках. Ищи термин или часть определения.') }
    <input class="search-input" style="width:100%;margin-bottom:13px" id="glossary-search" placeholder="Например: cardinality, NULL, индекс…">
    <div class="glossary-list" id="glossary-list">${glossary.map(g=>`<div class="glossary-item" data-term="${esc((g[0]+' '+g[1]).toLowerCase())}"><strong>${esc(g[0])}</strong><span>${esc(g[1])}</span></div>`).join('')}</div>`;
}
function bindPage(){
 $$('.sql-editor').forEach(textarea=>{
  if(window.CodeMirror){
   const shortcut=textarea.id==='exercise-editor'?'run-exercise':textarea.id==='project-editor'?'check-project-task':'run-playground';
   const cm=window.CodeMirror.fromTextArea(textarea,{mode:'text/x-pgsql',theme:'material-darker',lineNumbers:true,indentUnit:4,tabSize:4,indentWithTabs:false,lineWrapping:false,matchBrackets:true,viewportMargin:Infinity,extraKeys:{'Ctrl-Enter':()=>handleAction(shortcut),'Cmd-Enter':()=>handleAction(shortcut),'Tab':'indentMore','Shift-Tab':'indentLess'}});
   state.editors.set(textarea.id,cm);
   if(textarea.id==='playground-editor')cm.on('change',instance=>localStorage.setItem(EDITOR_KEY,instance.getValue()));
   if(textarea.id==='project-editor'){const taskId=state.projectTaskId;cm.on('change',instance=>saveProjectDraft(taskId,instance.getValue()));}
   requestAnimationFrame(()=>cm.refresh());
  }else{
   textarea.addEventListener('keydown',editorKeys);
   if(textarea.id==='playground-editor')textarea.addEventListener('input',()=>localStorage.setItem(EDITOR_KEY,textarea.value));
   if(textarea.id==='project-editor'){const taskId=state.projectTaskId;textarea.addEventListener('input',()=>saveProjectDraft(taskId,textarea.value));}
  }
 });
 const exSearch=$('#exercise-search');if(exSearch)exSearch.addEventListener('input',()=>{$$('.exercise-item').forEach(b=>b.style.display=b.textContent.toLowerCase().includes(exSearch.value.toLowerCase())?'flex':'none');});
 const glSearch=$('#glossary-search');if(glSearch)glSearch.addEventListener('input',()=>{$$('.glossary-item').forEach(b=>b.style.display=b.dataset.term.includes(glSearch.value.toLowerCase())?'grid':'none');});
 $$('[data-random-topic]').forEach(input=>input.addEventListener('change',()=>{if(input.checked)state.randomTopics.add(input.dataset.randomTopic);else state.randomTopics.delete(input.dataset.randomTopic);render();}));
}
function editorKeys(e) {
  if(e.key==='Tab'){e.preventDefault();const a=e.target.selectionStart,b=e.target.selectionEnd;e.target.setRangeText('  ',a,b,'end');}
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();handleAction(e.target.id==='exercise-editor'?'run-exercise':e.target.id==='project-editor'?'check-project-task':'run-playground');}
}
function downloadProgressBackup() {
  const backup = createBackup(localStorage);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sql-academy-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Резервная копия скачана.');
}
function prepareImportedBackup(backup) {
  const storage = { ...backup.storage };
  const migrated = migrateProgress(JSON.parse(storage[STORE_KEY] || '{}'), modules).progress;
  const exerciseIds = new Set(exercises.map(exercise => exercise.id));
  migrated.exercises = migrated.exercises.filter(id => exerciseIds.has(id));
  storage[STORE_KEY] = JSON.stringify(migrated);
  const projectIds = new Set(projects.map(project => project.id));
  const taskIds = new Set(projects.flatMap(project => project.tasks.map(task => task.id)));
  const savedProjectTasks = JSON.parse(storage[PROJECT_PROGRESS_KEY] || '[]');
  storage[PROJECT_PROGRESS_KEY] = JSON.stringify([...new Set(savedProjectTasks.filter(id => taskIds.has(id)))]);
  for (const key of [PROJECT_DRAFTS_KEY, PROJECT_NOTES_KEY, PROJECT_REVIEWS_KEY]) {
    const values = JSON.parse(storage[key] || '{}');
    storage[key] = JSON.stringify(Object.fromEntries(Object.entries(values).filter(([id]) =>
      key === PROJECT_DRAFTS_KEY ? taskIds.has(id) : projectIds.has(id)
    )));
  }
  return { ...backup, storage };
}
document.addEventListener('change', async event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.id !== 'backup-import-file') return;
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Размер файла превышает 5 МБ.');
    const backup = parseBackup(await file.text());
    const confirmed = window.confirm(
      'Восстановить резервную копию от ' + new Date(backup.createdAt).toLocaleString() +
      '? Текущий прогресс курсов, черновики и данные проектов будут заменены. Перед восстановлением сохрани текущую копию отдельно.'
    );
    if (!confirmed) return;
    restoreBackup(localStorage, prepareImportedBackup(backup));
    window.location.reload();
  } catch (error) {
    console.error('SQL Academy backup import failed:', error);
    toast('Не удалось восстановить копию: ' + (error?.message || error));
  } finally {
    input.value = '';
  }
});

function handleAction(action) {
  const m=moduleById(state.moduleId)||modules[0];
  const trackModules=moduleLessons(m.track);
  const trackIndex=trackModules.findIndex(module=>module.id===m.id);
  if(action==='export-backup'){downloadProgressBackup();return;}
  if(action==='import-backup'){$('#backup-import-file')?.click();return;}
  if(action==='retry-engine'){initDatabase();return;}
  if(action==='check-project-task'){checkProjectTask();return;}
  if(action==='show-project-solution'){state.projectSolutionVisible=!state.projectSolutionVisible;render();return;}
  if(action==='next-project-task'){
    const project=projects.find(item=>item.id===state.projectId)||projects[0];
    const index=project.tasks.findIndex(task=>task.id===state.projectTaskId);
    if(project.tasks[index+1]){state.projectTaskId=project.tasks[index+1].id;state.projectSolutionVisible=false;render();}
    return;
  }
  if(action==='assessment-back'){state.assessmentModuleId=null;state.assessmentAnswers={};state.assessmentSubmitted=false;render();return;}
  if(action==='assessment-retry'){state.assessmentAnswers={};state.assessmentSubmitted=false;render();return;}
  if(action==='assessment-submit'){
    const assessment=modules.find(module=>module.id===state.assessmentModuleId),bank=assessment?.quiz||[];
    if(!assessment||Object.keys(state.assessmentAnswers).length!==bank.length){toast('Ответь на все вопросы перед отправкой');return;}
    const score=bank.reduce((sum,question,index)=>sum+(state.assessmentAnswers[index]===question.answer?1:0),0);
    const previous=state.assessmentResults[assessment.id]||{attempts:0,bestScore:0,passed:false};
    state.assessmentResults[assessment.id]={attempts:previous.attempts+1,bestScore:Math.max(previous.bestScore,score),passed:previous.passed||score>=Math.ceil(bank.length*0.75)};
    state.assessmentSubmitted=true;saveProgress();render();return;
  }
  if(action==='continue'||action==='open-next'){
    const next=findNextLesson(modules,state.completedLessons);
    if(next){state.moduleId=next.module.id;state.lessonIndex=next.index;go('study');}
    else{state.roadmapTrack='core';go('roadmap');}
    return;
  }
  if(action==='complete-lesson'){const key=lessonKey(state.moduleId,state.lessonIndex);if(state.completedLessons.has(key))state.completedLessons.delete(key);else state.completedLessons.add(key);saveProgress();render();}
  if(action==='prev-lesson'){if(state.lessonIndex>0)state.lessonIndex--;else if(trackIndex>0){state.moduleId=trackModules[trackIndex-1].id;state.lessonIndex=trackModules[trackIndex-1].lessons.length-1;}render();}
  if(action==='next-lesson'){if(state.lessonIndex<m.lessons.length-1)state.lessonIndex++;else if(trackIndex<trackModules.length-1){state.moduleId=trackModules[trackIndex+1].id;state.lessonIndex=0;}render();}
  if(action==='lesson-practice'){const id=m.lessons[state.lessonIndex]?.practiceIds?.[0];if(id){state.exerciseId=id;go('practice');}}
  if(action==='prev-exercise'||action==='next-exercise'){const trackExercises=exercises.filter(exercise=>moduleById(exercise.m)?.track===state.practiceTrack);const i=trackExercises.findIndex(exercise=>exercise.id===state.exerciseId);state.exerciseId=trackExercises[Math.max(0,Math.min(trackExercises.length-1,i+(action==='next-exercise'?1:-1)))].id;render();}
  if(action==='clear-editor')setEditorValue(state.view==='practice'?'exercise-editor':state.view==='project'?'project-editor':'playground-editor','');
  if(action==='reset-editor'){const sample='SELECT status, COUNT(*) AS orders_count\\nFROM orders\\nGROUP BY status\\nORDER BY orders_count DESC;';setEditorValue('playground-editor',sample);localStorage.setItem(EDITOR_KEY,sample);}
  if(action==='show-solution'){const ex=exercises.find(x=>x.id===state.exerciseId);if(ex){setEditorValue('exercise-editor',ex.solution);toast('Эталонное решение показано.');}}
  if(action==='check-exercise')checkExercise();
  if(action==='run-exercise')runEditorQuery(getEditorValue('exercise-editor'),'exercise-results');
  if(action==='new-random-task'){
    const pool=sandboxTaskTopics.filter(topic=>state.randomTopics.has(topic.id)).flatMap(topic=>topic.tasks);
    if(!pool.length){toast('Выбери хотя бы одну тему');return;}
    const candidates=pool.filter(item=>item.id!==state.randomTask?.id);
    state.randomTask=(candidates.length?candidates:pool)[Math.floor(Math.random()*(candidates.length||pool.length))];
    render();return;
  }
  if(action==='select-all-random-topics'){state.randomTopics=new Set(sandboxTaskTopics.map(topic=>topic.id));render();return;}
  if(action==='clear-random-topics'){state.randomTopics.clear();render();return;}
  if(action==='insert-random-solution'&&state.randomTask){setEditorValue('playground-editor',state.randomTask.solution);localStorage.setItem(EDITOR_KEY,state.randomTask.solution);toast('Решение вставлено в редактор');return;}
  if(action==='check-random-task')checkRandomTask();
  if(action==='run-playground'){const val=getEditorValue('playground-editor');localStorage.setItem(EDITOR_KEY,val);runEditorQuery(val,'playground-results');}
  if(action==='reset-db')resetDatabase();
  if(action==='insert-sample'){const sample='SELECT o.order_id, s.store_name, c.employee_name, o.total_amount\\nFROM orders o\\nJOIN stores s ON s.store_id = o.store_id\\nLEFT JOIN employees c ON c.employee_id = o.employee_id\\nORDER BY o.order_id;';setEditorValue('playground-editor',sample);localStorage.setItem(EDITOR_KEY,sample);}
}
async function checkProjectTask(){
  const project=projects.find(item=>item.id===state.projectId);
  const task=project?.tasks.find(item=>item.id===state.projectTaskId);
  const feedback=$('#project-feedback');
  const sql=getEditorValue('project-editor').trim();
  if(!task||!feedback)return;
  if(!state.engineReady||!state.db){feedback.innerHTML='<div class="feedback fail">Проверка станет доступна после запуска PostgreSQL.</div>';return;}
  if(!sql){feedback.innerHTML='<div class="feedback fail">Сначала напиши запрос самостоятельно.</div>';return;}
  try{
    const statements=splitStatements(sql);
    if(statements.length!==1)throw new Error('Для одного шага проекта используй один SELECT или WITH ... SELECT.');
    if(readOnlyQueryKeyword(statements[0])!=='SELECT')throw new Error('Автопроверка проекта принимает только безопасные SELECT-запросы.');
    const [actual,expected]=await Promise.all([state.db.query(statements[0]),state.db.query(task.solution)]);
    const passed=resultMatches(normalizeResult(actual),normalizeResult(expected),Boolean(task.orderMatters));
    if(!passed){
      feedback.innerHTML='<div class="feedback fail"><strong>Результат пока не совпал.</strong><p>Проверь набор строк, столбцы, значения и зерно результата. Запрос выполнился, но бизнес-результат отличается от ожидаемого.</p></div>';
      return;
    }
    const wasCompleted=state.completedProjectTasks.has(task.id);
    state.completedProjectTasks.add(task.id);
    saveProjectProgress();
    const done=project.tasks.filter(item=>state.completedProjectTasks.has(item.id)).length;
    const percent=Math.round(done/project.tasks.length*100);
    $('#project-progress-value').textContent=done+'/'+project.tasks.length+' · '+percent+'%';
    $('#project-progress-fill').style.width=percent+'%';
    const nav=$('#project-task-'+task.id);
    if(nav){nav.classList.add('done');$('.project-task-status',nav).textContent='✓';$('small',nav).textContent='Проверено';}
    feedback.innerHTML='<div class="feedback success"><strong>Верно!</strong><p>Запрос вернул ожидаемый результат. Задание отмечено как выполненное.</p></div>';
    if(done===project.tasks.length){const wrap=$('#project-wrapup');if(wrap)wrap.outerHTML=renderProjectWrapUp(project,true);}
    if(!wasCompleted)toast('Задание проекта пройдено');
  }catch(error){
    feedback.innerHTML='<div class="feedback fail"><strong>Ошибка запроса:</strong><p>'+esc(error.message)+'</p></div>';
  }
}
async function checkRandomTask(){
 const task=state.randomTask,feedback=$('#random-task-feedback'),sql=getEditorValue('playground-editor').trim();
 if(!task||!feedback)return;
 if(!state.engineReady||!state.db){feedback.innerHTML='<div class="feedback fail">Проверка станет доступна после подготовки PostgreSQL.</div>';return;}
 if(!sql){feedback.innerHTML='<div class="feedback fail">Сначала напиши запрос в редакторе.</div>';return;}
 try{
  const parts=splitStatements(sql);
  if(parts.length!==1)throw new Error('Для случайного задания используй один SELECT-запрос.');
  if(readOnlyQueryKeyword(parts[0])!=='SELECT')throw new Error('Проверка случайных заданий принимает только SELECT или WITH ... SELECT. Изменяющие запросы остаются доступны через обычный запуск песочницы.');
  const preserveOrder=Boolean(task.orderMatters);
  const [actual,expected]=await Promise.all([state.db.query(parts[0]),state.db.query(task.solution)]);
  const passed=resultMatches(normalizeResult(actual),normalizeResult(expected),preserveOrder);
  feedback.innerHTML=passed?'<div class="feedback success"><strong>Верно!</strong> Результат совпадает с эталоном.</div>':'<div class="feedback fail"><strong>Пока не совпало.</strong> Запрос выполнился, но набор столбцов, значения или порядок строк отличаются. Проверь зерно результата и условия задачи.</div>';
 }catch(error){feedback.innerHTML='<div class="feedback fail"><strong>Ошибка:</strong> '+esc(error.message)+'</div>';}
}
async function checkExercise() {
  if(!state.engineReady||!state.db){toast('PostgreSQL ещё подготавливает учебную базу и эталонные результаты.');return;}
  const ex=exercises.find(x=>x.id===state.exerciseId),sql=getEditorValue('exercise-editor').trim();
  const feedback=$('#exercise-feedback'),results=$('#exercise-results');
  if(!sql){feedback.innerHTML='<div class="feedback fail">Напиши SQL-запрос перед проверкой.</div>';return;}
  try{
    const parts=splitStatements(sql);
    if(!['transaction','mutation'].includes(ex.mode) && parts.length!==1) throw new Error('В этом задании используй один SQL-запрос.');
    if(ex.mode==='transaction' && parts.length<2) throw new Error('Задание на транзакцию должно содержать несколько команд, разделённых точкой с запятой.');
    const started=performance.now();
    if(ex.mode==='explain') {
      if(firstSqlKeyword(parts[0])!=='EXPLAIN' || !['SELECT','WITH'].includes(explainStatementKeyword(parts[0]))) throw new Error('Для этой задачи используй EXPLAIN перед SELECT или WITH ... SELECT.');
      const explainQuery=explainStatementBody(parts[0]);
      if((ex.requiredPatterns||[]).some(pattern=>!new RegExp(pattern,'i').test(explainQuery))) throw new Error(ex.requirementsMessage||'Запрос не соответствует условию задания. Проверь таблицы, выбранные поля и фильтры.');
      const plan=await state.db.query(parts[0]);
      const elapsed=Math.round(performance.now()-started);
      state.completedExercises.add(ex.id);saveProgress();
      results.innerHTML=renderResult(plan,elapsed);
      feedback.innerHTML='<div class="feedback success"><strong>План построен!</strong> EXPLAIN успешно разобрал заданный запрос. Изучи тип узла, оценку строк и стоимость выполнения.</div>';
      return;
    }
    const expected=state.expected.get(ex.id);
    if(!expected) throw new Error('Эталонный результат для задания не подготовлен.');
    let result, observed, passed;
    if(ex.mode==='mutation' || ex.mode==='transaction') {
      if(ex.mode==='mutation' && parts.some(part=>!['INSERT','UPDATE','DELETE','CREATE','ALTER','DROP','MERGE'].includes(firstSqlKeyword(part)))) throw new Error('Каждая команда в этом задании должна изменять данные или структуру: INSERT, UPDATE, DELETE, CREATE, ALTER, DROP либо MERGE.');
      if(ex.mode==='transaction' && (ex.requiredPatterns||[]).some(pattern=>!new RegExp(pattern,'i').test(sql))) throw new Error('В запросе отсутствует одна из обязательных команд транзакции. Сверься с условием задания.');
      const {PGlite}=await loadPGliteModule();
      const isolatedDb=new PGlite();
      try {
        await isolatedDb.exec(seedSQL);
        if(ex.mode==='transaction') {
          await isolatedDb.exec(sql);
          result={rows:[],fields:[]};
        } else {
          await isolatedDb.exec(sql);
          result={rows:[],fields:[]};
        }
        observed=await isolatedDb.query(ex.checkQuery);
        passed=resultMatches(normalizeResult(observed),expected,ex.orderMatters);
      } finally {
        await isolatedDb.close();
      }
    } else {
      if(readOnlyQueryKeyword(parts[0])!=='SELECT') throw new Error('Это задание ожидает SELECT или WITH ... SELECT. Комментарии перед запросом разрешены; изменяющие команды внутри CTE не допускаются.');
      result=await state.db.query(parts[0]);
      observed=result;
      passed=resultMatches(normalizeResult(observed),expected,ex.orderMatters);
    }
    const elapsed=Math.round(performance.now()-started);
    results.innerHTML=renderResult(result,elapsed)+((ex.mode==='mutation'||ex.mode==='transaction')?renderResult(observed,elapsed):'');
    if(passed){state.completedExercises.add(ex.id);saveProgress();feedback.innerHTML='<div class="feedback success"><strong>Верно!</strong> Результат соответствует условию. Изменения проверялись в отдельной временной базе, поэтому основная учебная база не затронута.</div>';}
    else{feedback.innerHTML='<div class="feedback fail"><strong>Пока не совпало.</strong> Запрос выполнился, но фактический результат отличается от ожидаемого. Проверь условия, столбцы, ограничения, порядок команд и итоговое состояние таблиц.</div>';}
  }catch(err){feedback.innerHTML='<div class="feedback fail"><strong>Ошибка SQL:</strong> '+esc(err.message)+'</div>';results.innerHTML='';}
}
function normalizeResult(result) {
  const valueType = Symbol.for('sql-academy.result-value-type');
  const normalizeValue = value => {
    if(value instanceof Date)return {[valueType]:'date',value:value.toISOString()};
    if(typeof value==='bigint')return {[valueType]:'bigint',value:String(value)};
    if(typeof value==='number'&&!Number.isFinite(value))return {[valueType]:'number',value:String(value)};
    if(ArrayBuffer.isView(value))return {[valueType]:'bytes',value:Array.from(value)};
    if(Array.isArray(value))return value.map(normalizeValue);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,normalizeValue(child)]));
    return value;
  };
  const rows=(result.rows||[]).map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,normalizeValue(value)])));
  let columns=(result.fields||[]).map(field=>field.name);
  if(!columns.length&&rows.length)columns=Object.keys(rows[0]);
  return {columns,rows};
}
function resultMatches(actual,expected,preserveOrder=false) {
  const actualColumns=actual?.columns||[];
  const expectedColumns=expected?.columns||[];
  if(actualColumns.length!==expectedColumns.length)return false;
  if(new Set(actualColumns).size!==actualColumns.length||new Set(expectedColumns).size!==expectedColumns.length)return false;
  const columns=[...actualColumns].sort();
  if(JSON.stringify(columns)!==JSON.stringify([...expectedColumns].sort()))return false;
  const valueType = Symbol.for('sql-academy.result-value-type');
  const canonicalValue = value => {
    if(value===null)return ['null'];
    if(value instanceof Date)return ['date',value.toISOString()];
    if(typeof value==='bigint')return ['bigint',String(value)];
    if(typeof value==='number')return ['number',Number.isFinite(value)?String(value):String(value)];
    if(typeof value==='string')return ['string',value];
    if(typeof value==='boolean')return ['boolean',value];
    if(typeof value==='undefined')return ['undefined'];
    if(Array.isArray(value))return ['array',value.map(canonicalValue)];
    if(value&&typeof value==='object') {
      const taggedType=value[valueType];
      if(taggedType)return [taggedType,canonicalValue(value.value)];
      return ['object',Object.keys(value).sort().map(key=>[key,canonicalValue(value[key])])];
    }
    return [typeof value,String(value)];
  };
  const rowSignatures=result=>(result.rows||[]).map(row=>JSON.stringify(columns.map(column=>Object.prototype.hasOwnProperty.call(row,column)?canonicalValue(row[column]):['missing-column'])));
  const actualRows=rowSignatures(actual),expectedRows=rowSignatures(expected);
  if(actualRows.length!==expectedRows.length)return false;
  if(!preserveOrder){actualRows.sort();expectedRows.sort();}
  return JSON.stringify(actualRows)===JSON.stringify(expectedRows);
}
async function runEditorQuery(sql,target) {
  const host=$('#'+target);if(!host)return;if(!state.engineReady||!state.db){host.innerHTML='<div class="feedback fail">PostgreSQL ещё подготавливает учебную базу.</div>';return;}
  if(!sql.trim()){host.innerHTML='<div class="feedback fail">Редактор пустой. Добавь SQL-запрос.</div>';return;}
  const start=performance.now();
  try{
    const statements=splitStatements(sql);let last=null,html='';
    for(const statement of statements){last=await state.db.query(statement);html+=renderResult(last,Math.round(performance.now()-start));}
    host.innerHTML=html||'<div class="empty-result">Команды выполнены. Результатных строк нет.</div>';
  }catch(err){host.innerHTML='<div class="feedback fail"><strong>PostgreSQL:</strong> '+esc(err.message)+'</div>';}
}
function renderResult(result,elapsed) {
  const normalized=normalizeResult(result),rows=result.rows||[],cols=normalized.columns;
  if(!rows.length)return '<div class="result-panel"><div class="result-head"><strong>Запрос выполнен</strong><small>'+elapsed+' ms · 0 строк</small></div><div class="result-body empty-result">Команда выполнена, но не вернула строки. Для DDL/DML это нормально.</div></div>';
  const table='<table class="result-table"><thead><tr>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(0,500).map(r=>'<tr>'+cols.map(c=>'<td>'+esc(r[c]===null?'NULL':r[c] instanceof Date?r[c].toISOString():r[c])+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  return '<div class="result-panel"><div class="result-head"><strong>Результат запроса</strong><small>'+elapsed+' ms · '+rows.length+' строк'+(rows.length>500?' · показаны первые 500':'')+'</small></div><div class="result-body">'+table+'</div></div>';
}
function resetDatabase() {
  return initDatabase({reset:true});
}
async function prepareExpected() {
  state.expected.clear();
  const failures = [];
  for(const ex of exercises){
    try{
      if(ex.mode==='mutation'){
        await state.db.exec('BEGIN;');
        try {
          await state.db.exec(ex.solution);
          const observed=await state.db.query(ex.checkQuery);
          state.expected.set(ex.id,normalizeResult(observed));
        } finally {
          await state.db.exec('ROLLBACK;');
        }
      } else if(ex.mode==='transaction') {
        const {PGlite}=await loadPGliteModule();
        const isolatedDb=new PGlite();
        try {
          await isolatedDb.exec(seedSQL);
          await isolatedDb.exec(ex.solution);
          const observed=await isolatedDb.query(ex.checkQuery);
          state.expected.set(ex.id,normalizeResult(observed));
        } finally {
          await isolatedDb.close();
        }
      } else {
        const result=await state.db.query(ex.solution);
        state.expected.set(ex.id,normalizeResult(result));
      }
    } catch(err){failures.push(`${ex.id}: ${err.message}`);console.warn('Could not prepare exercise',ex.id,err.message);}
  }
  if (failures.length || state.expected.size !== exercises.length) {
    throw new Error(`Не удалось подготовить эталонные результаты (${state.expected.size}/${exercises.length}). ${failures.join('; ')}`);
  }
}
function rerenderPreservingEditor() {
  const editorId=state.view==='practice'?'exercise-editor':state.view==='playground'?'playground-editor':null;
  const editorValue=editorId&&$('#'+editorId)?getEditorValue(editorId):null;
  render();
  if(editorId&&editorValue!==null)setEditorValue(editorId,editorValue);
}
async function initDatabase({reset=false}={}) {
  if(state.engineLoading)return;
  const retrying=Boolean(state.engineError);
  state.engineLoading=true;
  state.engineReady=false;
  state.engineError=null;
  state.expected.clear();
  const status=$('#engine-status'),pill=$('.engine-pill');
  let stage='загрузка библиотеки PGlite';
  pill.classList.remove('ready','error');
  status.textContent=reset?'Пересоздание учебной базы…':'Запуск PostgreSQL…';
  if(reset||retrying)rerenderPreservingEditor();
  try{
    if(state.db){await state.db.close();state.db=null;}
    const {PGlite}=await loadPGliteModule();
    stage='создание временной базы данных';
    state.db=await PGlite.create({dataDir:'memory://'});
    stage='создание учебных таблиц и данных';
    await state.db.exec(seedSQL);
    stage='подготовка эталонных результатов практики';
    await prepareExpected();
    state.engineReady=true;
    state.engineLoading=false;
    state.engineError=null;
    pill.classList.add('ready');status.textContent='PostgreSQL готов';
    rerenderPreservingEditor();
    if(reset)toast('Учебная база пересоздана.');
  }catch(err){
    console.error('SQL Academy database initialization failed:',stage,err);
    state.engineReady=false;
    state.engineLoading=false;
    if(state.db){try{await state.db.close();}catch{} state.db=null;}
    pill.classList.add('error');status.textContent='Ошибка движка';
    state.engineError={
      stage,
      message:String(err?.message||err),
      detail:String(err?.stack||err?.message||err)
    };
    rerenderPreservingEditor();
  }
}
document.addEventListener('input',event=>{
 const field=event.target.closest('[data-project-conclusion]');
 if(!field)return;
 saveProjectNote(field.dataset.projectConclusion,field.value);
});
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-nav],[data-open-course],[data-open-project],[data-project-task],[data-project-review],[data-practice-track],[data-track],[data-module],[data-assessment-track],[data-assessment-module],[data-assessment-answer],[data-lesson],[data-exercise],[data-action],[data-copy-code],[data-sample],[data-quiz-answer],[data-exercise-quiz-answer]');if(!el)return;
 if(el.dataset.nav){event.preventDefault();go(el.dataset.nav);return;}
 if(el.dataset.openCourse){const track=learningTracks.find(item=>item.id===el.dataset.openCourse);if(track){state.roadmapTrack=track.id;go('roadmap');}return;}
 if(el.dataset.openProject){const project=projects.find(item=>item.id===el.dataset.openProject);if(project){state.projectId=project.id;state.projectTaskId=project.tasks[0].id;state.projectSolutionVisible=false;go('project');}return;}
 if(el.dataset.projectTask){state.projectTaskId=el.dataset.projectTask;state.projectSolutionVisible=false;render();return;}
 if(el.dataset.projectReview){
  const [projectId,choiceText]=el.dataset.projectReview.split(':');
  const project=projects.find(item=>item.id===projectId);
  const choice=Number(choiceText);
  if(!project||!Number.isInteger(choice)||choice<0||choice>=project.wrapUp.review.options.length||Number.isInteger(state.projectReviews[projectId]))return;
  if(project.tasks.every(task=>state.completedProjectTasks.has(task.id))){
   saveProjectReview(projectId,choice);
   const wrap=$('#project-wrapup');
   if(wrap)wrap.outerHTML=renderProjectWrapUp(project,true);
  }
  return;
 }
 if(el.dataset.practiceTrack){const track=learningTracks.find(item=>item.id===el.dataset.practiceTrack);if(track){state.practiceTrack=track.id;const first=exercises.find(exercise=>moduleById(exercise.m)?.track===track.id);if(first)state.exerciseId=first.id;render();}return;}
 if(el.dataset.track){state.roadmapTrack=el.dataset.track;render();return;} if(el.dataset.assessmentTrack){state.assessmentTrack=el.dataset.assessmentTrack;state.assessmentModuleId=null;render();return;}
 if(el.dataset.assessmentModule){state.assessmentModuleId=el.dataset.assessmentModule;state.assessmentAnswers={};state.assessmentSubmitted=false;go('assessment');return;}
 if(el.dataset.assessmentAnswer){if(!state.assessmentSubmitted){const [qi,oi]=el.dataset.assessmentAnswer.split(':').map(Number);state.assessmentAnswers[qi]=oi;render();}return;}
 if(el.dataset.module){state.moduleId=el.dataset.module;state.lessonIndex=0;go('study');return;}
 if(el.dataset.lesson){const [mid,li]=el.dataset.lesson.split(':');state.moduleId=mid;state.lessonIndex=Number(li);render();return;}
 if(el.dataset.exercise){const exercise=exercises.find(item=>item.id===el.dataset.exercise);state.exerciseId=el.dataset.exercise;if(exercise)state.practiceTrack=moduleById(exercise.m)?.track||'core';if(state.view!=='practice')go('practice');else render();return;}
 if(el.dataset.exerciseQuizAnswer!==undefined){
  const option=Number(el.dataset.exerciseQuizAnswer),ex=exercises.find(x=>x.id===state.exerciseId),q=ex?.quiz;
  if(ex&&q){state.exerciseQuizAnswers[ex.id]=option;saveProgress();render();}
  return;
 }
 if(el.dataset.quizAnswer){const [qi,oi]=el.dataset.quizAnswer.split(':').map(Number),q=moduleById(state.moduleId)?.lessons?.[state.lessonIndex]?.quiz?.[qi];if(q){state.quizAnswers[quizKey(state.moduleId,state.lessonIndex,qi)]=oi;saveProgress();render();}return;}
 if(el.dataset.copyCode){const txt=$('pre',el.closest('.code-block'))?.textContent||'';navigator.clipboard?.writeText(txt).then(()=>toast('Пример скопирован')).catch(()=>toast('Не удалось скопировать'));return;}
 if(el.dataset.sample){localStorage.setItem(EDITOR_KEY,el.dataset.sample);go('playground');return;}
 if(el.dataset.action){handleAction(el.dataset.action);return;}
});
function ensureSqlTooltip() {
  if(document.querySelector('.sql-tooltip'))return;
  const tooltip=document.createElement('div'); tooltip.className='sql-tooltip'; tooltip.setAttribute('role','tooltip'); document.body.append(tooltip);
  const hide=()=>tooltip.classList.remove('visible');
  const show=target=>{
    const text=target?.dataset?.tip; if(!text)return; tooltip.textContent=text; tooltip.classList.add('visible');
    const rect=target.getBoundingClientRect(),width=Math.min(320,window.innerWidth-24);
    const left=Math.max(12,Math.min(window.innerWidth-width-12,rect.left+rect.width/2-width/2));
    const above=rect.top>100; tooltip.style.width=width+'px'; tooltip.style.left=left+'px'; tooltip.style.top=(above?rect.top-10:rect.bottom+10)+'px'; tooltip.style.transform=above?'translateY(-100%)':'none';
  };
  document.addEventListener('pointerover',event=>{const target=event.target.closest?.('.sql-tip');if(target)show(target);});
  document.addEventListener('pointerout',event=>{const target=event.target.closest?.('.sql-tip');if(target&&!target.contains(event.relatedTarget))hide();});
  document.addEventListener('focusin',event=>{const target=event.target.closest?.('.sql-tip');if(target)show(target);});
  document.addEventListener('focusout',event=>{if(event.target.closest?.('.sql-tip'))hide();});
  document.addEventListener('click',event=>{const target=event.target.closest?.('.sql-tip');if(target)show(target);else hide();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  window.addEventListener('scroll',hide,true);
}
ensureSqlTooltip();
loadProgress();
loadProjectState();
applyRoute();
const restoreRouteFromLocation = () => {
  applyRoute();
  state.navigationScrollReset=true;
  render();
  if(innerWidth<760)setMobileMenuOpen(false);
  window.scrollTo({top:0,behavior:'instant'});
};
window.addEventListener('popstate',restoreRouteFromLocation);
window.addEventListener('hashchange',restoreRouteFromLocation);
document.documentElement.classList.toggle('light',state.theme==='light');
$('#theme-toggle').addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';document.documentElement.classList.toggle('light',state.theme==='light');localStorage.setItem('sql-academy-theme',state.theme);const meta=$('meta[name="theme-color"]');if(meta)meta.content=state.theme==='light'?'#f3f5fa':'#0a0d14';});
const themeMeta=$('meta[name="theme-color"]');if(themeMeta)themeMeta.content=state.theme==='light'?'#f3f5fa':'#0a0d14';
$('#mobile-menu').addEventListener('click',()=>setMobileMenuOpen(!$('#sidebar').classList.contains('open')));
document.addEventListener('click',e=>{
  if(window.innerWidth<760&&$('#sidebar').classList.contains('open')&&!e.target.closest('#sidebar')&&!e.target.closest('#mobile-menu')){
    setMobileMenuOpen(false);
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('#sidebar').classList.contains('open')){
    setMobileMenuOpen(false,{restoreFocus:true});
    return;
  }
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){
    const active=document.activeElement;
    if(active?.classList.contains('sql-editor'))return;
  }
});
window.addEventListener('resize',()=>{if(window.innerWidth>=760)setMobileMenuOpen(false);});
render();
initDatabase();
