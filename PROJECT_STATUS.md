# SQL Academy — project status

Last verified: 2026-11-08

## CURRENT

- **Release baseline:** этапы 0–6 завершены; Stage 7 (About metadata) остаётся с одной ручной операцией, но это не блокирует развитие платформы.
- **Current development:** расширение платформы по модели самостоятельных курсов и отдельного раздела проектов. Не начинать повторно аудит, базовые уроки SQL или Stage 3.
- **Last completed:** реализован каталог двух самостоятельных курсов — «SQL для аналитика данных» и «PostgreSQL». Программы, уроки, индикатор прогресса и списки практики переключаются по текущему курсу; боковая панель урока показывает только активный курс. Существующие lesson/exercise IDs и localStorage progress сохранены. Пустые курсы Excel, Power BI и Statistics не отображаются. Все 29 не-main refs удалены, в GitHub API осталась только `main`; архивный AUDIT.md удалён, итоговый review сохранён здесь.
- **Current main SHA:** проверять непосредственно в GitHub при каждой передаче контекста. Не фиксировать SHA текущего HEAD в handoff: обновление этого файла само создаёт новый commit.
- **App build:** 20261108-98.
- **Latest full validation + deployment:** workflow 42514802784 — success for code snapshot at commit 1cee484. Validate job 128835360043, deploy job 128835428724 and browser-smoke job 128835530690 — all success.
- **Curriculum verification:** 25 modules, 173 lessons, 100 knowledge checks, 72 glossary terms, 13 reference groups, 102 exercises, 350 random tasks across 14 topics; 114 read-only lesson examples executed and 81 expected-result tables checked. Existing lesson IDs and progress migration tests remain in place.
- **Live browser verification:** course catalog shows exactly two implemented courses; opening SQL and PostgreSQL lessons isolates the sidebar to the active course; practice tabs filter tasks and keep previous/next within the selected course; the progress indicator follows the selected course. Existing PGlite retry, editor persistence, real SQL execution, mobile navigation and 320/390 px checks passed.
- **Latest live browser smoke:** shell 480 ms; recovery after failed PGlite import 6900 ms; database reset 5864 ms; SQL execution, editor persistence, mobile menu, focus restoration, 390 px and 320 px layouts all passed. Timings are environment-dependent diagnostics, not performance guarantees.
- **Remaining external setting:** GitHub About is still empty (description=null, homepage=null, topics=[]). The connected GitHub actions do not expose repository-metadata write operations. This is a manual repository Settings item, not a blocker for course/project development. All 29 non-main refs are deleted; live branches API returns only `main`.
- **Handoff update:** a status-only change skips the custom validate/deploy/browser-smoke workflow. GitHub Pages may still run its separate managed Jekyll build/deploy; this happened for handoff commit 8a14e19f and succeeded (run 42506417303).

## STAGES

| Stage | Status | Evidence / remaining |
|---|---|---|
| 0. Сверка состояния и сохранение прогресса | DONE | Проверены main, HEAD, структура, Actions, Pages и список веток. PROJECT_STATUS.md используется как handoff; перед продолжением факты повторно сверяются с GitHub. |
| 1. Надёжность основного функционала | DONE | Исправлены знаменатель основного прогресса и переход core → PostgreSQL; проверки 0/112, 112/112, независимости optional route и миграции прогресса. UI end-to-end проверка относится к этапу 6/7. |
| 2. Структура и логика учебной программы | DONE | 25 модулей: 17 модулей / 112 уроков SQL для аналитика данных и 8 / 61 PostgreSQL. Каталог показывает их как два самостоятельных курса с описанием аудитории, уровня и предварительных знаний; прогресс и программа изолированы по курсу. |
| 3. Качество и содержание уроков | DONE | Все 173 урока имеют обязательные материалы; 42 уникальных пошаговых сценария, включая NULL и fan-out. Исправлены SQL-подсказки для aliased UPDATE и EXPLAIN ANALYZE. CI проверяет 114 исполняемых read-only примеров и 81 таблицу ожидаемых результатов. |
| 4. Практика, валидатор и контроль знаний | DONE | 102 обычных задания (списки и навигация разделены по курсам, IDs и общий механизм проверки сохранены), 350 случайных задач в 14 темах, 100 модульных вопросов. Comparator сохраняет типы значений, набор столбцов, кратность строк и заданный условием порядок; допускает перестановку столбцов и строк, когда это несущественно. Execution-based PGlite-проверки покрывают SELECT/CTE, JOIN/pre-aggregation, correlated subquery/LEFT JOIN, IN/EXISTS, NOT IN с NULL, EXCEPT/INTERSECT, UNION/UNION ALL, FILTER/CASE, GROUPING SETS/UNION ALL, оконные CTE, ROWS/RANGE и другие зафиксированные эквивалентности. Отдельно проверяются отрицательные случаи, где запросы неэквивалентны. 95 random tasks и 12 обычных упражнений явно order-sensitive. 100 вопросов контрольных работ сбалансированы 25/25/25/25. |
| 5. Учебные данные и аналитические сценарии | DONE | Добавлены 4 отдельные аналитические таблицы: `analytics_customers`, `analytics_orders`, `analytics_order_items`, `analytics_order_events`; 48 клиентов, 1 158 заказов за 36 месяцев (2023–2025), повторные покупки, статусы, отмены, полные/частичные возвраты и журнал событий. Стартовый набор из 9 таблиц и 12 исходных заказов сохранён отдельно. Связь исторического `product_id` больше не блокирует удаление товара из beginner-каталога. Четыре аналитических урока и существующие упражнения e83/e86/e87/e96 используют исторический набор: когорты, retention, чистая выручка MoM и время этапов доставки. События имеют разные детерминированные интервалы и строгий порядок created → shipped → delivered. PGlite smoke-test подтверждает cohort/retention, выручку, item totals, возвраты, 874 завершённые доставки, средние и перцентили. Workflow `42488705350` — validation и deploy success; Pages workflow `42488705054` — success. |
| 6. Интерфейс, мобильная версия и производительность | DONE | Помимо ранней отрисовки, блокировок до engineReady, reset/retry, сохранения черновика и доступной мобильной навигации добавлены синтаксическая проверка JS и live Playwright Chromium smoke test опубликованного Pages. Последние проверки: workflow 42506177510 и Pages workflow 42506177411 — success. Browser smoke подтвердил запуск shell до готовности БД, retry импорта PGlite, сохранение SQL-черновика, реальное выполнение PostgreSQL-запроса, мобильное меню/Escape/возврат фокуса и отсутствие overflow на 390 и 320 px. В ходе первоначальной проверки исправлены синтаксическая ошибка renderPractice() и retry-загрузка PGlite через новый URL. |
| 7. Полная проверка, документация и выпуск | IN PROGRESS | CI hardening, очистка 29 не-main refs, каталог курсов и live browser E2E завершены. Текущий workflow 42514802784: validate, deploy и browser-smoke — success. Осталась ручная настройка GitHub About (description, homepage, topics); автоматическая запись repository metadata недоступна в подключении. |

## BRANCH AUDIT

Историческая сверка выполнена через GitHub compare для всех 29 веток-кандидатов относительно main на baseline f5f45adec53433070b08839e171d30a9f8d64e17. После этого main получил два CI-only коммита (81121d2c, dccb274e); значения ahead не изменились, behind для всех кандидатов увеличился на 2. На момент аудита было 30 веток включая main. Впоследствии все 29 не-main refs удалены; текущая проверка GitHub API показывает только main. Открытых PR: 0.

| Branch | Commits ahead of main at baseline |
|---|---:|
| audit/phase-1-review-2026-11-07 | 1 |
| feature/lesson-walkthroughs-complete | 4 |
| feature/postgres-optimization-stage-3 | 51 |
| fix/relevant-sql-explanations | 7 |
| work/sql-academy-lessons-stage3-rebased | 7 |
| work/sql-academy-lessons-stage3 | 15 |
| work/sql-academy-rebuild | 13 |
| work/sql-academy-stage3-batch2-2026-11-07 | 11 |
| work/sql-academy-stage3-batch3-2026-11-07 | 5 |
| work/sql-academy-stage3-batch4-2026-11-07 | 5 |
| work/sql-academy-stage3-batch5-2026-11-07 | 15 |
| work/sql-academy-stage3-batch6-2026-11-07b | 0 |
| work/sql-academy-stage3-batch6-2026-11-07 | 8 |
| work/sql-academy-stage3-batch7-2026-11-07 | 11 |
| work/sql-academy-stage3-batch8-2026-11-07 | 8 |
| work/sql-academy-stage3-batch9-2026-11-07 | 15 |
| work/sql-academy-stage3-batch10-2026-11-07 | 10 |
| work/sql-academy-stage3-batch11-2026-11-07 | 4 |
| work/sql-academy-stage3-batch12-2026-11-07 | 4 |
| work/sql-academy-stage3-batch13-2026-11-07 | 4 |
| work/sql-academy-stage3-batch14-2026-11-07 | 4 |
| work/sql-academy-stage3-batch15-2026-11-07 | 4 |
| work/sql-academy-stage3-batch16-2026-11-07 | 2 |
| work/sql-academy-stage3-batch17-2026-11-07 | 8 |
| work/sql-academy-stage3-batch18-2026-11-07 | 11 |
| work/sql-academy-stage3-batch19-2026-11-07 | 4 |
| work/sql-academy-stage3-batch20-2026-11-07 | 4 |
| work/sql-academy-stage3-batch21-2026-11-07 | 4 |
| work/sql-academy-stage3-batch22-2026-11-07 | 3 |

work/sql-academy-stage3-batch6-2026-11-07b is the only branch proven to have no commit ahead of main. It can be deleted safely from Git history, but no branch deletion operation is exposed in this integration. For the other 28 branches, ahead commits may be exact patch equivalents already cherry-picked to main; compare commit counts alone cannot prove redundancy. Inspect their patches/trees before cleanup.

### Semantic review of every non-main branch

Содержимое проверено относительно актуального main, а не только по названиям веток или ahead count. Итог: merge не требуется. Commit SHAs в diverged ветках уникальны, но новые для main функциональные области не обнаружены; это не означает, что SHA-коммиты буквально одинаковы.

| Branch(es) | Что нашли | Что в current main | Решение |
|---|---|---|---|
| audit/phase-1-review-2026-11-07 | Исторический AUDIT.md, 467 строк | Полезный итог аудита сверён с обновлённой программой и сохранён кратко в PROJECT_STATUS.md; сам архивный AUDIT.md удалён из main по запросу | Не переносить; ветка устарела |
| feature/lesson-walkthroughs-complete | Попытка добавить walkthrough во все 173 урока | Позднее сознательно удалены 133 шаблонных walkthrough; оставлены 42 содержательных сценария | Не переносить: это вернёт удалённый filler |
| feature/postgres-optimization-stage-3 | 51 коммит: PostgreSQL optimization, EXPLAIN, индексы, tooltip, исправления примеров и тесты | Ключевые уроки Nested Loop/Hash/Merge Join, Bitmap/Index Only Scan, GIN/GiST/BRIN и EXPLAIN есть; 14 старых названий уроков переименованы/разделены/объединены в актуальной программе. Все CSS selectors этой ветки есть в main | Не переносить: актуальная версия уже в main |
| fix/relevant-sql-explanations | 7 коммитов: короткие контекстные пояснения, удаление 133 filler-сценариев, исправления aliased UPDATE и EXPLAIN ANALYZE | Текущий app.js содержит соответствующие правила SET/ANALYZE/ON; curriculum содержит curated 42 сценария | Не переносить |
| work/sql-academy-lessons-stage3-rebased | Rebase/CI/cache commits поверх промежуточной версии уроков | Более поздняя редакция Stage 3 и тесты находятся в main | Не переносить |
| work/sql-academy-lessons-stage3 | 15 коммитов: примеры, expected results, JOIN/NULL/date explanations, компактность уроков | Main содержит проверенные ожидаемые результаты, JOIN/NULL/fan-out сценарии, обновлённые материалы и тесты | Не переносить |
| work/sql-academy-rebuild | 13 коммитов: аудит, разделение маршрутов, stable lesson IDs, навигация и прогресс | В main действуют маршруты 112 уроков Analyst + 61 PostgreSQL, устойчивая миграция прогресса; AUDIT.md обновлён | Не переносить |
| batch2–batch4 | Типы/даты, COUNT после LEFT JOIN, aggregation grain, JOIN cardinality и unmatched rows | Эти фундаментальные объяснения и соответствующие regression checks есть в main | Не переносить |
| batch5 | ROWS/RANGE peers, временные ряды и оконные примеры | Оконные рамки и календарная логика доработаны более поздними Stage 3 коммитами в main | Не переносить |
| batch6 (8 ahead) + batch7 | Subquery/CTE/set operations, deterministic pagination, DISTINCT ON, rollups | Main содержит CTE/set-operation проверки и стабильные пагинацию/сортировку | Не переносить |
| batch6-2026-11-07b (0 ahead) | Нет ни одного коммита сверх main | Полностью позади main | Единственная ветка, безопасная по Git ancestry |
| batch8–batch9 | Типы, числовой scale, даты, NULL, COALESCE и выражения | Main содержит исправленные результаты, типизацию и проверки NULL/числовых значений | Не переносить |
| batch10–batch11 | DDL/DML/transactions, delivery percentiles, event fan-out, SUM DISTINCT | Main содержит безопасные mutation tests, аналитику событий и защиту зерна бизнес-метрик | Не переносить |
| batch12–batch14 | Ranking peers/ties, window offsets/frames, NTILE, top-N | Main содержит актуальные семантические проверки ранжирования, окон и top-N | Не переносить |
| batch15 | Cohort size и month-over-month retention | Main содержит исторический dataset, cohort/retention и их проверяемые результаты | Не переносить |
| batch16–batch17 | Date/interval/SLA, rolling 7-day calendar windows и warm-up days | Main содержит корректные временные границы, календарные окна и SLA-сценарии | Не переносить |
| batch18 | Итоговый аналитический отчёт, ranking и стабильная сортировка | Main содержит end-to-end проверку аналитического отчёта и порядка результата | Не переносить |
| batch19–batch20 | Строгая последовательность событий в funnel; snapshot deduplication vs event history | Main содержит временной funnel и раздельную семантику snapshots/events | Не переносить |
| batch21 | Monthly store revenue share и правильный denominator | Main содержит проверяемую долю выручки с корректным знаменателем | Не переносить |
| batch22 | CTE chain и aggregation grain | Main содержит отдельную проверку CTE pipeline и grain | Не переносить |

Для batch2–batch22 названия веток соответствуют точным префиксам `work/sql-academy-stage3-batchN-2026-11-07`; для batch6 существуют две ветки с суффиксами без `b` и с `b`. Их branch-specific commits в основном представляют шаги одной последовательной переработки; актуальные итоги Stage 3 находятся в main.

### Cleanup conclusion

- Не создавать PR и не cherry-pick: недостающих функциональных изменений не найдено. AUDIT.md удалён из main коммитом 8cdf766e; README не ссылался на этот файл, итог branch review находится в PROJECT_STATUS.md.
- Ветка `work/sql-academy-stage3-batch6-2026-11-07b` была единственной веткой-ancestor (ahead=0); сейчас она удалена вместе с остальными не-main refs.
- Остальные 28 diverged-веток содержали промежуточную commit history, функциональные результаты которой уже присутствовали в main или были заменены более актуальными решениями. Все они также удалены; новых merge/cherry-pick не потребовалось.
- Очистка завершена: актуальные GitHub API `branches?per_page=100` и `git/matching-refs/heads/` возвращают только `main`. Удаление не имитировалось обновлением refs и не затронуло main.
- GitHub About также остаётся ручной операцией: текущий toolset не предоставляет update-repository metadata. PROJECT_STATUS.md оставить в main как handoff; AUDIT.md удалён.

## DONE — проверяемые ограничения и результаты

- Основная ветка: `main`; default branch — `main`.
- Самостоятельный курс SQL для аналитика данных: 17 модулей / 112 уроков. Самостоятельный курс PostgreSQL: 8 модулей / 61 урок. Курсы связаны рекомендуемыми знаниями, но не объединены в одну программу.
- Проверенный учебный объём: 25 модулей, 173 урока, 100 module knowledge checks, 72 термина глоссария, 13 групп справочника, 102 обычных задания, 350 случайных задач и 14 тем случайной практики.
- Beginner schema остаётся отдельным компактным набором из 9 таблиц; исторический аналитический набор состоит из 4 таблиц. Не сливать эти два набора и не менять результаты базовых новичковых упражнений без отдельного регрессионного доказательства.
- Comparator проверяет имена столбцов независимо от порядка колонок; значения сопоставляются по именам столбцов. Сравнение сохраняет кратность одинаковых строк. Порядок строк учитывается только для заданий, где он явно требуется.
- Типы не схлопываются через JSON-сериализацию: NULL, NaN, конечные/бесконечные числа, BIGINT, строки, даты, массивы, JSON-объекты и бинарные значения нормализуются с сохранением типа.
- Пустой результат сохраняет схему столбцов через field metadata; при отсутствии metadata нормализатор использует ключи первой строки.
- Пять верхних N эталонов используют соответствующие LIMIT; running total и recursive sequence имеют проверяемый порядок результата.
- Контрольные вопросы: правильные ответы распределены равномерно по четырём позициям; внутри каждого модуля позиции сбалансированы.
- Stage 5: новые исторические сценарии не увеличивают количество упражнений и сохраняют существующие IDs.
- Stage 6: завершён; automated live browser E2E прошёл на опубликованном Pages в Chromium. Это автоматизированная browser-проверка, не ручное тестирование человеком.

## BACKLOG

- **GitHub About:** description, homepage and topics are empty. Suggested description: Interactive SQL and PostgreSQL learning platform for aspiring data analysts, with structured lessons, hands-on exercises, automatic SQL checking, and a browser-based PostgreSQL sandbox.
- **Homepage:** https://vladsimbro.github.io/SQL/
- **Suggested topics:** sql, postgresql, data-analytics, sql-learning, education, pglite, github-pages.
- **Branch cleanup:** complete. GitHub currently exposes only `main`; all 29 non-main refs are absent. No merge/cherry-pick was necessary.
- **Course catalog:** complete for the two currently implemented courses. New courses must be complete standalone programs before appearing in the catalog; do not add Excel/Sheets, Power BI or Statistics placeholders.
- **Course-specific learning UI:** catalog, program, lesson sidebar, progress label and practice list are course-aware. SQL/PostgreSQL exercise IDs and progress storage are unchanged.
- **GitHub About write:** apply the prepared description/homepage/topics through repository Settings when UI or an authorized metadata-write integration is available.
- Local clone/test run was not used in this session; executable checks and live browser E2E were run in GitHub Actions.

## PROJECT STATE

- Repository: https://github.com/vladsimbro/SQL
- Pages: https://vladsimbro.github.io/SQL/
- Branch: main
- Current main SHA must be read from the live GitHub main ref; do not rely on a fixed SHA stored in this self-updating handoff.
- Latest app build: 20261108-98.
- Latest full validate/deploy/browser-smoke workflow: 42514802784 — success. Jobs: validate 128835360043, deploy 128835428724, browser-smoke 128835530690.
- Tested code snapshot: commit 1cee484 (workflow concurrency recovery; application sources in the same main head). Live browser test confirms the course catalog and course-specific study/practice flows. Subsequent handoff-only commits may trigger another managed Pages run; they do not change application/course files.
- The browser smoke reran in the latest full validation and passed. Its detailed timings are retained above only as diagnostics from the previous recorded run.
- No Node.js 20 deprecation warning appeared in the latest browser job logs.
- Workflow hardening commits: 81121d2c (Action major upgrades + least-privilege deploy permissions), dccb274e (ignore status-only pushes/PRs).
- Action versions: actions/checkout@v7, actions/setup-node@v7, actions/configure-pages@v6, actions/upload-pages-artifact@v5, actions/deploy-pages@v5, actions/upload-artifact@v7. Project test runtime remains Node 22.
- Global workflow permission is contents: read; only deploy job receives pages: write and id-token: write.
- A push/PR changing only PROJECT_STATUS.md is ignored by the custom validate/deploy/browser-smoke workflow. The separate GitHub-managed Pages Jekyll build/deploy may still run; observed successfully on handoff commit 8a14e19f (run 42506417303).
- Open Pull Requests: 0 at last verification.
- Branches: only `main` currently exists. The 29 non-main refs listed in the historical audit were removed after semantic review; no unique functional content required merging.
- GitHub About fields: description null, homepage null, topics empty. Repository lookup confirms the values; current integration has no write operation.
- The connected GitHub integration has no delete-ref operation, but cleanup is already complete: live API responses list only `main`; no non-main refs remain.
- README is up to date: 42 step-by-step scenarios and a separate «Контрольные работы» section. It now describes SQL and PostgreSQL as two standalone courses.
- Current app architecture: `learningTracks` contains only the two implemented courses. `app.js` includes a `courses` view, course-specific program/lesson sidebar/progress, and course-filtered practice. `index.html` navigation exposes «Курсы» rather than the old combined roadmap/lesson list.
- Stage 6 browser timings vary by runner/load; values above are from the latest successful run, not stable performance guarantees.
- This handoff update changes only PROJECT_STATUS.md; paths-ignore prevents the custom validation/deploy/browser-smoke cycle, but does not suppress the separate GitHub-managed Pages build/deploy.

## NEXT ACTION

Продолжать развитие платформы по новому плану, не повторяя этапы 0–6 и уже выполненное разделение SQL/PostgreSQL. Следующий приоритет — самостоятельный раздел «Проекты»: отдельные практические кейсы, не уроки внутри SQL/PostgreSQL. Начать с E-commerce аналитики и аналитики доставки на уже существующих данных; для Product Analytics сначала подготовить полноценную событийную модель, затем публиковать кейс. В заданиях оставлять бизнес-цель, ограничения и ожидаемый результат, но не выдавать таблицы/столбцы и SQL-решение заранее. Не показывать пустые будущие курсы Excel/Sheets, Power BI и Statistics. GitHub About остаётся ручной настройкой; не тратить на это разработческий цикл. Сохранять PROJECT_STATUS.md как handoff и вести дальнейшую работу в main.