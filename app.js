import { modules, learningTracks, exercises, glossary, reference, schema, seedSQL } from './curriculum.js?v=20261107-61';
import { sandboxTaskTopics, sandboxTaskCount } from './sandbox-tasks.js?v=20261107-61';
import { firstSqlKeyword, explainStatementKeyword, splitStatements, readOnlyQueryKeyword } from './sql-utils.js?v=20261107-61';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const STORE_KEY = 'sql-academy-progress-v1';
const EDITOR_KEY = 'sql-academy-editor-v1';
const state = {
  view:'dashboard', moduleId:modules[0].id, lessonIndex:0, exerciseId:exercises[0].id, roadmapTrack:'core',
  completedLessons:new Set(), completedExercises:new Set(), db:null, expected:new Map(), randomTask:null, randomTopics:new Set(sandboxTaskTopics.map(topic=>topic.id)),
  engineReady:false, currentRows:[], quizAnswers:{}, exerciseQuizAnswers:{}, editors:new Map(), navigationScrollReset:false, theme:localStorage.getItem('sql-academy-theme') || 'dark'
};
const moduleById = id => modules.find(m=>m.id===id);
const lessonTotal = modules.reduce((n,m)=>n+m.lessons.length,0);
const lessonKey = (mid,idx)=>moduleById(mid)?.lessons[idx]?.id || mid+':'+idx;
const quizKey = (mid,idx,questionIndex)=>lessonKey(mid,idx)+':'+questionIndex;
const moduleLessons = trackId => modules.filter(module=>module.track===trackId);
const esc = value => String(value ?? 'NULL').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
const label = {dashboard:'Главная',roadmap:'Дорожная карта',study:'Учебник',practice:'Практика',playground:'SQL-песочница',schema:'Учебная база',reference:'Шпаргалка',glossary:'Глоссарий'};
const loadProgress = () => {
  try {
    const saved=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
    const stableIds=new Set(modules.flatMap(module=>module.lessons.map(lesson=>lesson.id)));
    const legacyIds=new Map(modules.flatMap(module=>module.lessons.map((lesson,index)=>[module.id+':'+index,lesson.id])));
    const migrateLessonId=value=>stableIds.has(value)?value:legacyIds.get(value);
    const lessons=(saved.lessons||[]).map(migrateLessonId).filter(Boolean);
    state.completedLessons=new Set(lessons);
    state.completedExercises=new Set(saved.exercises||[]);
    const quizAnswers={};
    for(const [key,value] of Object.entries(saved.quizAnswers||{})){
      const parts=key.split(':');
      if(parts.length===3){
        const stableId=legacyIds.get(parts[0]+':'+parts[1]);
        quizAnswers[stableId?stableId+':'+parts[2]:key]=value;
      }else quizAnswers[key]=value;
    }
    state.quizAnswers=quizAnswers;
    state.exerciseQuizAnswers=saved.exerciseQuizAnswers||{};
    if(JSON.stringify(saved.lessons||[])!==JSON.stringify(lessons)||JSON.stringify(saved.quizAnswers||{})!==JSON.stringify(quizAnswers)){
      localStorage.setItem(STORE_KEY,JSON.stringify({lessons,exercises:[...state.completedExercises],quizAnswers,exerciseQuizAnswers:state.exerciseQuizAnswers}));
    }
  } catch {}
};
const saveProgress = () => {
  localStorage.setItem(STORE_KEY,JSON.stringify({lessons:[...state.completedLessons],exercises:[...state.completedExercises],quizAnswers:state.quizAnswers,exerciseQuizAnswers:state.exerciseQuizAnswers}));
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
  state.navigationScrollReset=true;
  state.view=view; render();
  if(innerWidth<760) $('#sidebar').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
};
const progressForModule = m => m.lessons.filter((_,i)=>state.completedLessons.has(lessonKey(m.id,i))).length;
const modulePct = m => Math.round(progressForModule(m)/m.lessons.length*100);
const getModuleForExercise = ex => moduleById(ex.m);

function render() {
  const host=$('#app-content'),preserveScroll=!state.navigationScrollReset,windowY=preserveScroll?window.scrollY:0;
  const sidebarScroll=preserveScroll?($('.lesson-sidebar')?.scrollTop||0):0,exerciseScroll=preserveScroll?($('.exercise-list')?.scrollTop||0):0;
  for(const cm of state.editors.values()){try{cm.toTextArea();}catch{}}
  state.editors.clear();
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===state.view));
  $('#breadcrumb-current').textContent=label[state.view]||'Учебник';
  updateProgress();
  const pages={dashboard:renderDashboard,roadmap:renderRoadmap,study:renderStudy,practice:renderPractice,playground:renderPlayground,schema:renderSchema,reference:renderReference,glossary:renderGlossary};
  host.innerHTML=(pages[state.view]||renderDashboard)();
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
  const totalDone=state.completedLessons.size;
  const core=moduleLessons('core'),extra=moduleLessons('postgresql');
  const sequence=[...core,...extra];
  const next=sequence.flatMap(m=>m.lessons.map((l,i)=>({m,l,i}))).find(x=>!state.completedLessons.has(lessonKey(x.m.id,x.i))) || {m:core.at(-1),l:core.at(-1).lessons.at(-1),i:core.at(-1).lessons.length-1};
  const recent=core.slice(0,5);
  return `
    <section class="hero"><div class="eyebrow">ОСНОВНОЙ МАРШРУТ · JUNIOR DATA ANALYST</div><h1>SQL — не набор команд.<br>Это способ думать о данных.</h1><p>Основной курс ведёт от реляционной модели к самостоятельной аналитике. Отдельный маршрут помогает глубже изучить PostgreSQL без обязательной задержки на администрировании.</p><div class="hero-actions"><button class="btn primary" data-action="continue">Продолжить обучение →</button><button class="btn ghost" data-nav="roadmap">Открыть roadmap</button></div></section>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-label">Уроков в программе</span><strong>${lessonTotal}</strong><small>Основной и дополнительный маршруты</small></div>
      <div class="stat-card"><span class="stat-label">Практических задач</span><strong>${exercises.length}</strong><small>С реальной проверкой SQL</small></div>
      <div class="stat-card"><span class="stat-label">Пройдено уроков</span><strong>${totalDone}</strong><small>Из ${lessonTotal} во всей программе</small></div>
      <div class="stat-card"><span class="stat-label">Решено задач</span><strong>${state.completedExercises.size}</strong><small>Из ${exercises.length} практических</small></div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="eyebrow">СЛЕДУЮЩИЙ ШАГ</div><div class="continue-card" style="margin-top:12px"><div class="continue-icon">↗</div><div><h3>${esc(next.l.title)}</h3><p>${esc(next.m.title)} · урок ${next.i+1} из ${next.m.lessons.length}</p><button class="btn primary small" data-action="open-next">Открыть урок</button></div></div></div>
      <div class="card"><div class="eyebrow">ОБУЧЕНИЕ В БРАУЗЕРЕ</div><h3 style="margin:8px 0 5px;font-size:15px">Настоящий PostgreSQL, а не имитация</h3><p style="color:var(--muted);font-size:11px;margin:0">Запросы исполняются локально через WebAssembly. Учебная схема уже заполнена данными, а прогресс сохраняется в браузере.</p></div>
    </div>
    <div class="section-row"><h2>Основной маршрут</h2><button class="btn small" data-nav="roadmap">Вся программа →</button></div>
    <div class="module-list">${recent.map((m)=>moduleRow(m,modules.indexOf(m))).join('')}</div>
    <div class="section-row"><h2>Быстрый доступ</h2><span>Рабочие инструменты курса</span></div>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-label">SQL-песочница</span><strong style="font-size:17px">›_</strong><small>Свободные запросы</small><button class="btn small" data-nav="playground" style="margin-top:9px">Открыть</button></div>
      <div class="stat-card"><span class="stat-label">Практика</span><strong style="font-size:17px">${exercises.length} задач</strong><small>Проверка результата</small><button class="btn small" data-nav="practice" style="margin-top:9px">Решать</button></div>
      <div class="stat-card"><span class="stat-label">Учебная схема</span><strong style="font-size:17px">9 таблиц</strong><small>Интернет-магазин</small><button class="btn small" data-nav="schema" style="margin-top:9px">Изучить</button></div>
      <div class="stat-card"><span class="stat-label">Справочник</span><strong style="font-size:17px">SQL ref</strong><small>Синтаксис и термины</small><button class="btn small" data-nav="reference" style="margin-top:9px">Открыть</button></div>
    </div>`;
}
function renderRoadmap() {
  const selected=learningTracks.find(track=>track.id===state.roadmapTrack)||learningTracks[0];
  const selectedModules=moduleLessons(selected.id);
  const groups=new Map();
  selectedModules.forEach((module,index)=>{if(!groups.has(module.stage))groups.set(module.stage,[]);groups.get(module.stage).push({module,index});});
  const trackTabs=learningTracks.map(track=>`<button class="track-tab ${track.id===selected.id?'active':''}" data-track="${track.id}" aria-pressed="${track.id===selected.id}"><strong>${esc(track.title)}</strong><span>${esc(track.subtitle)}</span><small>${moduleLessons(track.id).length} модулей · ${moduleLessons(track.id).reduce((sum,module)=>sum+module.lessons.length,0)} уроков</small></button>`).join('');
  return pageHead('ПЛАН ОБУЧЕНИЯ','Дорожная карта SQL','Два маршрута с разными целями: сначала аналитический SQL, затем углублённое изучение PostgreSQL.')+
  `<div class="track-switch">${trackTabs}</div><div class="track-intro"><div class="eyebrow">${selected.required?'ОСНОВНОЙ МАРШРУТ':'ДОПОЛНИТЕЛЬНЫЙ МАРШРУТ'}</div><h2>${esc(selected.subtitle)}</h2><p>${esc(selected.description)}</p></div>`+
  `<div class="callout" style="margin-bottom:20px"><strong>Как проходить курс:</strong> изучай темы по порядку, запускай примеры и решай самостоятельные задания. Дополнительный маршрут не блокирует прохождение основной программы аналитика.</div>`+
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
  if(token==='SET') return /\bUPDATE\s+[\w."]+\s*$/i.test(before);
  if(token==='OVER'||token==='FILTER') return /^\s*\(/.test(after);
  if(token==='ROWS'||token==='RANGE') return /\b(?:BETWEEN|PRECEDING|FOLLOWING|CURRENT ROW)\b/i.test(source);
  if(token==='EXISTS') return /^\s*\(/.test(after);
  if(token==='IN') return /^\s*\(/.test(after);
  if(token==='ANALYZE') return /^\s*(?:\(|SELECT|WITH)/i.test(after) || /\bEXPLAIN\s*$/i.test(before);
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
 ${bank.map((q,index)=>{const key=quizKey(state.moduleId,state.lessonIndex,index),selected=state.quizAnswers[key],answered=selected!==undefined,correct=selected===q.answer;
 return `<div class="quiz-question"><div class="quiz-question-title"><span>ВОПРОС ${index+1} ИЗ ${bank.length}</span><strong>${esc(q.question)}</strong></div><div class="quiz-options">${q.options.map((opt,oi)=>`<button class="quiz-option ${answered&&oi===selected?(correct?'correct':'incorrect'):''} ${answered&&correct&&oi===q.answer?'answer-key':''}" data-quiz-answer="${index}:${oi}" ${answered&&correct?'disabled':''}><span class="quiz-radio">${String.fromCharCode(65+oi)}</span><span>${esc(opt)}</span></button>`).join('')}</div>${answered?`<div class="quiz-feedback ${correct?'correct':'incorrect'}"><strong>${correct?'Верно!':'Пока нет.'}</strong> ${esc(q.explanation)}${!correct?' Попробуй ещё раз, опираясь на объяснение выше.':''}</div>`:''}</div>`;}).join('')}
 <div class="quiz-summary">${bank.every((q,index)=>state.quizAnswers[quizKey(state.moduleId,state.lessonIndex,index)]===q.answer)?'<strong>Проверка пройдена.</strong>':'Ответь на вопрос, чтобы закрепить материал.'}</div></section>`;
}
function renderStudy() {
 const m=moduleById(state.moduleId)||modules[0];state.lessonIndex=Math.max(0,Math.min(state.lessonIndex,m.lessons.length-1));
 const l=m.lessons[state.lessonIndex],done=state.completedLessons.has(lessonKey(m.id,state.lessonIndex)),trackEnd=moduleLessons(m.track).at(-1)?.id===m.id&&state.lessonIndex===m.lessons.length-1;
 const sidebar=learningTracks.map(track=>`<section class="lesson-track-group"><h3>${esc(track.title)}</h3><p>${esc(track.subtitle)}</p>${moduleLessons(track.id).map(mod=>`<div style="margin-bottom:13px"><h4>${String(mod.trackOrder).padStart(2,'0')} · ${esc(mod.title)}</h4>${mod.lessons.map((lesson,li)=>`<button class="lesson-nav-item ${mod.id===m.id&&li===state.lessonIndex?'active':''} ${state.completedLessons.has(lessonKey(mod.id,li))?'done':''}" data-lesson="${mod.id}:${li}"><span class="dot">${state.completedLessons.has(lessonKey(mod.id,li))?'✓':'○'}</span>${esc(lesson.title)}</button>`).join('')}</div>`).join('')}</section>`).join('');
 const practice=(l.practiceIds||[]).map(id=>{const ex=exercises.find(e=>e.id===id);return ex?`<button class="btn" data-exercise="${ex.id}">Практика: ${esc(ex.title)} →</button>`:''}).join('');
 const outcomes=(l.outcomes||[]).length?`<div class="lesson-card"><div class="eyebrow">РЕЗУЛЬТАТ УРОКА</div><h2>Что ты должен уметь</h2><ul>${l.outcomes.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div>`:'';
 return `${pageHead((m.track==='core'?'ОСНОВНОЙ МАРШРУТ':'POSTGRESQL ГЛУБЖЕ')+' · МОДУЛЬ '+String(m.trackOrder).padStart(2,'0'),m.title,m.desc)}<div class="split-layout"><aside class="card lesson-sidebar"><h3>Содержание курса</h3>${sidebar}</aside><article class="lesson-content">
 <div class="lesson-card"><div class="eyebrow">${esc(m.stage)} · УРОК ${state.lessonIndex+1} ИЗ ${m.lessons.length}</div><h1>${esc(l.title)}</h1>${lessonBody(l,m)}${renderLessonQuiz(l)}${practice?`<div class="lesson-footer lesson-practice-links">${practice}</div>`:''}<div class="lesson-footer"><button class="btn primary" data-action="complete-lesson">${done?'✓ Урок завершён':'Отметить урок завершённым'}</button></div></div>${outcomes}
 <div class="lesson-card"><div class="lesson-footer"><button class="btn" data-action="prev-lesson" ${state.lessonIndex===0?'disabled':''}>← Предыдущий урок</button><button class="btn primary" data-action="next-lesson" ${trackEnd?'disabled':''}>${trackEnd?(m.track==='core'?'Основной маршрут завершён':'Дополнительный маршрут завершён'):state.lessonIndex===m.lessons.length-1?'Следующий модуль →':'Следующий урок →'}</button></div></div></article></div>`;
}
function renderExerciseQuiz(ex) {
 const q=ex.quiz;if(!q)return '';const selected=state.exerciseQuizAnswers[ex.id],answered=selected!==undefined,correct=selected===q.answer;
 return `<section class="exercise-quiz"><div class="eyebrow">ПРОВЕРЬ ПОНЯТИЕ ПЕРЕД ПРАКТИКОЙ</div><strong class="exercise-quiz-question">${esc(q.question)}</strong><div class="quiz-options">${q.options.map((option,oi)=>`<button class="quiz-option ${answered&&oi===selected?(correct?'correct':'incorrect'):''}" data-exercise-quiz-answer="${oi}" ${answered&&correct?'disabled':''}><span class="quiz-radio">${String.fromCharCode(65+oi)}</span><span>${esc(option)}</span></button>`).join('')}</div>${answered?`<div class="quiz-feedback ${correct?'correct':'incorrect'}"><strong>${correct?'Верно!':'Не совсем.'}</strong> ${esc(q.explanation)}</div>`:''}</section>`;
}
function renderPractice() {
  const active=exercises.find(e=>e.id===state.exerciseId)||exercises[0];
  const m=getModuleForExercise(active);
  const list=exercises.map((e,i)=>`<button class="exercise-item ${e.id===active.id?'active':''}" data-exercise="${e.id}"><span class="exercise-check">${state.completedExercises.has(e.id)?'✓':String(i+1).padStart(2,'0')}</span><span><strong>${esc(e.title)}</strong><small>${esc(moduleById(e.m).title.split(':')[0])}</small></span></button>`).join('');
  return `
  ${pageHead(`ПРАКТИКА · ${exercises.length} ЗАДАНИЙ`,'Закрепляй SQL руками','Каждое задание проверяется сравнением результата твоего запроса с эталонным результатом, рассчитанным на той же учебной базе. Порядок строк не учитывается, если он не меняет состав результата.')}
  <div class="exercise-layout"><aside><input class="exercise-filter" id="exercise-search" placeholder="Найти задачу по названию…"><div class="exercise-list" id="exercise-list">${list}</div></aside>
  <section><div class="task-card"><div class="task-meta">ЗАДАНИЕ ${exercises.indexOf(active)+1} ИЗ ${exercises.length} · ${esc(m.title)}</div><h2>${esc(active.title)} ${state.completedExercises.has(active.id)?'✓':''}</h2><p>${esc(active.task)}</p><details class="hint"><summary>Показать подсказку</summary><p>Сначала определи зерно результата: что означает одна строка? Затем выбери нужные таблицы, условия, группировку и сортировку. Не копируй решение целиком, пока не попробовал сам.</p></details></div>
  ${renderExerciseQuiz(active)}
  ${editor('','exercise-editor','Напиши SQL-запрос. Эталонное решение скрыто до нажатия «Показать решение».')}
  <div class="editor-actions" style="margin-top:10px"><button class="btn primary" data-action="check-exercise">Проверить решение</button>${(active.mode==='mutation'||active.mode==='transaction')?'':'<button class="btn" data-action="run-exercise">Выполнить запрос</button>'}<button class="btn" data-action="show-solution">Показать решение</button><button class="btn" data-action="reset-db">Сбросить базу</button></div>
  <div id="exercise-feedback"></div><div id="exercise-results"></div>
  <div class="lesson-footer" style="margin-top:16px"><button class="btn" data-action="prev-exercise">← Предыдущее</button><button class="btn" data-action="next-exercise">Следующее →</button></div></section></div>`;
}
function editor(value,id,placeholder='') {
 const reset=id==='playground-editor'?'<button class="btn small" data-action="reset-editor">Восстановить пример</button>':'';
 return `<div class="editor-card"><div class="editor-top"><span>SQL EDITOR · POSTGRESQL</span><div class="editor-actions"><button class="btn small" data-action="clear-editor">Очистить</button>${reset}</div></div><textarea class="sql-editor" id="${id}" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="${esc(placeholder)}">${esc(value)}</textarea><div class="editor-bottom"><span>Ctrl + Enter · выполнить · Tab · отступ</span><span>PostgreSQL · номера строк · подсветка SQL</span></div></div>`;
}
function getEditorValue(id){return state.editors.get(id)?.getValue()??$('#'+id)?.value??'';}
function setEditorValue(id,value){const cm=state.editors.get(id);if(cm){cm.setValue(value);cm.focus();}else{const el=$('#'+id);if(el)el.value=value;}}
function formatSql(sql){
 let text=String(sql||'').trim().replace(/[ \t]+/g,' ');
 if(!text)return '';
 const clauses=['UNION ALL','LEFT JOIN','RIGHT JOIN','FULL JOIN','INNER JOIN','CROSS JOIN','GROUP BY','ORDER BY','UNION','INTERSECT','EXCEPT','RETURNING','FROM','WHERE','HAVING','JOIN','ON','SET','VALUES','LIMIT','OFFSET'];
 const pattern=new RegExp('\s+('+clauses.map(x=>x.replace(/ /g,'\s+')).join('|')+')\\b','gi');
 text=text.replace(pattern,(_,kw)=>'\n'+kw.toUpperCase());
 text=text.replace(/,\s*/g,',\n    ');
 text=text.replace(/\nON\b/g,'\n  ON');
 text=text.replace(/^SELECT\s+/i,'SELECT\n    ');
 text=text.replace(/\s+(AND|OR)\s+/gi,(_,kw)=>'\n    '+kw.toUpperCase()+' ');
 return text;
}
function renderRandomTaskPanel() {
  const selected=state.randomTopics.size,active=state.randomTask;
  const topics=sandboxTaskTopics.map(topic=>`<label class="random-topic-option"><input type="checkbox" data-random-topic="${topic.id}" ${state.randomTopics.has(topic.id)?'checked':''}><span>${esc(topic.title)}</span><small>25</small></label>`).join('');
  const taskCard=active?`<div class="random-task-card"><div class="task-meta">${esc(sandboxTaskTopics.find(topic=>topic.id===active.topic)?.title||'SQL')} · ${esc(active.id)}</div><h3>${esc(active.title)}</h3><p>${esc(active.prompt)}</p><details class="hint"><summary>Подсказка</summary><p>${esc(active.hint)}</p></details><details class="hint"><summary>Показать эталонное решение</summary><pre class="random-solution">${esc(active.solution)}</pre><button class="btn small" data-action="insert-random-solution">Вставить решение в редактор</button></details><div id="random-task-feedback"></div><button class="btn primary small" data-action="check-random-task">Проверить мой запрос</button></div>`:'<div class="random-task-empty">Выбери одну или несколько тем и нажми «Случайное задание». Каждое задание можно проверить на текущей учебной базе.</div>';
  return `<section class="random-task-panel"><div class="random-task-head"><div><div class="eyebrow">ТРЕНАЖЁР · ${sandboxTaskCount} ЗАДАНИЙ</div><h2>Случайное задание</h2><p>Выбирай несколько тем одновременно. Задания требуют не только знать конструкции, но и сочетать фильтрацию, JOIN, агрегацию, CTE и оконные функции.</p></div><div class="random-task-actions"><button class="btn small" data-action="select-all-random-topics">Все темы</button><button class="btn small" data-action="clear-random-topics">Снять выбор</button></div></div><div class="random-topic-grid">${topics}</div><div class="random-task-controls"><span>${selected} из ${sandboxTaskTopics.length} тем выбрано</span><button class="btn primary" data-action="new-random-task" ${selected?'':'disabled'}>Случайное задание</button></div>${taskCard}</section>`;
}
function renderPlayground() {
  const val=localStorage.getItem(EDITOR_KEY)||"SELECT status, COUNT(*) AS orders_count\nFROM orders\nGROUP BY status\nORDER BY orders_count DESC;";
  return `
    ${pageHead('SQL LAB · СВОБОДНЫЙ РЕЖИМ','SQL-песочница','Пиши любые запросы к учебной базе. Можно читать и изменять данные, создавать временные таблицы и экспериментировать. Кнопка сброса пересоздаёт учебную схему и данные.')}
    <div class="grid-2" style="margin-bottom:14px"><div class="callout"><strong>Подключение:</strong> PostgreSQL в WebAssembly, запущенный внутри браузера. Запросы не отправляются на сервер курса. После перезагрузки песочница создаётся заново.</div><div class="callout"><strong>Горячая клавиша:</strong> Ctrl + Enter выполняет SQL. Для нескольких команд можно вводить их через точку с запятой.</div></div>
    ${renderRandomTaskPanel()}
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
function bindPage(){
 $$('.sql-editor').forEach(textarea=>{
  if(window.CodeMirror){
   const cm=window.CodeMirror.fromTextArea(textarea,{mode:'text/x-pgsql',theme:'material-darker',lineNumbers:true,indentUnit:4,tabSize:4,indentWithTabs:false,lineWrapping:false,matchBrackets:true,viewportMargin:Infinity,extraKeys:{'Ctrl-Enter':()=>handleAction(textarea.id==='exercise-editor'?'run-exercise':'run-playground'),'Cmd-Enter':()=>handleAction(textarea.id==='exercise-editor'?'run-exercise':'run-playground'),'Tab':'indentMore','Shift-Tab':'indentLess'}});
   state.editors.set(textarea.id,cm);
   if(textarea.id==='playground-editor')cm.on('change',instance=>localStorage.setItem(EDITOR_KEY,instance.getValue()));
   requestAnimationFrame(()=>cm.refresh());
  }else{textarea.addEventListener('keydown',editorKeys);if(textarea.id==='playground-editor')textarea.addEventListener('input',()=>localStorage.setItem(EDITOR_KEY,textarea.value));}
 });
 const exSearch=$('#exercise-search');if(exSearch)exSearch.addEventListener('input',()=>{$$('.exercise-item').forEach(b=>b.style.display=b.textContent.toLowerCase().includes(exSearch.value.toLowerCase())?'flex':'none');});
 const glSearch=$('#glossary-search');if(glSearch)glSearch.addEventListener('input',()=>{$$('.glossary-item').forEach(b=>b.style.display=b.dataset.term.includes(glSearch.value.toLowerCase())?'grid':'none');});
 $$('[data-random-topic]').forEach(input=>input.addEventListener('change',()=>{if(input.checked)state.randomTopics.add(input.dataset.randomTopic);else state.randomTopics.delete(input.dataset.randomTopic);render();}));
}
function editorKeys(e) {
  if(e.key==='Tab'){e.preventDefault();const a=e.target.selectionStart,b=e.target.selectionEnd;e.target.setRangeText('  ',a,b,'end');}
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();handleAction(e.target.id==='exercise-editor'?'run-exercise':'run-playground');}
}
function handleAction(action) {
  const m=moduleById(state.moduleId)||modules[0];
  const trackModules=moduleLessons(m.track);
  const trackIndex=trackModules.findIndex(module=>module.id===m.id);
  if(action==='continue'||action==='open-next'){const core=moduleLessons('core');const next=core.flatMap(module=>module.lessons.map((lesson,index)=>({module,index}))).find(item=>!state.completedLessons.has(lessonKey(item.module.id,item.index)))||{module:core.at(-1),index:core.at(-1).lessons.length-1};state.moduleId=next.module.id;state.lessonIndex=next.index;go('study');}
  if(action==='complete-lesson'){const key=lessonKey(state.moduleId,state.lessonIndex);if(state.completedLessons.has(key))state.completedLessons.delete(key);else state.completedLessons.add(key);saveProgress();render();}
  if(action==='prev-lesson'){if(state.lessonIndex>0)state.lessonIndex--;else if(trackIndex>0){state.moduleId=trackModules[trackIndex-1].id;state.lessonIndex=trackModules[trackIndex-1].lessons.length-1;}render();}
  if(action==='next-lesson'){if(state.lessonIndex<m.lessons.length-1)state.lessonIndex++;else if(trackIndex<trackModules.length-1){state.moduleId=trackModules[trackIndex+1].id;state.lessonIndex=0;}render();}
  if(action==='lesson-practice'){const id=m.lessons[state.lessonIndex]?.practiceIds?.[0];if(id){state.exerciseId=id;go('practice');}}
  if(action==='prev-exercise'||action==='next-exercise'){const i=exercises.findIndex(x=>x.id===state.exerciseId);state.exerciseId=exercises[Math.max(0,Math.min(exercises.length-1,i+(action==='next-exercise'?1:-1)))].id;render();}
  if(action==='clear-editor')setEditorValue(state.view==='practice'?'exercise-editor':'playground-editor','');
  if(action==='reset-editor'){const sample='SELECT status, COUNT(*) AS orders_count\\nFROM orders\\nGROUP BY status\\nORDER BY orders_count DESC;';setEditorValue('playground-editor',sample);localStorage.setItem(EDITOR_KEY,sample);}
  if(action==='show-solution'){const ex=exercises.find(x=>x.id===state.exerciseId);if(ex){setEditorValue('exercise-editor',formatSql(ex.solution));toast('Эталонное решение показано.');}}
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
async function checkRandomTask(){
 const task=state.randomTask,feedback=$('#random-task-feedback'),sql=getEditorValue('playground-editor').trim();
 if(!task||!feedback)return;
 if(!sql){feedback.innerHTML='<div class="feedback fail">Сначала напиши запрос в редакторе.</div>';return;}
 try{
  const parts=splitStatements(sql);
  if(parts.length!==1)throw new Error('Для случайного задания используй один SELECT-запрос.');
  if(readOnlyQueryKeyword(parts[0])!=='SELECT')throw new Error('Проверка случайных заданий принимает только SELECT или WITH ... SELECT. Изменяющие запросы остаются доступны через обычный запуск песочницы.');
  const [actual,expected]=await Promise.all([state.db.query(parts[0]),state.db.query(task.solution)]);
  const passed=JSON.stringify(normalizeResult(actual))===JSON.stringify(normalizeResult(expected));
  feedback.innerHTML=passed?'<div class="feedback success"><strong>Верно!</strong> Результат совпадает с эталоном.</div>':'<div class="feedback fail"><strong>Пока не совпало.</strong> Запрос выполнился, но набор столбцов, значения или порядок строк отличаются. Проверь зерно результата и условия задачи.</div>';
 }catch(error){feedback.innerHTML='<div class="feedback fail"><strong>Ошибка:</strong> '+esc(error.message)+'</div>';}
}
async function checkExercise() {
  if(!state.db){toast('База ещё загружается');return;}
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
      const explainQuery=parts[0].replace(/^EXPLAIN(?:\s*\([^)]*\))?\s*/i,'');
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
      const {PGlite}=await import('https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.15/dist/index.js');
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
        passed=JSON.stringify(normalizeResult(observed,ex.orderMatters))===JSON.stringify(expected);
      } finally {
        await isolatedDb.close();
      }
    } else {
      if(readOnlyQueryKeyword(parts[0])!=='SELECT') throw new Error('Это задание ожидает SELECT или WITH ... SELECT. Комментарии перед запросом разрешены; изменяющие команды внутри CTE не допускаются.');
      result=await state.db.query(parts[0]);
      observed=result;
      passed=JSON.stringify(normalizeResult(observed,ex.orderMatters))===JSON.stringify(expected);
    }
    const elapsed=Math.round(performance.now()-started);
    results.innerHTML=renderResult(result,elapsed)+((ex.mode==='mutation'||ex.mode==='transaction')?renderResult(observed,elapsed):'');
    if(passed){state.completedExercises.add(ex.id);saveProgress();feedback.innerHTML='<div class="feedback success"><strong>Верно!</strong> Результат соответствует условию. Изменения проверялись в отдельной временной базе, поэтому основная учебная база не затронута.</div>';}
    else{feedback.innerHTML='<div class="feedback fail"><strong>Пока не совпало.</strong> Запрос выполнился, но фактический результат отличается от ожидаемого. Проверь условия, столбцы, ограничения, порядок команд и итоговое состояние таблиц.</div>';}
  }catch(err){feedback.innerHTML='<div class="feedback fail"><strong>Ошибка SQL:</strong> '+esc(err.message)+'</div>';results.innerHTML='';}
}
function normalizeResult(result,preserveOrder=false) {
  const rows=(result.rows||[]).map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v instanceof Date?v.toISOString():typeof v==='bigint'?String(v):v])));
  const columns=rows.length?Object.keys(rows[0]):(result.fields||[]).map(f=>f.name);
  if(!preserveOrder)rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {columns,rows};
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
          await state.db.exec(ex.solution);
          const observed=await state.db.query(ex.checkQuery);
          state.expected.set(ex.id,normalizeResult(observed));
        } finally {
          await state.db.exec('ROLLBACK;');
        }
      } else if(ex.mode==='transaction') {
        const {PGlite}=await import('https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.15/dist/index.js');
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
        state.expected.set(ex.id,normalizeResult(result,ex.orderMatters));
      }
    } catch(err){console.warn('Could not prepare exercise',ex.id,err.message);}
  }
}
async function initDatabase() {
  const status=$('#engine-status'),pill=$('.engine-pill');
  let stage='загрузка библиотеки PGlite';
  pill.classList.remove('ready','error');
  status.textContent='Запуск PostgreSQL…';
  try{
    const {PGlite}=await import('https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.15/dist/index.js');
    stage='создание временной базы данных';
    state.db=await PGlite.create({dataDir:'memory://'});
    stage='создание учебных таблиц и данных';
    await state.db.exec(seedSQL);
    stage='подготовка эталонных результатов практики';
    await prepareExpected();
    state.engineReady=true;pill.classList.add('ready');status.textContent='PostgreSQL готов';
    stage='отрисовка интерфейса после запуска базы';
    render();
  }catch(err){
    console.error('SQL Academy database initialization failed:',stage,err);
    state.engineReady=false;
    if(state.db){try{await state.db.close();}catch{} state.db=null;}
    pill.classList.add('error');status.textContent='Ошибка движка';
    const detail=esc(err?.stack||err?.message||String(err));
    $('#app-content').innerHTML='<div class="empty-state"><h2>Не удалось запустить PostgreSQL</h2><p><strong>Этап:</strong> '+esc(stage)+'</p><p>'+detail+'</p><p>Проверь подключение к CDN только если не загрузилась библиотека. Если ошибка возникла на другом этапе, это уже проблема инициализации базы, а не интернет-соединения.</p><button class="btn primary" id="retry-engine">Повторить запуск</button></div>';
    $('#retry-engine').addEventListener('click',initDatabase);
  }
}
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-nav],[data-track],[data-module],[data-lesson],[data-exercise],[data-action],[data-copy-code],[data-sample],[data-quiz-answer],[data-exercise-quiz-answer]');if(!el)return;
 if(el.dataset.nav){event.preventDefault();go(el.dataset.nav);return;}
 if(el.dataset.track){state.roadmapTrack=el.dataset.track;render();return;}
 if(el.dataset.module){state.moduleId=el.dataset.module;state.lessonIndex=0;go('study');return;}
 if(el.dataset.lesson){const [mid,li]=el.dataset.lesson.split(':');state.moduleId=mid;state.lessonIndex=Number(li);render();return;}
 if(el.dataset.exercise){state.exerciseId=el.dataset.exercise;if(state.view!=='practice')go('practice');else render();return;}
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
document.documentElement.classList.toggle('light',state.theme==='light');
$('#theme-toggle').addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';document.documentElement.classList.toggle('light',state.theme==='light');localStorage.setItem('sql-academy-theme',state.theme);const meta=$('meta[name="theme-color"]');if(meta)meta.content=state.theme==='light'?'#f3f5fa':'#0a0d14';});
const themeMeta=$('meta[name="theme-color"]');if(themeMeta)themeMeta.content=state.theme==='light'?'#f3f5fa':'#0a0d14';
$('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
document.addEventListener('click',e=>{if(innerWidth<760&&$('#sidebar').classList.contains('open')&&!e.target.closest('#sidebar')&&!e.target.closest('#mobile-menu'))$('#sidebar').classList.remove('open');});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){const active=document.activeElement;if(active?.classList.contains('sql-editor'))return;}});
initDatabase();
