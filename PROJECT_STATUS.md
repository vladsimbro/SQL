# SQL Academy — project status

Last verified: 2026-11-08

## CURRENT

- **Stage:** 7 — Полная проверка, документация и выпуск.
- **Main task:** завершить метаданные GitHub About и безопасную очистку архивных веток. README актуализирован; Stage 6 закрыт автоматизированным live browser E2E на опубликованном GitHub Pages.
- **Last completed:** исправлен retry динамического импорта PGlite после сетевой ошибки; исправлена синтаксическая ошибка шаблона в renderPractice(), блокировавшая запуск app.js; в CI добавлен node --check; добавлен Playwright Chromium smoke test для опубликованного сайта; README обновлён (42 walkthroughs и отдельные контрольные работы).
- **Code HEAD verified:** `d26c32f6dfb6cbc498b8d73997b64235f8588d2d`.
- **App build:** `20261108-95`.
- **Validation + deploy:** workflow `42491906414` — success; validate job `128765900804`, deploy job `128765953956`, browser-smoke job `128766032038`.
- **Pages build/deployment workflow:** `42491906418` — success.
- **Live browser timings:** first application shell `1077 ms`; retry after injected PGlite network failure `5346 ms`; database reset `4647 ms`.
- **Remaining in Stage 7:** GitHub About (description/homepage/topics) is still empty; available GitHub connector actions expose repository metadata as read-only and do not provide update-repository or delete-ref operations. Branch audit found one fully contained branch (`work/sql-academy-stage3-batch6-2026-11-07b`, `ahead_by=0`, `behind_by=88`) and 28 other diverged branches with commits ahead of main. No branches were deleted without delete-ref capability and content proof.
## STAGES

| Stage | Status | Evidence / remaining |
|---|---|---|
| 0. Сверка состояния и сохранение прогресса | DONE | Проверены main, HEAD, структура, Actions, Pages и список веток. PROJECT_STATUS.md используется как handoff; перед продолжением факты повторно сверяются с GitHub. |
| 1. Надёжность основного функционала | DONE | Исправлены знаменатель основного прогресса и переход core → PostgreSQL; проверки 0/112, 112/112, независимости optional route и миграции прогресса. UI end-to-end проверка относится к этапу 6/7. |
| 2. Структура и логика учебной программы | DONE | 25 модулей: 17 модулей / 112 уроков core и 8 / 61 PostgreSQL. Разделение и порядок маршрутов подтверждаются smoke-test. |
| 3. Качество и содержание уроков | DONE | Все 173 урока имеют обязательные материалы; 42 уникальных пошаговых сценария, включая NULL и fan-out. Исправлены SQL-подсказки для aliased UPDATE и EXPLAIN ANALYZE. CI проверяет 114 исполняемых read-only примеров и 81 таблицу ожидаемых результатов. |
| 4. Практика, валидатор и контроль знаний | DONE | 102 обычных задания, 350 случайных задач в 14 темах, 100 модульных вопросов. Comparator сохраняет типы значений, набор столбцов, кратность строк и заданный условием порядок; допускает перестановку столбцов и строк, когда это несущественно. Execution-based PGlite-проверки покрывают SELECT/CTE, JOIN/pre-aggregation, correlated subquery/LEFT JOIN, IN/EXISTS, NOT IN с NULL, EXCEPT/INTERSECT, UNION/UNION ALL, FILTER/CASE, GROUPING SETS/UNION ALL, оконные CTE, ROWS/RANGE и другие зафиксированные эквивалентности. Отдельно проверяются отрицательные случаи, где запросы неэквивалентны. 95 random tasks и 12 обычных упражнений явно order-sensitive. 100 вопросов контрольных работ сбалансированы 25/25/25/25. |
| 5. Учебные данные и аналитические сценарии | DONE | Добавлены 4 отдельные аналитические таблицы: `analytics_customers`, `analytics_orders`, `analytics_order_items`, `analytics_order_events`; 48 клиентов, 1 158 заказов за 36 месяцев (2023–2025), повторные покупки, статусы, отмены, полные/частичные возвраты и журнал событий. Стартовый набор из 9 таблиц и 12 исходных заказов сохранён отдельно. Связь исторического `product_id` больше не блокирует удаление товара из beginner-каталога. Четыре аналитических урока и существующие упражнения e83/e86/e87/e96 используют исторический набор: когорты, retention, чистая выручка MoM и время этапов доставки. События имеют разные детерминированные интервалы и строгий порядок created → shipped → delivered. PGlite smoke-test подтверждает cohort/retention, выручку, item totals, возвраты, 874 завершённые доставки, средние и перцентили. Workflow `42488705350` — validation и deploy success; Pages workflow `42488705054` — success. |
| 6. Интерфейс, мобильная версия и производительность | DONE | Помимо ранней отрисовки, блокировок до `engineReady`, reset/retry, сохранения черновика и доступной мобильной навигации добавлены синтаксическая проверка JS и live Playwright Chromium smoke test опубликованного Pages. Workflow `42491906414`: validate/deploy/browser-smoke — success; Pages workflow `42491906418` — success. Проверено: первый экран 1 077 мс; искусственно сорванный импорт PGlite и Retry 5 346 мс; reset базы 4 647 мс; реальное выполнение SQL; сохранение черновика; мобильное меню, Escape и возврат фокуса; отсутствие горизонтального переполнения на ширинах 390 и 320 px на Dashboard, Practice и Playground. В ходе проверки исправлены реальная синтаксическая ошибка `renderPractice()` и retry-загрузка PGlite через новый URL после ошибки импорта. |
| 7. Полная проверка, документация и выпуск | IN PROGRESS | README обновлён: 42 пошаговых сценария и 100 модульных вопросов в отдельном разделе «Контрольные работы»; документ содержит описание live browser smoke и команды локального запуска. Сверены все 29 веток-кандидатов с main через GitHub compare. Одна ветка строго позади main (`work/sql-academy-stage3-batch6-2026-11-07b`, ahead_by=0); остальные 28 имеют от 1 до 51 коммита ahead и diverged. Удаление пока не выполнялось: в доступном GitHub connector нет операции delete-ref, а остальные ветки требуют отдельного доказательства, что их уникальная работа уже включена в main. GitHub About description/homepage/topics остаются пустыми; connector предоставляет чтение, но не обновление метаданных репозитория. |

## DONE — проверяемые ограничения и результаты

- Основная ветка: `main`; default branch — `main`.
- Основной маршрут Junior Data Analyst: 112 уроков; дополнительный PostgreSQL: 61 урок.
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

- GitHub About: description, homepage и topics пока пусты. Заполнить, когда будет доступна операция изменения метаданных репозитория.
- Удаление подтверждённо слитой ветки `work/sql-academy-stage3-batch6-2026-11-07b` ожидает доступной delete-ref операции.
- Для 28 diverged веток разобрать unique patches/trees и подтвердить включение их полезных изменений в main до удаления; не удалять только по возрасту или названию.
- Локальный clone/test run в этой сессии не использовался; executable checks и live browser E2E выполнялись в GitHub Actions.
## PROJECT STATE

- Repository: https://github.com/vladsimbro/SQL
- Pages: https://vladsimbro.github.io/SQL/
- Branch: `main`
- Verified HEAD: `d26c32f6dfb6cbc498b8d73997b64235f8588d2d`
- App build: `20261108-95`
- Validation + deploy workflow: `42491906414` — success for HEAD above.
- Validate job: `128765900804` — success, including `node --check` and all curriculum/PGlite exercise checks.
- Deploy job: `128765953956` — success.
- Browser-smoke job: `128766032038` — success against the published Pages URL; shell 1 077 ms, failed-import retry 5 346 ms, DB reset 4 647 ms.
- Separate Pages build/deployment workflow: `42491906418` — success for the same HEAD.
- Open Pull Requests: 0 (last known repository status; recheck before any merge action).
- Branches: 30 total including main; all 29 candidates compared against main. One confirmed ancestor branch and 28 diverged branches with ahead commits.
- GitHub About description / homepage / topics: empty; no repository-metadata update operation is available in the current connector.
- Stage 6 bug fixes: app retry uses a new versioned module URL after failed PGlite import; the `renderPractice()` template literal was fixed; syntax checks are now part of CI.
- README docs: corrected to 42 step-by-step scenarios and the separate «Контрольные работы» section.
- Status handoff itself will be committed separately after this verified code HEAD; no app code changes are bundled into that status update.
## NEXT ACTION

Завершить Stage 7: подготовить и внести GitHub About description/homepage/topics при появлении write-доступа к метаданным; удалить только подтверждённо слитые ветки при наличии delete-ref операции; для остальных 28 diverged веток проверить unique patches/trees относительно main и документировать, какие можно безопасно архивировать. README и Stage 6 live browser E2E уже завершены. Не менять содержимое учебного курса без конкретного подтверждённого дефекта.