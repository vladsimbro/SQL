# SQL Academy — project status

Last verified: 2026-11-08

## CURRENT

- **Stage:** 3 — Качество и содержание уроков
- **Main task:** закончить содержательную и методическую сверку всех уроков основного и PostgreSQL-маршрутов, не повторяя уже проверенные материалы.
- **Done:** этапы 0–2 подтверждены; исправлены ошибки прогресса и перехода между маршрутами, новые регрессионные тесты прошли GitHub Actions.
- **Remaining:** patch-level сверка веток Stage 3 и проверка методического качества уроков на предмет пробелов, повторов и неточных формулировок.

## STAGES

| Stage | Status | Evidence / remaining |
|---|---|---|
| 0. Сверка состояния и сохранение прогресса | DONE | Проверены main, HEAD, структура, 28 веток, отсутствие открытых PR и последние Actions. Статус проекта создан и находится в корне. |
| 1. Надёжность основного функционала | DONE | Исправлены знаменатель основного прогресса и расхождение между карточкой следующего урока и обработчиком перехода. Добавлены проверки 0/112, 112/112, влияния дополнительного маршрута, перехода core → PostgreSQL и миграции старого прогресса. Проверки прошли в workflow 42438597079; UI end-to-end будет дополнительно проверен на этапе 7. |
| 2. Структура и логика учебной программы | DONE | 25 модулей: 17 / 112 уроков core, 8 / 61 урок PostgreSQL. CI проверяет порядок, маршруты, устойчивые ID и связи тем. |
| 3. Качество и содержание уроков | IN PROGRESS | 40 пошаговых сценариев. До последнего изменения CI подтверждал 114 исполняемых SQL-примеров и 81 ожидаемую таблицу результата. Нужны patch-level сверка веток Stage 3 и методическая оценка. |
| 4. Практика, валидатор и контроль знаний | IN PROGRESS | 102 практических задания, 350 случайных задач в 14 темах и 100 вопросов контрольных работ. Эталонные SQL-решения исполняются в CI; корректность эквивалентных пользовательских запросов требует отдельной проверки. |
| 5. Учебные данные и аналитические сценарии | IN PROGRESS | 9 таблиц. Нужна оценка календарного охвата, повторных покупок, отмен/возвратов и возможностей когортной аналитики. |
| 6. Интерфейс, мобильная версия и производительность | IN PROGRESS | Подтверждённый недостаток: первый render вызывается после заполнения базы и подготовки всех эталонов. Нужна проверка ранней отрисовки без доступа к практике до готовности БД. |
| 7. Полная проверка, документация и выпуск | IN PROGRESS | Родительский commit проходил validation и Pages deployment. На 290552d Pages deployment прошёл, но validation упал на устаревшем assertion. Новая проверка ожидает запуска после исправления теста. |

## DONE

- Ветка main является основной.
- Core-маршрут Junior Data Analyst отделён от дополнительного маршрута PostgreSQL.
- До изменений CI подтверждал: 25 модулей, 173 урока, 100 вопросов контроля знаний, 72 термина глоссария, 13 групп справочника, 102 практических задания, 350 случайных задач и 9 таблиц.
- До изменений CI подтвердил 114 исполняемых read-only примеров и 81 таблицу ожидаемых результатов.
- Коммит 290552d добавил progress-utils.js, исправления app.js и новые тесты; Pages deployment для него завершился успешно.

## BACKLOG

- Провести patch-level сверку 27 веток помимо main. Статистика сравнения commit не доказывает, что уникальное содержимое веток сохранено. Не удалять их до проверки.
- Проверить валидатор на корректных эквивалентных запросах.
- Проверить диапазон дат и бизнес-сценарии учебных данных.
- Проверить сайт в реальном браузере на desktop и mobile.
- Исправить устаревший текст README: сейчас он утверждает, что модульные контрольные работы не отображаются как отдельный тестовый блок, хотя в приложении уже есть отдельный раздел assessment. Выполнить на этапе документации.

## PROJECT STATE

- Repository: https://github.com/vladsimbro/SQL
- Pages: https://vladsimbro.github.io/SQL/
- Current branch: main
- Current implementation commit: 290552d5684c73eb8a6b196bc53b2033577e641c
- App build: 20261108-74
- Latest validation workflow: 42438597079 — success for commit f127d15; 81 expected-result tables, 114 lesson examples, 102 practical tasks, 350 random tasks and 9 seed tables verified.
- Latest Pages workflow: 42438596806 — build and deploy success for commit f127d15.
- Previous validation workflow: 42378308270 — success for parent e4a2af2.
- Open Pull Requests: 0
- Branches: 28 total including main
- Repository description / homepage / topics: empty / empty / empty at last metadata check.
- Local clone/test execution is unavailable in this environment because GitHub DNS resolution failed. GitHub Actions is the executable test environment.
- GitHub Pages workflow succeeded, but direct browser interaction with the live page could not be independently verified in this session.
- Known Stage 6 issue: first application render waits for database seed and expected-result preparation.

## NEXT ACTION

Continue Stage 3: inspect the outstanding Stage 3 branches against main and reconcile any unique lesson edits before editing more curriculum content.
