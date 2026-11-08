# SQL Academy — актуальное состояние и передача разработки

Последнее обновление: 2026-11-09; после первичного UX/UI-аудита и внедрения адресных accessibility/mobile улучшений.

## 1. Репозиторий и текущий HEAD

- Репозиторий: https://github.com/vladsimbro/SQL
- GitHub Pages: https://vladsimbro.github.io/SQL/
- Основная ветка: main.
- Текущий HEAD main перед этой status-only актуализацией: 55d861b3132bf2676478702e18492c330668767b.
- Последний code/test commit: 8bd962da7de1110f16573f7c0aeabda98f50ea1a.
- Последний полностью успешный end-to-end workflow до accessibility-изменений: 42529611099 на commit 5fd2f24cee76a3c2ea05253a83537527c138fb05; validate/deploy/browser-smoke — success.
- Последние runtime changes: commit 615d457462e07d7b886818e455ce88b40b2a7b26; validate и deploy — success. Browser-smoke для этого SHA остаётся in_progress без опубликованных шагов/логов на момент обновления.
- Последний commit 8bd962da7de1110f16573f7c0aeabda98f50ea1a исправляет parser цветов в новых accessibility assertions; workflow 42529995249 ещё pending.
- Последний Pages workflow: 42529994915 для SHA 8bd962d, completed/success.
- Последний application build: 20261109-107.
- Последний curriculum/runtime feature commit для e103: 4c11353646d9ddf9bb0caca5a48a7d8444625df5; последующие commits согласовали cache keys, уникальную связь практики, счётчики и PGlite expected-result tests.
- URL/hash-навигация проверена workflow 42524697272; backup negative cases — workflow 42525873380.
- GitHub API подтверждает только одну ветку: main. Открытых Pull Requests и Issues нет.
- Незавершённых переносов между ветками нет.
- Изменения выполняются через GitHub API. Локальный clone и локальный git status в этой сессии не использовались.

## 2. Текущее состояние платформы

SQL Academy — статическая интерактивная платформа для обучения SQL и PostgreSQL с практикой, проектами и браузерной SQL-средой.

Технический стек:
- HTML, CSS, JavaScript ES modules.
- GitHub Pages и GitHub Actions.
- PGlite 0.5.15, CodeMirror 5.
- localStorage для прогресса и черновиков.
- Playwright для browser-smoke.

Подтверждённая структура:
- 2 самостоятельных курса: SQL для аналитика данных и PostgreSQL.
- 25 модулей, 173 урока.
- 103 обычных задания.
- 350 случайных заданий по 14 темам.
- 100 контрольных вопросов.
- 72 термина глоссария, 13 групп SQL-справочника.
- 14 seed tables.
- 3 практических проекта, по 3 SQL-задачи в каждом.

## 3. Самостоятельные курсы

| Курс | Программа | Состояние |
|---|---:|---|
| SQL для аналитика данных | 17 модулей, 112 уроков | DEPLOYED_VERIFIED |
| PostgreSQL | 8 модулей, 61 урок | DEPLOYED_VERIFIED |

Программы, практика и прогресс курсов разделены. Стабильные lesson IDs сохранены; миграция прогресса существует. Не объединять маршруты и не переносить в основной SQL-курс дисциплины Excel, Power BI или статистики.

Будущие направления:
- Excel / Google Sheets — PLANNED, не реализовывать заглушку.
- Power BI — PLANNED, не реализовывать заглушку.
- Статистика и аналитика данных — PLANNED, не реализовывать заглушку.

## 4. Практические проекты

| Проект | Содержание | Состояние |
|---|---|---|
| E-commerce | Продажи, клиенты, повторные покупки, выручка и корректность метрик | DEPLOYED_VERIFIED |
| Аналитика доставки | SLA, задержки, отмены, разрез магазин × канал | DEPLOYED_VERIFIED |
| Product Analytics | События, сессии, воронка, хронология и потери конверсии | DEPLOYED_VERIFIED |

В каждом проекте три SQL-задачи с выполнением и автопроверкой, финальная аналитическая записка и проверка интерпретации. Прогресс, черновики, заметки и ответы проектов сохраняются отдельно.

## 5. Реализованные общие возможности

- Каталог курсов, отдельные программы и боковая навигация.
- Раздельная практика по курсам и отдельный раздел проектов.
- SQL Playground на PGlite, учебная база, схема таблиц.
- Шпаргалка и глоссарий.
- Светлая и тёмная темы.
- Сохранение прогресса курсов, ответов, SQL-черновика, проектных данных и темы в localStorage.
- Экспорт и восстановление локальных данных через JSON backup формата sql-academy-backup, version 1.
- Backup содержит прогресс двух курсов, ответы на вопросы и контрольные, черновик Playground, прогресс и черновики проектов, заметки, review-ответы и тему.
- Импорт валидирует структуру, ограничивает файл размером 5 МБ, требует подтверждение и восстанавливает прежние данные при ошибке частичной записи.
- Существующие unit/smoke проверки backup включают валидность формата, несовместимую версию, повреждённый JSON, неизвестные разделы, некорректные поля и rollback.
- Положительный browser round-trip ранее проверил экспорт, очистку локальных разделов, импорт, восстановление и миграцию legacy lesson ID.

Ограничения:
- Учебная БД PGlite работает в памяти браузера и сбрасывается после перезагрузки.
- Прогресс/черновики привязаны к браузеру и origin; синхронизации аккаунта/облака нет.
- Для переноса данных между устройствами пользователь вручную экспортирует и импортирует JSON.
- PGlite загружается с CDN.
- Автоматизированный Chromium smoke не заменяет ручную проверку всех браузеров и физических устройств.

## 6. URL-навигация и история браузера

Статус: DEPLOYED_VERIFIED.

- Hash URL поддерживает главные экраны, каталог, выбранный курс, модуль/урок, практику/задание, проект/задачу и контрольную работу.
- Восстановление состояния реализовано для прямого открытия URL, reload, popstate, hashchange и Back/Forward.
- Сохранены стабильные IDs и существующая внутренняя навигация; неизвестные параметры обрабатываются безопасным возвратом в допустимый раздел.
- Исправлены cache key mismatch после смены build и изоляция тестовой фикстуры контролируемого отказа PGlite.
- Workflow 42524697272 на commit a045602 завершился success по всем трём jobs: validate, deploy и browser-smoke.

## 7. Завершённые улучшения текущей сессии

### Отрицательные сценарии импорта backup

Статус: DEPLOYED_VERIFIED.

В scripts/browser-smoke.mjs проверяются:
1. Повреждённый JSON.
2. Неподдерживаемая версия резервной копии.
3. Файл размером больше 5 МБ.
4. Отказ от восстановления после подтверждения.

Для ошибочных и отменённого сценариев сравниваются backup localStorage keys до и после операции, проверяется отсутствие навигации/перезагрузки. Положительный round-trip импорта и миграция legacy lesson ID остаются зелёными.

Подтверждение: workflow 42525873380 на code commit be8196d прошёл validate, deploy и browser-smoke.

### Практика по Fan-out и безопасной агрегации

Статус: DEPLOYED_VERIFIED.

Аудит показал, что урок «Fan-out: соединение нескольких таблиц деталей» содержал теорию и контрольный вопрос, но не имел собственной привязанной практики.

Добавлено задание e103 «Сохрани зерно заказа при двух деталях»:
- Нужно получить стоимость товарных позиций и число событий на уровне заказа.
- Требуется сохранить заказы без позиций или событий.
- Условие не перечисляет готовый алгоритм или SQL-команды.
- Эталон сначала агрегирует независимые таблицы деталей до одной строки на заказ, затем соединяет агрегаты с orders.
- Задание привязано только к уроку Fan-out через practiceIds; дубль связи с соседним уроком предварительной агрегации удалён.
- Банк обычных заданий вырос с 102 до 103; SELECT-заданий — с 88 до 89.
- index.html, README.md и curriculum smoke-test синхронизированы с 103 заданиями.
- version.json обновлён до 20261109-106; все шесть импортов локальных JS-модулей в app.js синхронизированы с новым cache key.

Точные PGlite expected-result проверки e103:
- Решение возвращает ровно 12 строк для 12 исходных заказов и 12 уникальных order_id.
- Для заказа 101 сумма товарных позиций равна 1 200, число событий — 2.
- Заказ 104 без событий сохраняется, events_count равен 0.
- После добавления искусственного заказа 113 без позиций и событий тот же запрос возвращает 13 строк; метрики заказа 113 равны (0, 0).
- Уникальная привязка e103 к уроку Fan-out проверяется отдельно.

Подтверждение: workflow 42526644205 на commit 10f0f56 завершился success по validate, deploy и browser-smoke после повторного запуска только упавшего browser job. Pages deployment для того же SHA также success.

### Аудит JOIN, кардинальности и агрегации

Статус: TESTED; пробелов в содержании, требующих нового урока или перестановки модулей, не обнаружено.

Проверено:
- COUNT(*) vs COUNT(right_key) при LEFT JOIN и сохранение нулевых групп.
- COUNT(DISTINCT order_id) для числа заказов отдельно от SUM(quantity) для количества физических единиц.
- Разница фильтрации правой таблицы в ON и WHERE.
- Сохранение магазинов, сотрудников, клиентов и заказов без совпадающих строк.
- Fan-out при соединении независимых таблиц деталей и безопасная предварительная агрегация.
- Сверка заказов и оплат после агрегации payments до зерна заказа.
- Уроки кардинальности и fan-out уже объясняют кратность строк и последствия для бизнес-метрик.

25 random JOIN tasks устроены как 5 шаблонов × 5 вариантов:
1. Заказы с клиентами.
2. Магазины и заказы с LEFT JOIN и COUNT(order_id).
3. Сотрудники и заказы со статусным фильтром в ON.
4. Товары и позиции с COUNT(DISTINCT order_id) и SUM(quantity).
5. Сверка заказов и оплат через предварительную агрегацию payments.

Все 350 random tasks исполняются в curriculum smoke на PGlite; каждая random задача проверяется как read-only SELECT/CTE и должна возвращать rows. Для JOIN дополнительно существуют детальные проверки результата на уровне уроков и обычных упражнений, включая сохранение кратности строк и нулевых групп.

Порядок уроков не менялся: миграция legacy прогресса использует прежний moduleId:index; простая перестановка способна неверно перенести завершения на другие уроки. Дополнительный новый урок не нужен, пока не найден реальный пробел.

Ограничение тестового покрытия, записанное на будущее: общий random smoke исполняет все 25 JOIN решений, но не сравнивает каждое из них с отдельным независимо рассчитанным expected result. Следующая полезная задача — добавить такие проверки по пяти шаблонам, не раздувая курс.

## 7.1 Независимые regression checks для random JOIN

Статус: TESTED; независимые regression checks для 25 random JOIN вариантов прошли полный GitHub Actions workflow на актуальном main.

- Основной тестовый commit: cda363c6c14d30bd30054e767cf914c364e48604; корректировка ожидаемого результата: 0ff7123749eac681bc1fd3fb1f0b29a64d58d1a9.
- Файл: scripts/smoke-test.mjs.
- Первый workflow 42527695965 на cda363c завершился failure на шаге curriculum smoke; deploy и browser-smoke были пропущены. В 0ff7123 исправлен expectedCounts для статуса new с 1 на 2, так как fixture заказа 113 также входит в результат.
- Итоговый workflow 42527757551 на 0ff7123: validate success, deploy success, browser-smoke success. Отдельный Pages workflow 42527756866: completed/success.
- Для всех 25 вариантов из пяти семейств добавлено сравнение результата эталонного решения с независимым oracle-запросом на PGlite. Дополнительно проверяется уникальность ожидаемого ключа зерна в каждом результате.
- Oracle использует коррелированные подзапросы вместо тех же JOIN/агрегационных конструкций, что и решения заданий.
- Проверяются ожидаемое число строк для каждого варианта и корректность сохранения сортировки там, где она требуется условием.
- Дополнительные инварианты: магазин без заказов остаётся с нулём; сотрудники без заказов нужного статуса остаются с нулём; COUNT(DISTINCT order_id) отличается от SUM(quantity) (4 заказа и 5 единиц для категории «Продукты»); отсутствующая успешная оплата и refunded-платёж дают ноль.
- Сами условия, подсказки, решения и ID случайных заданий не менялись.
- Локальные npm/PGlite тесты в этой сессии не запускались: пакет @electric-sql/pglite отсутствует в локальном окружении, а сетевой доступ контейнера отключён. Результат подтверждён именно GitHub Actions, а не локальным запуском.

## 8. Проверки и CI

Workflow .github/workflows/pages.yml выполняет JS syntax checks, npm run test:curriculum, публикацию GitHub Pages и Playwright browser-smoke опубликованного сайта.

Последняя полностью успешная end-to-end проверка:
- Workflow: 42532828710.
- Commit: 85779d70437459441f68ccf76738d484ee9ee7c0.
- validate, deploy, browser-smoke: success.
- Browser-smoke подтвердил runtime build 20261109-109; shellReadyMs=632, recoveryMs=6872, resetReadyMs=5852.
- Artifact sql-academy-ux-audit-screenshots: ID 13638406396, 68 screenshots.

Последние runtime/accessibility changes:
- Build 20261109-107: light-theme contrast tokens, keyboard focus-visible, prefers-reduced-motion, instant navigation scroll при reduce и 1-column practice list при ширине <=360 px.
- Build 20261109-108: short-landscape sidebar с вертикальным overflow; исправлен дефект 667x375.
- Build 20261109-109: dashboard показывает 2 самостоятельных курса и отдельные динамические счётчики SQL · 112 / PostgreSQL · 61 вместо объединённой цифры 173.
- Последние commits после build 20261109-109 меняют только browser-smoke script; runtime assets не изменялись.

Browser-smoke assertions:
- Keyboard navigation активирует :focus-visible с видимой outline.
- Контраст light theme tokens muted/accent/sidebar label не ниже 4.5:1.
- prefers-reduced-motion выключает smooth scrolling и сокращает CSS transitions.
- При 320 px список задач практики перестраивается в одну колонку.
- Mobile dark/light walkthrough покрывает dashboard, catalog, SQL lesson, practice, assessment, schema, reference, glossary, project list и project details на 390/320 px; short landscape 667x375 проверяет scrollable sidebar.
- Mobile light theme: dashboard, catalog, SQL lesson, practice, assessment, schema, reference, glossary и project list на 390 px; dashboard, catalog, SQL lesson, practice, assessment, E-commerce, Delivery и Product Analytics project detail на 320 px.
- Desktop light theme walkthrough: course catalog, SQL/PostgreSQL lessons, practice, project catalog, E-commerce project, assessment, Playground, schema, reference и glossary на 1440 px.
- Dashboard smoke проверяет отдельные totals SQL 112 и PostgreSQL 61.
- Negative backup import fixtures подаются через File + DataTransfer + change event; проверяются malformed JSON, unsupported version, >5 MB и сохранность localStorage.
- Browser smoke подтверждает PGlite failure/retry, editor persistence offline/after reset, real PostgreSQL query, mobile menu Escape/focus restoration и backup restore confirmation.
- Последний artifact содержит 68 screenshots: desktop, dark/light, mobile 390/320, landscape 667x375.

Визуальный осмотр:
- Просмотрены dark/light mobile экраны dashboard, catalog, SQL lesson, practice, assessment, schema, reference, glossary и project detail.
- Просмотрены desktop light screenshots всех основных разделов. Типографика и вертикальная иерархия сохраняются; широкие схемы и глоссарий используют пространство desktop без переполнения.
- На 320 px light проверены PostgreSQL lesson, E-commerce, Delivery и Product Analytics project detail; контент, редактор и действия остаются в границах viewport.
- E-commerce, Delivery и Product Analytics project detail сохраняют вертикальный поток, блоки контекста, задания, редактора, аналитического вывода и черновика; горизонтального overflow нет.
- Длинные страницы остаются вертикально прокручиваемыми; двухколоночная перестройка на узких экранах не требуется.

Содержимое curriculum smoke:
- 25 модулей, 173 урока (SQL 112 + PostgreSQL 61), 100 knowledge checks, 72 термина, 13 групп справочника.
- 103 обычных запускаемых задания, включая 89 SELECT, 350 random sandbox tasks, 14 seed tables.
- 81 таблица ожидаемых результатов и 114 read-only SQL-примеров проверялись предыдущим полным baseline.
- Все 350 random решений выполняются на PGlite; проверяются read-only SELECT/CTE и массив rows.
- Backup checks включают export, schema validation, restore, rollback, round-trip и отрицательные UI сценарии.

Исторические полные проверки:
- Workflow 42532549641 на 2b7afe4: validate/deploy/browser-smoke success.
- Workflow 42532221074 на b920b19: validate/deploy/browser-smoke success.
- Workflow 42531862227 на 03245ca: validate/deploy/browser-smoke success.
- Workflow 42531466474 на 913a933: validate/deploy/browser-smoke success.
- Workflow 42527757551 на 0ff7123: validate/deploy/browser-smoke success, включая 25 independent JOIN oracle checks.

Ограничения:
- Локальный clone и локальные npm/Playwright команды в этой сессии не запускались; подтверждение получено через GitHub Actions.
- Ручное тестирование на физических iOS/Android устройствах и других browser engines не выполнялось.
- PGlite 0.5.15 остаётся CDN-зависимостью; первый запрос в browser-smoke намеренно блокируется для проверки retry, поэтому в логах могут быть ожидаемые initial ERR_FAILED.
## 9. GitHub и публикация

- Репозиторий: vladsimbro/SQL.
- Основная и единственная ветка: main.
- Последний code/test commit в main: 85779d70437459441f68ccf76738d484ee9ee7c0.
- После него в main выполнялись только status-only обновления PROJECT_STATUS.md; runtime code не менялся.
- Последний полностью успешный end-to-end commit: 85779d70437459441f68ccf76738d484ee9ee7c0.
- Открытых PR и Issues нет.
- Workflow 42532828710 на HEAD 85779d7: validate/deploy/browser-smoke success.
- Pages workflow 42532828642 на HEAD 85779d7: success.
- Pages workflow 42533060796 на status-only HEAD 18f1f06: success.
- Pages workflow 42533166574 на следующем status-only HEAD: success.
- Runtime build: 20261109-109.
- GitHub Pages: https://vladsimbro.github.io/SQL/
- Custom deploy job для HEAD 85779d7 завершился success; Pages workflow 42532828642 завершился success.
- Последняя status-only публикация для HEAD 18f1f06: Pages workflow 42533060796 success.
- Последние commits меняют только browser-smoke coverage; runtime assets и архитектура приложения не менялись после build 20261109-109.
- Удаление 29 устаревших refs выполнено ранее после проверки; аудит повторно запускать только при появлении новых веток.
- AUDIT.md удалён ранее; полезные сведения об аудите сохранены в истории документа.
- Автоматический Pages deployment может конфликтовать с custom deploy workflow, если два Pages deploy запускаются параллельно.
## 10. Принятые технические и образовательные решения

- Не менять стек HTML/CSS/JS, GitHub Pages, PGlite, CodeMirror и localStorage без объективной причины.
- SQL и PostgreSQL — отдельные самостоятельные курсы, отдельная практика и прогресс.
- Стабильные lesson/task IDs и localStorage keys нельзя менять без миграции и тестов.
- Стартовая учебная схема, историческая E-commerce модель и Product Analytics events — разные учебные наборы; не объединять без необходимости.
- Проверять SQL по результату выполнения, структуре, значениям, типам и кратности строк, а не только по тексту запроса.
- Не показывать готовый алгоритм решения до попытки пользователя.
- Не удалять полезные уроки ради сокращения количества и не раздувать программу повторяющимися объяснениями.
- Не создавать пустые курсы-заглушки.
- Обновлять version.json при изменении runtime-кода/кэшируемых клиентских модулей; изменение только тестов или PROJECT_STATUS.md само по себе не требует смены build.

## 11. UX/UI и пользовательский опыт

Статус этапа аудита и адресных исправлений: **AUDIT_CLOSED / IMPLEMENTED / DEPLOYED_VERIFIED**. Это не означает, что весь будущий UX/UI редизайн завершён: системная дизайн-система и обновление экранов остаются отдельными запланированными этапами.

### Итоговая классификация проблем

- **P0 — 0 подтверждённых проблем.** Нет блокирующих дефектов, потери данных или недоступных основных пользовательских сценариев в проверенной Chromium-матрице.
- **P1 — 0 подтверждённых проблем.** В проверенных сценариях не осталось подтверждённых серьёзных препятствий обучению или навигации.
- **P2 — остаточные ограничения и будущая работа:**
  - Нет ручной проверки на физических iOS/Android устройствах и альтернативных browser engines. Playwright Chromium не заменяет такую проверку.
  - Мобильная клавиатура, реальное сенсорное взаимодействие, системные safe areas и поведение при смене ориентации на физических устройствах требуют отдельного ручного прохода.
  - Полноценная системная дизайн-система и последовательное обновление ключевых экранов ещё не выполнялись; текущие изменения были адресными и не являются полным редизайном.
  - 17 media-query блоков, 27 inline style-атрибутов и 19 `!important` остаются техническими маркерами для будущей ревизии, но сами по себе не считаются дефектами и не требуют механической чистки.

### Выполнено и проверено

- Desktop light walkthrough: каталог, SQL/PostgreSQL lessons, practice, projects, assessment, Playground, schema, reference и glossary.
- Mobile light/dark walkthrough: dashboard, catalog, SQL lesson, practice, assessment, schema, reference, glossary, project list и project details.
- 320 px: PostgreSQL lesson, E-commerce, Delivery и Product Analytics project details; горизонтального overflow в проверенных экранах нет.
- 390 px: ключевые мобильные экраны и сценарии навигации.
- 667×375 landscape: исправлена прокрутка sidebar, нижние пункты навигации доступны.
- Keyboard focus-visible, light-theme contrast assertions (порог 4.5:1 для проверяемых пар), prefers-reduced-motion и instant scroll при reduce.
- Practice list на ширине <=360 px перестраивается в одну колонку.
- Dashboard показывает два самостоятельных курса и отдельные динамические счётчики SQL · 112 / PostgreSQL · 61, а не неоднозначную общую метрику 173.
- Проверены backup negative cases, PGlite retry, editor persistence, реальный PostgreSQL query, mobile menu Escape/focus restoration и отсутствие горизонтального overflow в тестируемых размерах.
- Screenshot artifact 13638406396: 68 кадров; ключевые desktop light и mobile light/dark кадры просмотрены.
- Runtime build: 20261109-109. Последний code/test commit: 85779d70437459441f68ccf76738d484ee9ee7c0. Последующие commits до текущего HEAD 843f7ed0d703bb1add2285f9015f35abbffa8a1f меняли только PROJECT_STATUS.md.
- Workflow 42532828710: validate, deploy и browser-smoke — success. Pages workflows 42532828642, 42533060796, 42533166574 и 42533244446 — success.

### Решение по UX/UI

Первичный UX/UI-аудит и адресный этап accessibility/mobile исправлений закрыты. Не начинать механическую чистку CSS и не объявлять весь UX/UI редизайн завершённым. Следующие этапы — информационная архитектура, дизайн-система, последовательное обновление ключевых экранов и ручная проверка физических устройств — остаются PLANNED и должны выполняться отдельными небольшими итерациями с регрессией.

---

## 12. Передача следующему чату

### Текущее состояние репозитория

- Репозиторий: https://github.com/vladsimbro/SQL
- Публикация: https://vladsimbro.github.io/SQL/
- Единственная ветка: main.
- Текущий HEAD main: 843f7ed0d703bb1add2285f9015f35abbffa8a1f.
- Последний code/test commit: 85779d70437459441f68ccf76738d484ee9ee7c0.
- После последнего code/test commit были только status/documentation commits; runtime code не менялся.
- Текущий runtime build: 20261109-109.
- Последний Pages workflow для текущего HEAD: 42533244446, completed/success.
- Открытых PR и Issues нет.

### Платформа

- SQL для аналитика данных: 17 модулей, 112 уроков.
- PostgreSQL: 8 модулей, 61 урок.
- Всего 25 модулей и 173 урока.
- 103 обычных задания, 350 random tasks по 14 темам, 100 контрольных вопросов.
- 72 термина глоссария, 13 групп SQL-справочника, 14 seed tables.
- 3 проекта: E-commerce, аналитика доставки, Product Analytics; по 3 SQL-задачи в каждом.
- Стабильные lesson IDs, раздельный прогресс курсов, URL-навигация, localStorage, backup/restore, PGlite и CodeMirror сохраняются.

### Последние завершённые направления

- Практика Fan-out: добавлено задание e103, связь только с нужным уроком, проверка зерна заказа и безопасной предварительной агрегации.
- Для 25 random JOIN вариантов добавлены независимые oracle regression checks; полный workflow прошёл.
- Browser smoke расширен проверками URL/history, backup negative cases, PGlite recovery, editor persistence, mobile navigation, narrow viewport и UX screenshot matrix.
- UX/UI audit и адресные accessibility/mobile исправления закрыты в рамках проверенной Chromium-матрицы; классификация: P0=0, P1=0, P2 — ручная проверка физических устройств/других движков и будущие системные UX/UI этапы.

### Следующая задача разработки

Начать **педагогический аудит основного SQL-курса на уровне самих уроков и связанной практики**, не меняя уроки автоматически и не раздувая количество контента.

Порядок:
1. Сначала составить карту всех 112 уроков по модулям: учебная цель, предпосылки, ключевая идея, пример, вопрос, связанное задание/практика.
2. Найти реальные проблемы: скачки сложности, повторение объяснений, темы без достаточного объяснения перед проверкой, задания без необходимой подготовки, слишком простые или угадываемые quiz distractors, неясные бизнес-условия, несоответствие между уроком и practiceIds.
3. Приоритизировать по влиянию на самостоятельность новичка: P0/P1/P2. Не считать отсутствие practiceIds дефектом автоматически: некоторые уроки могут закрепляться в связанных последующих задачах или контрольных.
4. Проверить сложные аналитические темы особенно внимательно: зерно, кардинальность JOIN, fan-out, предварительная агрегация, NULL, COUNT vs COUNT DISTINCT, WHERE/HAVING, подзапросы, CTE, окна, метрики и интерпретация результатов.
5. До внесения изменений показать конкретные находки с lesson IDs, доказательством и минимальным планом исправлений. Не переписывать хорошие уроки и не менять стабильные IDs/порядок без проверки миграции прогресса.
6. После согласованной/обоснованной серии правок добавить regression checks, обновить build/cache keys, выполнить полный GitHub Actions workflow и проверить Pages.
7. Обновить этот PROJECT_STATUS.md после каждого завершённого этапа.

### Последние подтверждённые проверки

- Workflow 42532828710 на commit 85779d7: validate/deploy/browser-smoke success.
- Browser build 20261109-109; shellReadyMs=632, recoveryMs=6872, resetReadyMs=5852.
- Screenshot artifact 13638406396: 68 screenshots, 14.7 MB.
- Pages workflow 42533244446 на текущем HEAD 843f7ed: success.
- Физические iOS/Android устройства и альтернативные browser engines не тестировались.
- Локальные npm/Playwright команды в этой сессии не запускались; результаты подтверждены GitHub Actions.
