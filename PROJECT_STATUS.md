# SQL Academy — project status

Last verified: 2026-11-08

## CURRENT

- **Stage:** 1 — Надёжность основного функционала
- **Main task:** исправить и проверить согласованность прогресса основного маршрута и перехода к следующему уроку между двумя маршрутами.
- **Done:** актуальное состояние main, CI, Pages deployment, состав программы и существующие тесты сверены; две ошибки навигации/прогресса воспроизводятся по текущему коду.
- **Remaining:** проверить изменения Stage 1 после CI и дополнить поведенческие проверки навигации, прогресса и миграции.

## STAGES

| Stage | Status | Evidence / remaining |
|---|---|---|
| 0. Сверка состояния и сохранение прогресса | DONE | Проверены main, HEAD, состав репозитория, 28 веток, отсутствие открытых PR, последние Actions и Pages deployment. PROJECT_STATUS.md создан в этой рабочей сессии. |
| 1. Надёжность основного функционала | IN PROGRESS | В текущем изменении исправляется прогресс основного маршрута и единый выбор следующего урока; добавляются тесты миграции и перехода между маршрутами. Остальные пользовательские сценарии требуют проверки. |
| 2. Структура и логика учебной программы | DONE | 25 модулей: 17 модулей / 112 уроков в основном маршруте и 8 модулей / 61 урок в дополнительном. CI проверяет порядок двух маршрутов, устойчивые ID и ключевые связи между темами. |
| 3. Качество и содержание уроков | IN PROGRESS | Текущие проверки подтверждают 40 пошаговых сценариев, 114 исполняемых SQL-примеров и 81 ожидаемую таблицу результата. Требуется закончить сверку незавершённых веток Stage 3 и ручную проверку методического качества. |
| 4. Практика, валидатор и контроль знаний | IN PROGRESS | 102 практических задания, 350 случайных задач / 14 тем, 100 вопросов в банках модулей. Исполнение эталонов проходит CI; семантическое принятие эквивалентных пользовательских запросов требует отдельной проверки. |
| 5. Учебные данные и аналитические сценарии | IN PROGRESS | Используются 9 таблиц. Требуется проверить временной охват, повторные покупки, возвраты и пригодность данных для когортной и временной аналитики. |
| 6. Интерфейс, мобильная версия и производительность | IN PROGRESS | В initDatabase() первый render() вызывается после создания схемы и подготовки всех эталонов. Нужна оценка и проверка более раннего отображения интерфейса без разрешения практики до готовности движка. |
| 7. Полная проверка, документация и выпуск | IN PROGRESS | Последний workflow validation и Pages deployment прошёл успешно. Нужны полная пользовательская проверка, live-проверка сайта в браузере, актуализация документации и безопасное завершение работы с ветками. |

## DONE

- Основная ветка репозитория — main.
- Основной аналитический маршрут и дополнительный маршрут PostgreSQL разделены; дополнительный маршрут не входит в состав основных 112 уроков.
- Последняя подтверждённая проверка CI до текущего изменения: 25 модулей, 173 урока, 100 knowledge checks, 72 термина глоссария, 13 групп справочника, 102 задания, 350 случайных задач и 9 таблиц.
- Последняя подтверждённая проверка SQL-примеров: 114 read-only примеров выполнены, 81 ожидаемая таблица результата сверена.
- Последняя подтверждённая публикация: GitHub Pages deploy job завершился success для коммита e4a2af2.

## BACKLOG

- Провести patch-level сверку 27 веток помимо main. Многие ветки расходятся с текущей историей main; сравнение статистики само по себе не доказывает, что их уникальные изменения уже перенесены. Не удалять ветки до проверки содержимого.
- Проверить валидатор на действительно эквивалентных запросах, а не только на совпадении эталонных результатов.
- Проверить диапазон дат и бизнес-сценарии учебных данных.
- Проверить сайт в реальном браузере на desktop и mobile.

## PROJECT STATE

- Repository: https://github.com/vladsimbro/SQL
- Pages: https://vladsimbro.github.io/SQL/
- Branch at inspection: main
- Last verified code HEAD before this change: e4a2af2bc5cad3881bff433c154b23c29fd32413
- App build before this change: 20261107-73
- Latest confirmed validation workflow: 42378308270 — success (2026-11-07 13:44 UTC)
- Latest confirmed Pages workflow: 42378307762 — success (2026-11-07 13:44 UTC)
- Open Pull Requests: 0
- Branches: 28 total, including main
- Repository description / homepage / topics at inspection: empty / empty / empty
- Local clone and local test execution: unavailable in this environment because github.com DNS resolution failed. GitHub Actions is the available executable test environment.
- Live Pages URL could not be fetched by the current browser tool; successful GitHub Pages build and deploy jobs are confirmed, but direct page interaction is not independently verified.
- Known implementation issue for Stage 6: database initialization still delays the first application render until prepareExpected() completes.

## NEXT ACTION

Verify CI for build 20261108-74, then continue Stage 1 with the remaining navigation, storage, database-ready and recovery scenarios.
