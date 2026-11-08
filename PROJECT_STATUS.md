# SQL Academy — project status

Last verified: 2026-11-08

## CURRENT

- **Stage:** 4 — Практика, валидатор и контроль знаний
- **Main task:** проверить, что валидатор принимает корректные эквивалентные решения и сохраняет значимые различия в столбцах, дубликатах, количестве строк и порядке там, где он важен.
- **Done:** этапы 0–3 завершены; исправлены прогресс и переходы маршрутов, улучшены SQL-подсказки, добавлены два пошаговых сценария для NULL и fan-out.
- **Remaining:** проверить семантическую эквивалентность SELECT / WITH SELECT, CTE, JOIN, агрегатов, оконных функций, NULL и случайных заданий.

## STAGES

| Stage | Status | Evidence / remaining |
|---|---|---|
| 0. Сверка состояния и сохранение прогресса | DONE | Проверены main, HEAD, структура, 28 веток, отсутствие открытых PR, Actions и Pages. Создан этот статус-файл. |
| 1. Надёжность основного функционала | DONE | Исправлены знаменатель основного прогресса и переход core → PostgreSQL; добавлены проверки 0/112, 112/112, независимости optional route и миграции прогресса. CI 42438597079 прошёл. UI end-to-end оставлен для этапа 7. |
| 2. Структура и логика учебной программы | DONE | 25 модулей: 17 модулей / 112 уроков core и 8 / 61 PostgreSQL. Существующие проверки подтверждают разделение и порядок маршрутов. |
| 3. Качество и содержание уроков | DONE | Структура всех 173 уроков проверена; обязательные теория, пример, note и outcomes заполнены. Точных повторов body/simple/note нет. 42 уникальных пошаговых сценария, включая NULL и fan-out. SQL tooltip исправления для aliased UPDATE и EXPLAIN ANALYZE протестированы. CI 42438998609: 114 SQL-примеров исполнены, 81 expected-result таблица проверена. |
| 4. Практика, валидатор и контроль знаний | IN PROGRESS | 102 практических задания, 350 случайных задач в 14 темах, 100 вопросов контрольных работ. Эталонные решения проходят CI; требуется отдельная проверка эквивалентных пользовательских запросов и семантики сравнения. |
| 5. Учебные данные и аналитические сценарии | IN PROGRESS | 9 таблиц. Диапазон дат seed-данных в целом: 2022-09-15 — 2026-01-15, но в orders только 12 записей. Нужна более глубокая аналитическая выборка при сохранении простого стартового набора и совместимости заданий. |
| 6. Интерфейс, мобильная версия и производительность | IN PROGRESS | Первый render по-прежнему ожидает создание БД и подготовку всех эталонов. Нужна проверка раннего отображения оболочки при блокировке практики до `engineReady`. |
| 7. Полная проверка, документация и выпуск | IN PROGRESS | CI и Pages deployment проходят на текущих коммитах. Остаются браузерные сценарии desktop/mobile, README, GitHub About и безопасная сверка/очистка веток. |

## DONE

- Основная ветка: main.
- Основной маршрут Junior Data Analyst: 112 уроков; дополнительный PostgreSQL: 61 урок.
- Текущий CI подтверждал 25 модулей, 173 урока, 100 knowledge checks, 72 термина глоссария, 13 групп справочника, 102 задания, 350 random tasks и 9 таблиц.
- Validation для `d9940df` завершился success: 114 read-only lesson examples исполнены, 81 expected-result таблица проверена.
- Pages build и deployment для `d9940df` завершились success.
- Уникальные изменения последних Stage 3 batch22 по pre-aggregation, cardinality и CTE уже присутствуют в main. Ветку целиком не вливать.

## BACKLOG

- Проверить эквивалентные пользовательские решения валидатора, включая альтернативный SELECT / WITH SELECT, не ослабляя проверку столбцов и зерна.
- Расширить аналитические данные: много месяцев, повторные покупки, статусы, отмены/возвраты и последовательности событий. Сохранить существующие записи и эталонные сценарии.
- Проверить раннюю отрисовку, мобильную версию и восстановление после ошибок.
- README содержит устаревшее описание контрольных работ как не отображаемых отдельным тестовым блоком; обновить на этапе 7.
- Сверить оставшиеся 27 веток на уникальное содержимое перед любым удалением. Ветки пока не удалять.
- Прямое взаимодействие с опубликованным сайтом в браузере этой сессией не подтверждено; CI Pages deployment не заменяет live UI smoke test.

## PROJECT STATE

- Repository: https://github.com/vladsimbro/SQL
- Pages: https://vladsimbro.github.io/SQL/
- Branch: main
- Current code commit before this status update: d9940dffb8bb974456d737fe6d31664e78b3cf1f
- App build: 20261108-76
- Validation workflow: 42438998609 — success for `d9940df`.
- Pages workflow: 42438997781 — build and deploy success for `d9940df`.
- Open Pull Requests: 0
- Branches: 28 total including main
- GitHub About description / homepage / topics: empty at last metadata check.
- Local clone/test execution was unavailable because GitHub DNS resolution failed. GitHub Actions is the executable test environment.
- Known Stage 6 issue: initial render waits for seed and all expected exercise results.

## NEXT ACTION

Inspect the current normalizer and validator, then add execution-based tests for semantically equivalent SELECT and WITH SELECT solutions while preserving result shape and duplicates.
