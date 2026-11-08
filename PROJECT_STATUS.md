# SQL Academy — project status

Last verified: 2026-11-08

## CURRENT

- **Stage:** 5 — Учебные данные и аналитические сценарии
- **Main task:** добавить воспроизводимый исторический набор с несколькими годами покупок, когортами, повторными заказами, статусами, возвратами и событиями, не меняя базовые beginner-данные и их эталонные результаты.
- **Done:** этапы 0–4 завершены. Comparator сравнивает имена столбцов и типизированные значения, сохраняет зерно, дубликаты и заданный порядок. Проверены эквивалентные SELECT/CTE, JOIN/подзапросы, IN/EXISTS, NOT IN/NOT EXISTS, EXCEPT/INTERSECT, FILTER/CASE, GROUPING SETS/UNION ALL и оконные выражения. Исправлены эталоны сортировки и баланс контрольных ответов.
- **Remaining:** безопасно расширить историческую аналитику, добавить сценарии по повторным покупкам, когортам, чистой выручке и времени обработки заказа.

## STAGES

| Stage | Status | Evidence / remaining |
|---|---|---|
| 0. Сверка состояния и сохранение прогресса | DONE | Проверены main, HEAD, структура, Actions, Pages и список веток. PROJECT_STATUS.md используется как handoff; факты повторно сверяются с GitHub. |
| 1. Надёжность основного функционала | DONE | Исправлены знаменатель основного прогресса и переход core → PostgreSQL; проверки 0/112, 112/112, независимости optional route и миграции прогресса. UI end-to-end оставлен для этапа 7. |
| 2. Структура и логика учебной программы | DONE | 25 модулей: 17 модулей / 112 уроков core и 8 / 61 PostgreSQL. Разделение и порядок маршрутов подтверждаются smoke-test. |
| 3. Качество и содержание уроков | DONE | Все 173 урока имеют обязательные материалы; 42 уникальных пошаговых сценария, включая NULL и fan-out. Исправлены SQL-подсказки для aliased UPDATE и EXPLAIN ANALYZE. CI проверяет 114 исполняемых read-only примеров и 81 таблицу ожидаемых результатов. |
| 4. Практика, валидатор и контроль знаний | DONE | 102 обычных задания, 350 случайных задач в 14 темах, 100 модульных вопросов. Comparator сохраняет типы значений, набор столбцов, кратность строк и заданный условием порядок; допускает перестановку столбцов и порядка строк, когда это несущественно. Execution-based PGlite-проверки покрывают SELECT/CTE, JOIN/pre-aggregation, correlated subquery/LEFT JOIN, IN/EXISTS, NOT IN с NULL, EXCEPT/INTERSECT, UNION/UNION ALL, OR/UNION, FILTER/CASE, GROUPING SETS/UNION ALL, оконное CTE и различие ROWS/RANGE. Зафиксированы 95 order-sensitive random tasks и 12 обычных упражнений; исправлены пять top-N эталонов с LIMIT 3/4/5/6/8, порядок running total и recursive sequence. Ответы 100 контрольных вопросов сбалансированы 25/25/25/25, в каждом модуле по одной правильной позиции каждого типа. Workflow 42440335792: validation и Pages deploy success; 114 примеров, 81 expected result, 102 упражнения, 350 random tasks, 9 seed tables. |
| 5. Учебные данные и аналитические сценарии | IN PROGRESS | 9 таблиц. В текущем seed в orders 12 строк. Нужна более глубокая аналитическая выборка: несколько временных периодов, повторные покупки, статусы, возвраты и последовательности событий, при сохранении исходных примеров и совместимости практики. |
| 6. Интерфейс, мобильная версия и производительность | IN PROGRESS | Первый render по-прежнему ожидает создание БД и подготовку всех эталонов. Требуется проверить раннюю отрисовку оболочки, блокировку практики до engineReady, мобильную навигацию и восстановление после ошибок. |
| 7. Полная проверка, документация и выпуск | IN PROGRESS | Validation и Pages deploy job проходят на актуальном коде. Остаются браузерные сценарии desktop/mobile, исправление устаревшего README, GitHub About и решение по архивным веткам после полной проверки их уникального содержимого. |

## DONE

- Основная ветка: main.
- Основной маршрут Junior Data Analyst: 112 уроков; дополнительный PostgreSQL: 61 урок.
- CI для проверенного кода подтверждает: 25 модулей, 173 урока, 100 knowledge checks, 72 термина глоссария, 13 групп справочника, 102 задания, 350 random tasks и 9 seed tables.
- Comparator проверяет набор имён столбцов независимо от порядка колонок; значения сопоставляются по именам столбцов.
- Сравнение сохраняет кратность одинаковых строк. Порядок строк учитывается только для заданий, где он явно требуется условием.
- Типы не схлопываются через JSON-сериализацию: NULL, NaN, конечные и бесконечные числа, BIGINT, строки, даты, массивы, JSON-объекты и бинарные значения нормализуются с сохранением типа. Regression-тесты отдельно проверяют NaN vs NULL, +Infinity vs -Infinity, BIGINT vs text, Date vs ISO text и marker-like JSON object vs отсутствующее поле.
- Пустой результат сохраняет схему столбцов через field metadata; при отсутствии metadata нормализатор использует ключи первой строки.
- Execution-based equivalence tests на PGlite включают SELECT↔CTE, JOIN↔предварительную агрегацию, IN↔EXISTS при повторяющихся ключах, безопасный NOT IN↔NOT EXISTS после фильтрации NULL, FILTER↔CASE, оконное вычисление через CTE, OR↔UNION на уровне уникальных order_id.
- Negative tests отдельно подтверждают, что NOT IN с NULL в подзапросе отличается от NOT EXISTS, UNION отличается от UNION ALL при повторных customer_id, а SUM(DISTINCT unit_price) не эквивалентен сумме всех позиций.
- Агрегация по магазинам через LEFT JOIN сравнивается с предварительной агрегацией; тест сохраняет магазины без заказов и проверяет одинаковое зерно.
- Сортировка случайной практики: 95 из 350 задач имеют orderMatters=true, все их эталонные решения содержат ORDER BY; варианты top-N применяют указанный LIMIT.
- Сортировка обычной практики: orderMatters=true только у 12 упражнений, где итоговый порядок задан в формулировке. У упражнения e38 добавлен внешний ORDER BY created_at, order_id: оконный ORDER BY сам по себе не гарантировал сортировку результирующих строк.
- 100 контрольных вопросов модулей имеют сбалансированные позиции правильных ответов: 25 на каждую позицию, каждый модуль использует все четыре позиции ровно по разу; опции различны, вопросы уникальны.
- Validation workflow для 78a3ad8e400a441b5842b6ce5e4d4ccd18e25261 завершился success: 114 read-only lesson examples, 81 expected-result таблица, 102 runnable exercises, 350 random sandbox tasks, 9 seed tables.
- Deploy job в том же workflow завершился success; build 20261108-84 опубликован через GitHub Pages.

## BACKLOG

- Универсальная эквивалентность произвольного SQL неразрешима одним конечным набором примеров: comparator проверен на репрезентативных классах запросов и сохраняет типы/мульти-множества/порядок.
- Дополнительно расширить SQL-equivalence случаи только при появлении новых аналитических заданий; не превращать comparator tests в бесконечную коллекцию синтетических примеров.
- Расширить аналитические данные: много месяцев, повторные покупки, статусы, отмены/возвраты и последовательности событий. Сохранить существующие записи и эталонные сценарии.
- Проверить раннюю отрисовку, мобильную версию и восстановление после ошибок.
- README всё ещё содержит старую цифру 40 пошаговых сценариев (фактически 42) и утверждение, что 100 модульных контрольных вопросов не отображаются отдельным тестовым блоком; обновить README на этапе 7.
- В репозитории 30 веток, включая main. Ветки не удалялись: до удаления нужно завершить содержательный аудит уникального кода каждой архивной ветки и убедиться, что в них нет незакоммиченной уникальной работы.
- Прямое интерактивное прохождение опубликованного сайта в браузере этой сессией не подтверждено; успешный Pages deploy не выдавать за ручной live UI smoke test.

## PROJECT STATE

- Repository: https://github.com/vladsimbro/SQL
- Pages: https://vladsimbro.github.io/SQL/
- Branch: main
- Verified code HEAD before this status update: bc4407ea58af627018831ebf50b1604240cf9657
- App build: 20261108-84
- Validation and deploy workflow: 42440335792 — success for commit bc4407e.
- Deploy job: 128608060405 — success in workflow 42440335792.
- Open Pull Requests: 0
- Branches: 30 total including main
- GitHub About description / homepage / topics: empty at last metadata check.
- Local clone/test execution unavailable in this session because GitHub DNS resolution failed. GitHub Actions is the executable test environment.
- Known Stage 6 issue: initial render waits for seed and all expected exercise results.

## NEXT ACTION

Inspect current database seed and analytics lessons. Add a separate, deterministic historical data layer that does not change the 9-table beginner fixture or its existing 81 expected result snapshots; then connect advanced examples and practice to that data.
