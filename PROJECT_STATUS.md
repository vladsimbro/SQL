# SQL Academy — project status

Last verified: 2026-11-08

## CURRENT

- **Release baseline:** этапы 0–6 и исходная архитектура курсов завершены. Stage 7 содержит только ручную настройку GitHub About; она не блокирует развитие продукта.
- **Current development:** самостоятельный раздел бизнес-проектов добавлен и опубликован. Дальше углублять кейсы и итоговые аналитические выводы, не повторяя аудит, базовые уроки SQL или Stage 3.
- **Last completed:** каталог SQL и PostgreSQL как отдельных курсов с самостоятельными программами, прогрессом и практикой. Добавлен раздел «Проекты» с тремя кейсами (E-commerce, доставка, Product Analytics) и девятью заданиями с выполнением и сравнением SQL-результатов. Черновики и завершение проектов сохраняются отдельно. Добавлена отдельная таблица `product_events`: 48 пользователей, 576 сессий, последовательные события воронки. Существующие lesson/exercise IDs сохранены. Excel, Power BI и Statistics не отображаются заглушками. Все 29 не-main refs удалены; осталась только `main`.
- **Current main SHA:** проверять непосредственно в GitHub при каждой передаче контекста. Не фиксировать SHA текущего HEAD в handoff: обновление этого файла само создаёт новый commit.
- **App build:** 20261108-101.
- **Latest full validation + deployment:** workflow 42516658204 — success for commit 744b652. Validate job 128841043928, deploy job 128841134971, browser-smoke job 128841216810 — all success.
- **Curriculum verification:** 25 модулей, 173 урока, 100 knowledge checks, 72 термина глоссария, 13 групп справочника, 102 обычных задания и 350 случайных задач / 14 тем; 114 read-only примеров и 81 expected-result таблица. Дополнительно исполняются 9 эталонных SQL-решений проектов. Product dataset содержит 576 сессий; smoke test проверяет funnel drop-off, хронологию событий и независимость исторических product_id от starter catalog.
- **Live browser verification:** каталог показывает два самостоятельных курса и три проекта; сайдбар урока и прогресс соответствуют выбранному курсу; практика фильтруется по курсам. В проектах проверены отклонение неправильного SELECT, успех корректного решения, отдельное сохранение completed tasks и SQL drafts, скрытие/раскрытие эталона. PGlite retry, реальное SQL execution, мобильное меню и экраны 320/390 px прошли.

- **Remaining external setting:** GitHub About is still empty (description=null, homepage=null, topics=[]). The connected GitHub actions do not expose repository-metadata write operations. This is a manual repository Settings item, not a blocker for course/project development. All 29 non-main refs are deleted; live branches API returns only `main`.
- **Handoff update:** status-only changes skip the custom validate/deploy/browser-smoke workflow; current code/test release 42516658204 passed all jobs.

## STAGES

| Stage | Status | Evidence / remaining |
|---|---|---|
| 0. Сверка состояния и сохранение прогресса | DONE | Проверены main, HEAD, структура, Actions, Pages и список веток. PROJECT_STATUS.md используется как handoff; перед продолжением факты повторно сверяются с GitHub. |
| 1. Надёжность основного функционала | DONE | Исправлены знаменатель основного прогресса и переход core → PostgreSQL; проверки 0/112, 112/112, независимости optional route и миграции прогресса. UI end-to-end проверка относится к этапу 6/7. |
| 2. Структура и логика учебной программы | DONE | 25 модулей: 17 модулей / 112 уроков SQL для аналитика данных и 8 / 61 PostgreSQL. Каталог показывает их как два самостоятельных курса с описанием аудитории, уровня и предварительных знаний; прогресс и программа изолированы по курсу. |
| 3. Качество и содержание уроков | DONE | Все 173 урока имеют обязательные материалы; 42 уникальных пошаговых сценария, включая NULL и fan-out. Исправлены SQL-подсказки для aliased UPDATE и EXPLAIN ANALYZE. CI проверяет 114 исполняемых read-only примеров и 81 таблицу ожидаемых результатов. |
| 4. Практика, валидатор и контроль знаний | DONE | 102 обычных задания (списки и навигация разделены по курсам, IDs и общий механизм проверки сохранены), 350 случайных задач в 14 темах, 100 модульных вопросов. Comparator сохраняет типы значений, набор столбцов, кратность строк и заданный условием порядок; допускает перестановку столбцов и строк, когда это несущественно. Execution-based PGlite-проверки покрывают SELECT/CTE, JOIN/pre-aggregation, correlated subquery/LEFT JOIN, IN/EXISTS, NOT IN с NULL, EXCEPT/INTERSECT, UNION/UNION ALL, FILTER/CASE, GROUPING SETS/UNION ALL, оконные CTE, ROWS/RANGE и другие зафиксированные эквивалентности. Отдельно проверяются отрицательные случаи, где запросы неэквивалентны. 95 random tasks и 12 обычных упражнений явно order-sensitive. 100 вопросов контрольных работ сбалансированы 25/25/25/25. |
| 5. Учебные данные и аналитические сценарии | DONE | Сохранены стартовые 9 таблиц и исторические 4 e-commerce таблицы (48 клиентов, 1 158 заказов за 2023–2025, возвраты и lifecycle events). Добавлена отдельная `product_events` на 576 сессий / 48 пользователей с событиями page_view → product_view → add_to_cart → checkout_started → purchase; неполные воронки сохранены. `product_id` в продуктовых событиях — исторический снимок, поэтому удаление товара из starter catalog не блокирует и не удаляет факты. CI исполняет воронку, проверяет последовательность и прогоняет 9 эталонных запросов проектов. |
| 6. Интерфейс, мобильная версия и производительность | DONE | Каталог двух курсов, course-aware программа/сайдбар/прогресс/практика. Добавлен адаптивный раздел проектов с тремя кейсами, бизнес-контекстом, условиями и ожидаемым результатом, SQL editor, автопроверкой, отдельным localStorage progress/drafts и показом решения только по запросу. Live Playwright проверяет правильный/неправильный SQL, сохранение черновика и мобильную навигацию; workflow 42516658204 — success. |
| 7. Полная проверка, документация и выпуск | IN PROGRESS | CI hardening, удаление 29 не-main refs, каталог курсов и первый выпуск раздела проектов завершены. Последний workflow 42516658204: validate, deploy и browser-smoke — success. Осталась ручная настройка GitHub About (description, homepage, topics); подключённая интеграция не предоставляет metadata-write. |

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
- **Course-specific learning UI:** catalog, program, lesson sidebar, progress and practice are course-aware; SQL/PostgreSQL IDs and progress migration remain unchanged.
- **Projects v1:** 3 standalone projects / 9 read-only SQL tasks. User briefs show business context, conditions and expected output without exposing schemas, columns or answers. Execution-based checks use the existing result comparator; project progress and SQL drafts use separate localStorage keys.
- **Product Analytics data:** `product_events` stores 576 sessions / 48 customers using historical product IDs; event stages have ordered timestamps and deterministic funnel drop-off.
- **GitHub About write:** apply the prepared description/homepage/topics through repository Settings when UI or an authorized metadata-write integration is available.
- Local clone/test run was not used in this session; executable checks and live browser E2E were run in GitHub Actions.

## PROJECT STATE

- Repository: https://github.com/vladsimbro/SQL
- Pages: https://vladsimbro.github.io/SQL/
- Branch: main
- Current main SHA must be read from the live GitHub main ref; do not rely on a fixed SHA stored in this self-updating handoff.
- Latest app build: 20261108-101.
- Latest full validate/deploy/browser-smoke workflow: 42516658204 — success. Jobs: validate 128841043928, deploy 128841134971, browser-smoke 128841216810.
- Tested code snapshot: commit 744b652. Live browser verification confirms course separation and project workspace on https://vladsimbro.github.io/SQL/; SQL result checking, project completion, draft persistence and explicit solution reveal all passed.
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
- README is up to date: 42 step-by-step scenarios and a separate «Контрольные работы» section; it documents the two standalone courses, three projects and all three datasets.
- Current app architecture: two implemented entries in `learningTracks`; standalone `courses` catalog; course-specific program/sidebar/progress/practice; separate `projects` catalog and task workspace; project progress/drafts stored independently; Product Analytics uses a separate event dataset.
- Stage 6 browser timings vary by runner/load; values above are from the latest successful run, not stable performance guarantees.
- This handoff update changes only PROJECT_STATUS.md; paths-ignore prevents the custom validation/deploy/browser-smoke cycle, but does not suppress the separate GitHub-managed Pages build/deploy.

## NEXT ACTION

Продолжать с текущей опубликованной базой. Первичная версия раздела проектов завершена: 3 бизнес-кейса / 9 исполняемых заданий, отдельная Product Analytics событийная модель. Следующий приоритет — углубить кейсы как целостные аналитические истории: связать задания внутри каждого проекта, добавить итоговый аналитический вывод и рекомендации, а также проверку интерпретации результатов без показа готового ответа заранее. Сохранить самостоятельность SQL и PostgreSQL. Не показывать пустые будущие курсы Excel/Sheets, Power BI и Statistics. GitHub About остаётся ручной настройкой и не должен блокировать продуктовую работу. Дальше работать в `main` и обновлять этот handoff после проверок.