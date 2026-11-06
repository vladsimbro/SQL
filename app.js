import { modules, exercises, glossary, reference, schema, seedSQL } from './curriculum.js';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const STORE_KEY = 'sql-academy-progress-v1';
const EDITOR_KEY = 'sql-academy-editor-v1';
const state = {
  view:'dashboard', moduleId:modules[0].id, lessonIndex:0, exerciseId:exercises[0].id,
  completedLessons:new Set(), completedExercises:new Set(), db:null, expected:new Map(),
  engineReady:false, currentRows:[], theme:localStorage.getItem('sql-academy-theme') || 'dark'
};
const moduleById = id => modules.find(m=>m.id===id);
const lessonTotal = modules.reduce((n,m)=>n+m.lessons.length,0);
const lessonKey = (mid,idx)=>mid+':'+idx;
const esc = value => String(value ?? 'NULL').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
const label = {dashboard:'Главная',roadmap:'Дорожная карта',study:'Учебник',practice:'Практика',playground:'SQL-песочница',schema:'Учебная база',reference:'Шпаргалка',glossary:'Глоссарий'};
const loadProgress = () => {
  try {
    const saved=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
    state.completedLessons=new Set(saved.lessons||[]);
    state.completedExercises=new Set(saved.exercises||[]);
  } catch {}
};
const saveProgress = () => {
  localStorage.setItem(STORE_KEY,JSON.stringify({lessons:[...state.completedLessons],exercises:[...state.completedExercises]}));
  updateProgress();
};
const updateProgress = () => {
  const pct=Math.round(state.completedLessons.size/lessonTotal*100);
  $('#side-progress-label').textContent=pct+'%';
  $('#side-progress-bar').style.width=pct+'%';
  $('#side-progress-detail').textContent=state.completedLessons.size+' из '+lessonTotal+' уроков';
  $('#exercise-count').textContent=exercises.length;
};
const toast = message => {
  const el=document.createElement('div'); el.className='toast'; el.textContent=message; document.body.append(el); setTimeout(()=>el.remove(),2200);
};
const go = view => {
  state.view=view; render();
  if(innerWidth<760) $('#sidebar').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
};
const progressForModule = m => m.lessons.filter((_,i)=>state.completedLessons.has(lessonKey(m.id,i))).length;
const modulePct = m => Math.round(progressForModule(m)/m.lessons.length*100);
const getModuleForExercise = ex => moduleById(ex.m);

function render() {
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===state.view));
  $('#breadcrumb-current').textContent=label[state.view]||'Учебник';
  updateProgress();
  const host=$('#app-content');
  const pages={dashboard:renderDashboard,roadmap:renderRoadmap,study:renderStudy,practice:renderPractice,playground:renderPlayground,schema:renderSchema,reference:renderReference,glossary:renderGlossary};
  host.innerHTML=(pages[state.view]||renderDashboard)();
  bindPage();
}
function pageHead(kicker,title,desc,action='') {
  return `<div class="page-head"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${desc}</p></div>${action}</div>`;
}
function moduleRow(m,index) {
  const done=progressForModule(m),pct=modulePct(m);
  return `<div class="module-row" data-module="${m.id}"><div class="module-number">${String(index+1).padStart(2,'0')}</div><div class="module-info"><strong>${esc(m.title)}</strong><small>${esc(m.desc)}</small></div><div class="module-meta">${done}/${m.lessons.length} · ${pct}%</div><i class="module-status ${pct===100?'done':''}"></i></div>`;
}
function renderDashboard() {
  const totalDone=state.completedLessons.size;
  const next=modules.flatMap(m=>m.lessons.map((l,i)=>({m,l,i}))).find(x=>!state.completedLessons.has(lessonKey(x.m.id,x.i))) || {m:modules.at(-1),l:modules.at(-1).lessons.at(-1),i:modules.at(-1).lessons.length-1};
  const recent=modules.slice(0,5);
  return `
    <section class="hero"><div class="eyebrow">ПОЛНЫЙ МАРШРУТ · ОТ ОСНОВ ДО POSTGRESQL</div><h1>SQL — не набор команд.<br>Это способ думать о данных.</h1><p>Последовательный курс с подробной теорией, примерами, учебной базой на PostgreSQL, 50 задачами с автоматической проверкой и собственной SQL-песочницей.</p><div class="hero-actions"><button class="btn primary" data-action="continue">Продолжить обучение →</button><button class="btn ghost" data-nav="roadmap">Открыть roadmap</button></div></section>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-label">Уроков в программе</span><strong>${lessonTotal}</strong><small>Последовательно, от фундамента</small></div>
      <div class="stat-card"><span class="stat-label">Практических задач</span><strong>${exercises.length}</strong><small>С реальной проверкой SQL</small></div>
      <div class="stat-card"><span class="stat-label">Пройдено уроков</span><strong>${totalDone}</strong><small>Из ${lessonTotal} в программе</small></div>
      <div class="stat-card"><span class="stat-label">Решено задач</span><strong>${state.completedExercises.size}</strong><small>Из ${exercises.length} практических</small></div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="eyebrow">СЛЕДУЮЩИЙ ШАГ</div><div class="continue-card" style="margin-top:12px"><div class="continue-icon">↗</div><div><h3>${esc(next.l.title)}</h3><p>${esc(next.m.title)} · урок ${next.i+1} из ${next.m.lessons.length}</p><button class="btn primary small" data-action="open-next">Открыть урок</button></div></div></div>
      <div class="card"><div class="eyebrow">ОБУЧЕНИЕ В БРАУЗЕРЕ</div><h3 style="margin:8px 0 5px;font-size:15px">Настоящий PostgreSQL, а не имитация</h3><p style="color:var(--muted);font-size:11px;margin:0">Запросы исполняются локально через WebAssembly. Учебная схема уже заполнена данными, а прогресс сохраняется в браузере.</p></div>
    </div>
    <div class="section-row"><h2>Первые этапы roadmap</h2><button class="btn small" data-nav="roadmap">Вся программа →</button></div>
    <div class="module-list">${recent.map((m)=>moduleRow(m,modules.indexOf(m))).join('')}</div>
    <div class="section-row"><h2>Быстрый доступ</h2><span>Рабочие инструменты курса</span></div>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-label">SQL-песочница</span><strong style="font-size:17px">›_</strong><small>Свободные запросы</small><button class="btn small" data-nav="playground" style="margin-top:9px">Открыть</button></div>
      <div class="stat-card"><span class="stat-label">Практика</span><strong style="font-size:17px">50 задач</strong><small>Проверка результата</small><button class="btn small" data-nav="practice" style="margin-top:9px">Решать</button></div>
      <div class="stat-card"><span class="stat-label">Учебная схема</span><strong style="font-size:17px">9 таблиц</strong><small>Интернет-магазин</small><button class="btn small" data-nav="schema" style="margin-top:9px">Изучить</button></div>
      <div class="stat-card"><span class="stat-label">Справочник</span><strong style="font-size:17px">SQL ref</strong><small>Синтаксис и термины</small><button class="btn small" data-nav="reference" style="margin-top:9px">Открыть</button></div>
    </div>`;
}
function renderRoadmap() {
  const groups=new Map();
  modules.forEach((m,i)=>{if(!groups.has(m.stage))groups.set(m.stage,[]);groups.get(m.stage).push({m,i});});
  return pageHead('ПЛАН ОБУЧЕНИЯ','Дорожная карта SQL','Программа выстроена по зависимостям: сначала модель данных и базовая логика, затем запросы, соединения, аналитика, изменение данных, производительность и эксплуатация.')+
  `<div class="callout" style="margin-bottom:20px"><strong>Как проходить курс:</strong> читай уроки по порядку, запускай примеры, выполняй мини-задачу в конце урока и закрепляй тему в разделе «Практика». Не перескакивай к оконным функциям, пока не понимаешь, на каком уровне находятся строки и группы.</div>`+
  [...groups.entries()].map(([stage,items])=>`<section class="roadmap-stage"><div class="roadmap-stage-head"><span>${esc(stage)}</span><h2>${esc(items[0].m.title.split(':')[0])}</h2><small>${items.reduce((n,x)=>n+x.m.lessons.length,0)} уроков</small></div><div class="module-list">${items.map(x=>moduleRow(x.m,x.i)).join('')}</div></section>`).join('');
}
function lessonBody(l) {
  return `<p>${esc(l.body)}</p><h2>Пример</h2><div class="code-block"><div class="code-head"><span>POSTGRESQL</span><button class="btn small" data-copy-code>Копировать</button></div><pre>${esc(l.example)}</pre></div><div class="note-box"><strong>Запомни:</strong> ${esc(l.note)}</div>`;
}
function renderStudy() {
  const m=moduleById(state.moduleId)||modules[0];
  state.lessonIndex=Math.max(0,Math.min(state.lessonIndex,m.lessons.length-1));
  const l=m.lessons[state.lessonIndex],done=state.completedLessons.has(lessonKey(m.id,state.lessonIndex));
  const idx=modules.indexOf(m);
  const sidebar=modules.map((mod,mi)=>`<div style="margin-bottom:13px"><h3 style="color:var(--muted);font-size:10px;margin:0 0 5px">${String(mi+1).padStart(2,'0')} · ${esc(mod.title)}</h3>${mod.lessons.map((x,li)=>`<button class="lesson-nav-item ${mod.id===m.id&&li===state.lessonIndex?'active':''} ${state.completedLessons.has(lessonKey(mod.id,li))?'done':''}" data-lesson="${mod.id}:${li}"><span class="dot">${state.completedLessons.has(lessonKey(mod.id,li))?'✓':'○'}</span>${esc(x.title)}</button>`).join('')}</div>`).join('');
  return `
    ${pageHead('УЧЕБНИК · МОДУЛЬ '+String(idx+1).padStart(2,'0'),m.title,m.desc)}
    <div class="split-layout"><aside class="card lesson-sidebar"><h3>Содержание курса</h3>${sidebar}</aside>
    <article class="lesson-content">
      <div class="lesson-card"><div class="eyebrow">${esc(m.stage)} · УРОК ${state.lessonIndex+1} ИЗ ${m.lessons.length}</div><h1>${esc(l.title)}</h1>${lessonBody(l)}<h2>Проверь понимание</h2><p>Попробуй объяснить эту тему своими словами. Затем измени пример: подставь другую таблицу, фильтр, столбец или значение и запусти запрос в песочнице. Важно не просто получить результат, а понимать, почему каждая строка попала в него.</p><div class="lesson-footer"><button class="btn" data-action="lesson-practice">Задачи по теме →</button><button class="btn primary" data-action="complete-lesson">${done?'✓ Урок завершён':'Отметить урок завершённым'}</button></div></div>
      <div class="lesson-card"><div class="eyebrow">КОНТРОЛЬНЫЕ ВОПРОСЫ</div><h2>Что нужно уметь после урока</h2><ul><li>Дать определение ключевым понятиям темы без заучивания текста.</li><li>Объяснить, на каком этапе запроса применяется изученная конструкция.</li><li>Предсказать результат на маленьком примере до запуска SQL.</li><li>Найти типичную ошибку и объяснить, почему она возникает.</li></ul><div class="note-box">Привычка прогнозировать результат до выполнения запроса — один из самых полезных навыков в SQL.</div><div class="lesson-footer"><button class="btn" data-action="prev-lesson" ${state.lessonIndex===0?'disabled':''}>← Предыдущий урок</button><button class="btn primary" data-action="next-lesson">${state.lessonIndex===m.lessons.length-1?'Следующий модуль →':'Следующий урок →'}</button></div></div>
    </article></div>`;
}
function renderPractice() {
  const active=exercises.find(e=>e.id===state.exerciseId)||exercises[0];
  const m=getModuleForExercise(active);
  const list=exercises.map((e,i)=>`<button class="exercise-item ${e.id===active.id?'active':''}" data-exercise="${e.id}"><span class="exercise-check">${state.completedExercises.has(e.id)?'✓':String(i+1).padStart(2,'0')}</span><span><strong>${esc(e.title)}</strong><small>${esc(moduleById(e.m).title.split(':')[0])}</small></span></button>`).join('');
  return `
  ${pageHead('ПРАКТИКА · ${exercises.length} ЗАДАНИЙ','Закрепляй SQL руками','Каждое задание проверяется сравнением результата твоего запроса с эталонным результатом, рассчитанным на той же учебной базе. Порядок строк не учитывается, если он не меняет состав результата.')}
  <div class="exercise-layout"><aside><input class="exercise-filter" id="exercise-search" placeholder="Найти задачу по названию…"><div class="exercise-list" id="exercise-list">${list}</div></aside>
  <section><div class="task-card"><div class="task-meta">ЗАДАНИЕ ${exercises.indexOf(active)+1} ИЗ ${exercises.length} · ${esc(m.title)}</div><h2>${esc(active.title)} ${state.completedExercises.has(active.id)?'✓':''}</h2><p>${esc(active.task)}</p><details class="hint"><summary>Показать подсказку</summary><p>Сначала определи зерно результата: что означает одна строка? Затем выбери нужные таблицы, условия, группировку и сортировку. Не копируй решение целиком, пока не попробовал сам.</p></details></div>
  ${editor(active.solution,'exercise-editor','Здесь напиши свой SQL-запрос…')}
  <div class="editor-actions" style="margin-top:10px"><button class="btn primary" data-action="check-exercise">Проверить решение</button>${active.mode==='mutation'?'':'<button class="btn" data-action="run-exercise">Выполнить запрос</button>'}<button class="btn" data-action="show-solution">Показать решение</button><button class="btn" data-action="reset-db">Сбросить базу</button></div>
  <div id="exercise-feedback"></div><div id="exercise-results"></div>
  <div class="lesson-footer" style="margin-top:16px"><button class="btn" data-action="prev-exercise">← Предыдущее</button><button class="btn" data-action="next-exercise">Следующее →</button></div></section></div>`;
}
function editor(value,id,placeholder='') {
  return `<div class="editor-card"><div class="editor-top"><span>SQL EDITOR · POSTGRESQL</span><div class="editor-actions"><button class="btn small" data-action="clear-editor">Очистить</button><button class="btn small" data-action="reset-editor">Восстановить пример</button></div></div><textarea class="sql-editor" id="${id}" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="${esc(placeholder)}">${esc(value)}</textarea><div class="editor-bottom"><span>Ctrl + Enter · выполнить запрос</span><span>Учебная база · локальный PostgreSQL</span></div></div>`;
}
function renderPlayground() {
  const val=localStorage.getItem(EDITOR_KEY)||"SELECT status, COUNT(*) AS orders_count\nFROM orders\nGROUP BY status\nORDER BY orders_count DESC;";
  return `
    ${pageHead('SQL LAB · СВОБОДНЫЙ РЕЖИМ','SQL-песочница','Пиши любые запросы к учебной базе. Можно читать и изменять данные, создавать временные таблицы и экспериментировать. Кнопка сброса пересоздаёт учебную схему и данные.')}
    <div class="grid-2" style="margin-bottom:14px"><div class="callout"><strong>Подключение:</strong> PostgreSQL в WebAssembly, запущенный внутри браузера. Запросы не отправляются на сервер курса. После перезагрузки песочница создаётся заново.</div><div class="callout"><strong>Горячая клавиша:</strong> Ctrl + Enter выполняет SQL. Для нескольких команд можно вводить их через точку с запятой.</div></div>
    ${editor(val,'playground-editor')}
    <div class="editor-actions" style="margin-top:10px"><button class="btn primary" data-action="run-playground">▶ Выполнить SQL</button><button class="btn" data-action="reset-db">Сбросить учебную базу</button><button class="btn" data-action="insert-sample">Вставить пример JOIN</button></div>
    <div id="playground-results"></div>`;
}
function renderSchema() {
  return `
    ${pageHead('DATASET · УЧЕБНАЯ МОДЕЛЬ','Учебная база данных','Учебная система интернет-магазина с заказами, магазинами, сотрудниками, клиентами, товарами и событиями заказов. Схема специально содержит NULL, магазин без заказов, клиентов без покупок и связь один-ко-многим.')}
    <div class="callout" style="margin-bottom:16px"><strong>Важное зерно:</strong> orders — одна строка на заказ; order_items — одна строка на товарную позицию; payments — одна строка на операцию оплаты; order_events — одна строка на событие. При JOIN этих таблиц строки могут размножаться.</div>
    <div class="schema-grid">${schema.map(t=>`<div class="schema-card"><div class="schema-card-head"><strong>${esc(t.name)}</strong><small>${t.columns.length} поля</small></div><p>${esc(t.grain)}</p><div class="schema-cols">${t.columns.map(c=>`<div class="schema-col"><strong>${esc(c[0])}</strong><span>${esc(c[1])}</span><em>${esc(c[2])}</em></div>`).join('')}</div></div>`).join('')}</div>
    <div class="section-row"><h2>Быстрые исследовательские запросы</h2><span>Откроются в песочнице</span></div>
    <div class="module-list"><div class="module-row" data-sample="SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"><div class="module-number">01</div><div class="module-info"><strong>Посмотреть таблицы</strong><small>information_schema.tables</small></div><span>→</span></div><div class="module-row" data-sample="SELECT o.order_id, s.store_name, c.employee_name, o.status, o.total_amount FROM orders o JOIN stores s ON s.store_id = o.store_id LEFT JOIN employees c ON c.employee_id = o.employee_id ORDER BY o.order_id;"><div class="module-number">02</div><div class="module-info"><strong>Заказы с магазинами и сотрудниками</strong><small>INNER JOIN + LEFT JOIN</small></div><span>→</span></div><div class="module-row" data-sample="SELECT o.order_id, o.total_amount, SUM(oi.quantity * oi.unit_price) AS items_amount FROM orders o JOIN order_items oi ON oi.order_id = o.order_id GROUP BY o.order_id, o.total_amount ORDER BY o.order_id;"><div class="module-number">03</div><div class="module-info"><strong>Сравнить сумму заказа и товарные позиции</strong><small>Опасность двойного счёта</small></div><span>→</span></div></div>`;
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
function bindPage() {
  $$('[data-nav]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.nav)));
  $$('[data-module]').forEach(b=>b.addEventListener('click',()=>{state.moduleId=b.dataset.module;state.lessonIndex=0;go('study');}));
  $$('[data-lesson]').forEach(b=>b.addEventListener('click',()=>{const [mid,li]=b.dataset.lesson.split(':');state.moduleId=mid;state.lessonIndex=Number(li);render();}));
  $$('[data-exercise]').forEach(b=>b.addEventListener('click',()=>{state.exerciseId=b.dataset.exercise;render();}));
  $$('[data-action]').forEach(b=>b.addEventListener('click',()=>handleAction(b.dataset.action)));
  $$('[data-copy-code]').forEach(b=>b.addEventListener('click',()=>{const txt=$('pre',b.closest('.code-block')).textContent;navigator.clipboard?.writeText(txt).then(()=>toast('Пример скопирован')).catch(()=>toast('Не удалось скопировать'));}));
  $$('[data-sample]').forEach(b=>b.addEventListener('click',()=>{localStorage.setItem(EDITOR_KEY,b.dataset.sample);go('playground');}));
  const exSearch=$('#exercise-search'); if(exSearch) exSearch.addEventListener('input',()=>{$$('.exercise-item').forEach(b=>b.style.display=b.textContent.toLowerCase().includes(exSearch.value.toLowerCase())?'flex':'none');});
  const glSearch=$('#glossary-search'); if(glSearch) glSearch.addEventListener('input',()=>{$$('.glossary-item').forEach(b=>b.style.display=b.dataset.term.includes(glSearch.value.toLowerCase())?'grid':'none');});
  const ed=$('#playground-editor'); if(ed){ed.addEventListener('input',()=>localStorage.setItem(EDITOR_KEY,ed.value));ed.addEventListener('keydown',editorKeys);}
  const ee=$('#exercise-editor'); if(ee) ee.addEventListener('keydown',editorKeys);
}
function editorKeys(e) {
  if(e.key==='Tab'){e.preventDefault();const a=e.target.selectionStart,b=e.target.selectionEnd;e.target.setRangeText('  ',a,b,'end');}
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();handleAction(e.target.id==='exercise-editor'?'run-exercise':'run-playground');}
}
function handleAction(action) {
  const m=moduleById(state.moduleId)||modules[0];
  if(action==='continue'||action==='open-next'){const next=modules.flatMap(x=>x.lessons.map((l,i)=>({m:x,i}))).find(x=>!state.completedLessons.has(lessonKey(x.m.id,x.i)))||{m:modules[0],i:0};state.moduleId=next.m.id;state.lessonIndex=next.i;go('study');}
  if(action==='complete-lesson'){const key=lessonKey(state.moduleId,state.lessonIndex);if(state.completedLessons.has(key))state.completedLessons.delete(key);else state.completedLessons.add(key);saveProgress();render();}
  if(action==='prev-lesson'){if(state.lessonIndex>0)state.lessonIndex--;else{const i=modules.indexOf(m);if(i>0){state.moduleId=modules[i-1].id;state.lessonIndex=modules[i-1].lessons.length-1;}}render();}
  if(action==='next-lesson'){if(state.lessonIndex<m.lessons.length-1)state.lessonIndex++;else{const i=modules.indexOf(m);if(i<modules.length-1){state.moduleId=modules[i+1].id;state.lessonIndex=0;}}render();}
  if(action==='lesson-practice'){const ex=exercises.find(x=>x.m===state.moduleId);if(ex){state.exerciseId=ex.id;go('practice');}else{go('practice');}}
  if(action==='prev-exercise'||action==='next-exercise'){const i=exercises.findIndex(x=>x.id===state.exerciseId);state.exerciseId=exercises[Math.max(0,Math.min(exercises.length-1,i+(action==='next-exercise'?1:-1)))].id;render();}
  if(action==='clear-editor'){const el=$('#'+(state.view==='practice'?'exercise-editor':'playground-editor'));if(el)el.value='';}
  if(action==='reset-editor'){const ex=exercises.find(x=>x.id===state.exerciseId);const el=$('#exercise-editor');if(el&&ex)el.value=ex.solution;}
  if(action==='show-solution'){const ex=exercises.find(x=>x.id===state.exerciseId);if(ex){$('#exercise-editor').value=ex.solution;toast('Решение вставлено в редактор. Разбери его по частям.');}}
  if(action==='check-exercise')checkExercise();
  if(action==='run-exercise')runEditorQuery($('#exercise-editor')?.value,'exercise-results');
  if(action==='run-playground'){const val=$('#playground-editor')?.value||'';localStorage.setItem(EDITOR_KEY,val);runEditorQuery(val,'playground-results');}
  if(action==='reset-db')resetDatabase();
  if(action==='insert-sample'){const ed=$('#playground-editor');if(ed){ed.value='SELECT o.order_id, s.store_name, c.employee_name, o.total_amount\nFROM orders o\nJOIN stores s ON s.store_id = o.store_id\nLEFT JOIN employees c ON c.employee_id = o.employee_id\nORDER BY o.order_id;';localStorage.setItem(EDITOR_KEY,ed.value);}}
}
async function checkExercise() {
  if(!state.db){toast('База ещё загружается');return;}
  const ex=exercises.find(x=>x.id===state.exerciseId),sql=$('#exercise-editor')?.value.trim()||'';
  const feedback=$('#exercise-feedback'),results=$('#exercise-results');
  if(!sql){feedback.innerHTML='<div class="feedback fail">Напиши SQL-запрос перед проверкой.</div>';return;}
  try{
    const parts=splitStatements(sql);
    if(parts.length!==1) throw new Error('В проверяемом упражнении используй один SQL-запрос.');
    const started=performance.now();
    if(ex.mode==='query') {
      if(!/^\\s*EXPLAIN\\s+(SELECT|WITH)\\b/i.test(parts[0])) throw new Error('Для этой задачи используй EXPLAIN перед SELECT или WITH ... SELECT.');
      const plan=await state.db.query(parts[0]);
      const elapsed=Math.round(performance.now()-started);
      state.completedExercises.add(ex.id);saveProgress();
      results.innerHTML=renderResult(plan,elapsed);
      feedback.innerHTML='<div class="feedback success"><strong>План построен!</strong> EXPLAIN успешно разобрал запрос и вернул план PostgreSQL. Обрати внимание на тип узла, оценку строк и стоимость выполнения.</div>';
      return;
    }
    const expected=state.expected.get(ex.id);
    if(!expected) throw new Error('Эталонный результат для задания не подготовлен.');
    let result, observed, passed;
    if(ex.mode==='mutation') {
      if(!/^\\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|MERGE)\\b/i.test(parts[0])) throw new Error('Для этой задачи нужна команда изменения данных или структуры: INSERT, UPDATE, DELETE, CREATE, ALTER, DROP либо MERGE.');
      const {PGlite}=await import('https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.15/dist/index.js');
      const isolatedDb=new PGlite();
      try {
        await isolatedDb.exec(seedSQL);
        await isolatedDb.exec('BEGIN;');
        try {
          result=await isolatedDb.query(parts[0]);
          observed=await isolatedDb.query(ex.checkQuery);
          passed=JSON.stringify(normalizeResult(observed))===JSON.stringify(expected);
        } finally {
          await isolatedDb.exec('ROLLBACK;');
        }
      } finally {
        await isolatedDb.close();
      }
    } else {
      if(ex.mode==='query' && !/^\\s*EXPLAIN\\s+(SELECT|WITH)\\b/i.test(parts[0])) throw new Error('Для этой задачи используй EXPLAIN перед SELECT или WITH ... SELECT.');
      if(ex.mode!=='query' && !/^\\s*(SELECT|WITH)\\b/i.test(parts[0])) throw new Error('Автопроверка этого задания принимает SELECT или WITH ... SELECT.');
      result=await state.db.query(parts[0]);
      observed=result;
      passed=JSON.stringify(normalizeResult(observed))===JSON.stringify(expected);
    }
    const elapsed=Math.round(performance.now()-started);
    results.innerHTML=renderResult(result,elapsed)+(ex.mode==='mutation'?renderResult(observed,elapsed):'');
    if(passed){state.completedExercises.add(ex.id);saveProgress();feedback.innerHTML='<div class="feedback success"><strong>Верно!</strong> Изменение соответствует условию. Для проверки оно было выполнено в отдельной временной базе и затем отменено, поэтому общая учебная база не изменилась.</div>';}
    else{feedback.innerHTML='<div class="feedback fail"><strong>Пока не совпало.</strong> Запрос выполнился, но фактическое состояние таблицы отличается от ожидаемого. Проверь условие WHERE, нужные столбцы, ограничения и число изменённых строк.</div>';}
  }catch(err){feedback.innerHTML='<div class="feedback fail"><strong>Ошибка SQL:</strong> '+esc(err.message)+'</div>';results.innerHTML='';}
}
function normalizeResult(result) {
  const rows=(result.rows||[]).map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v instanceof Date?v.toISOString():typeof v==='bigint'?String(v):v])));
  const columns=rows.length?Object.keys(rows[0]):(result.fields||[]).map(f=>f.name);
  rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {columns,rows};
}
function splitStatements(sql) {
  const out=[];let cur='',single=false,dbl=false,line=false,block=false;
  for(let i=0;i<sql.length;i++){const c=sql[i],n=sql[i+1];if(line){cur+=c;if(c==='\n')line=false;continue;}if(block){cur+=c;if(c==='*'&&n==='/'){cur+=n;i++;block=false;}continue;}if(!single&&!dbl&&c==='-'&&n==='-'){cur+=c+n;i++;line=true;continue;}if(!single&&!dbl&&c==='/'&&n==='*'){cur+=c+n;i++;block=true;continue;}if(c==="'"&&!dbl){if(single&&n==="'"){cur+=c+n;i++;continue;}single=!single;}else if(c==='"'&&!single)dbl=!dbl;if(c===';'&&!single&&!dbl){if(cur.trim())out.push(cur.trim());cur='';}else cur+=c;}
  if(cur.trim())out.push(cur.trim());return out;
}
async function runEditorQuery(sql,target) {
  const host=$('#'+target);if(!host)return;if(!state.db){host.innerHTML='<div class="feedback fail">PostgreSQL ещё загружается.</div>';return;}
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
async function resetDatabase() {
  const button=$('[data-action="reset-db"]');if(button){button.disabled=true;button.textContent='Сброс…';}
  try{if(state.db)await state.db.close();const {PGlite}=await import('https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.15/dist/index.js');state.db=new PGlite();await state.db.exec(seedSQL);await prepareExpected();toast('Учебная база пересоздана.');}
  catch(err){console.error(err);toast('Не удалось пересоздать базу: '+err.message);}
  finally{if(button){button.disabled=false;button.textContent='Сбросить базу';}}
}
async function prepareExpected() {
  state.expected.clear();
  for(const ex of exercises){
    try{
      if(ex.mode==='mutation'){
        await state.db.exec('BEGIN;');
        try {
          await state.db.query(ex.solution);
          const observed=await state.db.query(ex.checkQuery);
          state.expected.set(ex.id,normalizeResult(observed));
        } finally {
          await state.db.exec('ROLLBACK;');
        }
      } else {
        const result=await state.db.query(ex.solution);
        state.expected.set(ex.id,normalizeResult(result));
      }
    } catch(err){console.warn('Could not prepare exercise',ex.id,err.message);}
  }
}
async function initDatabase() {
  const status=$('#engine-status'),pill=$('.engine-pill');
  try{
    const {PGlite}=await import('https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.15/dist/index.js');
    state.db=new PGlite();
    await state.db.exec(seedSQL);
    await prepareExpected();
    state.engineReady=true;pill.classList.add('ready');status.textContent='PostgreSQL готов';
    render();
  }catch(err){
    pill.classList.add('error');status.textContent='Ошибка движка';
    $('#app-content').innerHTML='<div class="empty-state"><h2>Не удалось запустить PostgreSQL</h2><p>'+esc(err.message)+'</p><p>Проверь интернет-соединение: PGlite загружается с CDN при первом запуске.</p><button class="btn primary" id="retry-engine">Повторить запуск</button></div>';
    $('#retry-engine').addEventListener('click',initDatabase);
  }
}
loadProgress();
document.documentElement.classList.toggle('light',state.theme==='light');
$('#theme-toggle').addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';document.documentElement.classList.toggle('light',state.theme==='light');localStorage.setItem('sql-academy-theme',state.theme);});
$('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
document.addEventListener('click',e=>{if(innerWidth<760&&$('#sidebar').classList.contains('open')&&!e.target.closest('#sidebar')&&!e.target.closest('#mobile-menu'))$('#sidebar').classList.remove('open');});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){const active=document.activeElement;if(active?.classList.contains('sql-editor'))return;}});
initDatabase();
