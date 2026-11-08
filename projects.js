export const projects = [
  {
    id: 'ecommerce',
    title: 'E-commerce аналитика',
    subtitle: 'Продажи, клиенты и повторные покупки',
    level: 'Начальный · средний',
    audience: 'Для аналитика, который должен объяснить, за счёт чего меняется выручка и возвращаются ли клиенты.',
    context: 'Интернет-магазин растёт, но руководство видит только общую сумму продаж. Нужно понять динамику чистой выручки, поведение когорт и качество повторных покупок.',
    objective: 'Подготовить аналитическую записку о выручке и клиентской активности, отделив реальные изменения поведения от эффекта возвратов и состава клиентских групп.',
    dataset: 'Исторический e-commerce набор: 48 клиентов, 1 158 заказов за 2023–2025 годы, товарные позиции, возвраты и повторные покупки.',
    wrapUp: {
      title: 'Решение для руководства',
      checks: [
        'Сверь сумму заказа с суммой его товарных позиций до вычета возвратов. При расчётах на уровне заказа не допускай размножения строк после соединения с позициями.',
        'Отдели состоявшиеся продажи от новых и отменённых заказов. Полные и частичные возвраты должны уменьшать чистую выручку.',
        'В когортном расчёте оставь одного клиента на месяц активности и не меняй исходный размер когорты в знаменателе.'
      ],
      prompts: [
        'Как менялась чистая выручка за период и в какие месяцы изменение заметнее всего?',
        'Какие когорты сохраняют активность во втором и третьем месяце жизни?',
        'Какие каналы отличаются по доле повторных покупателей и что ещё нужно проверить перед перераспределением бюджета?'
      ],
      notePrompt: 'Составь короткую записку для коммерческого директора: наблюдение по выручке, вывод по когортам и каналам, возможная бизнес-гипотеза и следующий шаг для проверки.',
      limitation: 'В наборе 48 клиентов и синтетическая история за 2023–2025 годы. В нём нет рекламных расходов и маржинальности, поэтому доля повторных клиентов не доказывает прибыльность канала и не позволяет оценить CAC или причинный эффект маркетинга.',
      review: {
        prompt: 'Выручка за месяц выросла, но доля клиентов с повторными покупками снизилась. Какой вывод обоснован на основании этих двух метрик?',
        options: [
          'Канал привлечения точно стал хуже, поэтому его бюджет нужно сократить.',
          'Выручка и повторные покупки описывают разные стороны бизнеса. Перед объяснением изменения нужно разложить результат на число покупателей, средний чек, возвраты и состав каналов.',
          'Повторные покупки не влияют на выручку, поэтому вторую метрику можно игнорировать.'
        ],
        correctIndex: 1,
        explanation: 'Рост выручки сам по себе не объясняет причину изменения, а снижение доли повторных покупателей не показывает, какой канал это вызвал. Нужны дополнительные разрезы и данные о затратах, прежде чем рекомендовать менять бюджет.'
      }
    },
    tasks: [
      {
        id: 'ecommerce-monthly-net-revenue',
        title: 'Динамика чистой выручки',
        brief: 'Коммерческий директор хочет увидеть, как менялась выручка магазина по месяцам за весь доступный период.',
        conditions: 'Учитывай только состоявшиеся продажи. Полные и частичные возвраты должны уменьшать выручку; новые и отменённые заказы не должны увеличивать её. Периоды выведи в календарном порядке.',
        expected: 'Одна строка на календарный месяц: месяц и чистая выручка после возвратов.',
        orderMatters: true,
        solution: `SELECT DATE_TRUNC('month', created_at)::date AS month,
       SUM(total_amount - refund_amount)::numeric(12,2) AS net_revenue
FROM analytics_orders
WHERE status IN ('delivered','shipped','refunded')
GROUP BY 1
ORDER BY 1;`
      },
      {
        id: 'ecommerce-cohort-retention',
        title: 'Удержание клиентских когорт',
        brief: 'Команда маркетинга хочет понять, возвращаются ли клиенты после первой покупки и как меняется активность новых когорт.',
        conditions: 'Когорта определяется месяцем первой состоявшейся покупки. Считай клиента активным не более одного раза за месяц. Покажи первые три месяца жизни когорты; знаменатель должен оставаться равным исходному размеру этой когорты.',
        expected: 'Для каждой наблюдаемой когорты и возраста когорты: размер когорты, активные клиенты и retention в процентах.',
        orderMatters: true,
        solution: `WITH qualifying_orders AS (
  SELECT customer_id, created_at
  FROM analytics_orders
  WHERE status IN ('delivered','shipped')
),
cohorts AS (
  SELECT customer_id,
         DATE_TRUNC('month', MIN(created_at))::date AS cohort_month
  FROM qualifying_orders
  GROUP BY customer_id
),
cohort_sizes AS (
  SELECT cohort_month, COUNT(*)::int AS cohort_size
  FROM cohorts
  GROUP BY cohort_month
),
activity AS (
  SELECT DISTINCT c.cohort_month,
         q.customer_id,
         (
           (DATE_PART('year', DATE_TRUNC('month', q.created_at)) - DATE_PART('year', c.cohort_month)) * 12
           + DATE_PART('month', DATE_TRUNC('month', q.created_at)) - DATE_PART('month', c.cohort_month)
         )::int AS age_month
  FROM qualifying_orders q
  JOIN cohorts c USING (customer_id)
  WHERE q.created_at >= c.cohort_month
    AND q.created_at < c.cohort_month + INTERVAL '3 months'
)
SELECT a.cohort_month,
       a.age_month,
       s.cohort_size,
       COUNT(DISTINCT a.customer_id)::int AS active_customers,
       ROUND(100.0 * COUNT(DISTINCT a.customer_id) / s.cohort_size, 2)::numeric(6,2) AS retention_pct
FROM activity a
JOIN cohort_sizes s USING (cohort_month)
WHERE a.age_month BETWEEN 0 AND 2
GROUP BY a.cohort_month, a.age_month, s.cohort_size
ORDER BY a.cohort_month, a.age_month;`
      },
      {
        id: 'ecommerce-repeat-customers',
        title: 'Повторные покупки по каналам привлечения',
        brief: 'Маркетинг распределяет бюджет между каналами и хочет понять, какие каналы приводят клиентов, которые возвращаются за следующими покупками.',
        conditions: 'Считай только состоявшиеся покупки. Клиент должен учитываться один раз внутри своего канала, независимо от количества заказов.',
        expected: 'По каждому каналу: число клиентов с покупками, число клиентов с повторными покупками и доля повторных клиентов.',
        orderMatters: true,
        solution: `WITH customer_purchases AS (
  SELECT c.acquisition_channel,
         c.customer_id,
         COUNT(o.order_id) FILTER (WHERE o.status IN ('delivered','shipped'))::int AS purchases
  FROM analytics_customers c
  LEFT JOIN analytics_orders o USING (customer_id)
  GROUP BY c.acquisition_channel, c.customer_id
)
SELECT acquisition_channel,
       COUNT(*)::int AS customers,
       COUNT(*) FILTER (WHERE purchases > 1)::int AS repeat_customers,
       ROUND(
         100.0 * COUNT(*) FILTER (WHERE purchases > 1) / NULLIF(COUNT(*), 0),
         2
       )::numeric(6,2) AS repeat_customer_pct
FROM customer_purchases
GROUP BY acquisition_channel
ORDER BY acquisition_channel;`
      }
    ]
  },
  {
    id: 'delivery',
    title: 'Аналитика доставки',
    subtitle: 'Скорость, SLA и проблемные участки',
    level: 'Средний',
    audience: 'Для аналитика операционной команды, который оценивает качество выполнения заказов и ищет причины задержек.',
    context: 'Сеть магазинов доставляет заказы в разных городах. Руководство хочет понять, где нарушаются сроки, какие этапы занимают больше всего времени и где чаще отменяют заказы.',
    objective: 'Подготовить операционный отчёт по соблюдению SLA, распределению времени доставки и отменам, чтобы определить приоритетные точки улучшения.',
    dataset: 'Исторический набор заказов за 2023–2025 годы с временными событиями создания, оплаты, отправки, доставки, отмены и возврата.',
    wrapUp: {
      title: 'Операционный вывод',
      checks: [
        'Сверни журнал событий до одной строки на заказ до соединения с таблицей заказов. Иначе несколько событий одного заказа исказят количество и распределение времени.',
        'Проверь хронологию создания, отправки и доставки. Для расчёта длительности используй только заказы с полным набором нужных событий.',
        'Сравни долю SLA на одной и той же совокупности завершённых доставок. Отмены анализируй отдельно, не смешивая их со временем доставленных заказов.'
      ],
      prompts: [
        'В каких магазинах чаще нарушается SLA и насколько надёжно сравнение с учётом числа доставок?',
        'На каком этапе возникает основная задержка: до отправки или после неё?',
        'Совпадают ли каналы с высокой долей отмен и магазины с долгой доставкой? Какие данные нужны, чтобы проверить возможную связь?'
      ],
      notePrompt: 'Подготовь краткий операционный вывод: где виден риск для SLA, какой этап стоит исследовать первым, какие дополнительные данные помогут проверить причину и какое действие стоит проверить пилотом.',
      limitation: 'SLA в этом кейсе равен 144 часам. Перцентильные оценки рассчитаны по заказам с полным набором событий; в исторической выборке 874 завершённые доставки. Данные синтетические и не содержат причин задержки, загрузки курьеров или дорожных условий, поэтому нельзя приписывать проблему конкретному исполнителю.',
      review: {
        prompt: 'В общей проверке набора медиана доставки равна 144 часам, а P90 — 192 часам. Как корректнее интерпретировать эти значения?',
        options: [
          'Все заказы доставляются примерно за 144 часа, потому что это медиана.',
          'Половина наблюдений находится не выше медианы, но верхняя часть распределения заметно длиннее. Чтобы найти источник задержек, нужно сравнить перцентили по магазинам и этапам.',
          'P90 означает, что ровно 90% заказов доставлялись дольше 192 часов.'
        ],
        correctIndex: 1,
        explanation: 'Медиана — это 50-й перцентиль, а P90 — граница, ниже которой находится около 90% наблюдений. Разница между ними указывает на длинный верхний хвост, но сама по себе не объясняет причину задержки.'
      }
    },
    tasks: [
      {
        id: 'delivery-sla-by-store',
        title: 'Соблюдение SLA по магазинам',
        brief: 'Операционный директор установил норматив: заказ должен быть доставлен не позднее чем через 144 часа после создания. Нужно сравнить магазины.',
        conditions: 'В расчёт включай только завершённые доставки. Срок измеряй от создания заказа до фактической доставки. Покажи количество завершённых заказов и долю доставок в пределах SLA.',
        expected: 'По каждому магазину: завершённые доставки, доставки в SLA и процент соблюдения норматива.',
        orderMatters: true,
        solution: `WITH event_times AS (
  SELECT order_id,
         MIN(event_at) FILTER (WHERE event_type = 'created') AS created_at,
         MIN(event_at) FILTER (WHERE event_type = 'delivered') AS delivered_at
  FROM analytics_order_events
  GROUP BY order_id
),
finished AS (
  SELECT o.store_id,
         EXTRACT(EPOCH FROM (e.delivered_at - e.created_at)) / 3600.0 AS delivery_hours
  FROM analytics_orders o
  JOIN event_times e USING (order_id)
  WHERE o.status IN ('delivered','refunded')
    AND e.created_at IS NOT NULL
    AND e.delivered_at IS NOT NULL
)
SELECT s.store_name,
       COUNT(*)::int AS delivered_orders,
       COUNT(*) FILTER (WHERE f.delivery_hours <= 144)::int AS within_sla,
       ROUND(
         100.0 * COUNT(*) FILTER (WHERE f.delivery_hours <= 144) / COUNT(*),
         2
       )::numeric(6,2) AS sla_pct
FROM finished f
JOIN stores s USING (store_id)
GROUP BY s.store_name
ORDER BY s.store_name;`
      },
      {
        id: 'delivery-percentiles-by-store',
        title: 'Медиана и P90 времени доставки',
        brief: 'Среднее время может скрывать длинный хвост задержек. Руководство хочет сравнить типичный срок и опыт самых медленных 10% доставок.',
        conditions: 'Считай время от создания до доставки и от отправки до доставки отдельно. Используй только заказы с полным набором этих событий; не заменяй медиану средним.',
        expected: 'По каждому магазину: количество доставок, медиана и P90 для общего времени и этапа после отправки.',
        orderMatters: true,
        solution: `WITH event_times AS (
  SELECT order_id,
         MIN(event_at) FILTER (WHERE event_type = 'created') AS created_at,
         MIN(event_at) FILTER (WHERE event_type = 'shipped') AS shipped_at,
         MIN(event_at) FILTER (WHERE event_type = 'delivered') AS delivered_at
  FROM analytics_order_events
  GROUP BY order_id
),
durations AS (
  SELECT o.store_id,
         EXTRACT(EPOCH FROM (e.delivered_at - e.created_at)) / 3600.0 AS total_hours,
         EXTRACT(EPOCH FROM (e.delivered_at - e.shipped_at)) / 3600.0 AS after_shipping_hours
  FROM analytics_orders o
  JOIN event_times e USING (order_id)
  WHERE o.status IN ('delivered','refunded')
    AND e.created_at IS NOT NULL
    AND e.shipped_at IS NOT NULL
    AND e.delivered_at IS NOT NULL
)
SELECT s.store_name,
       COUNT(*)::int AS delivered_orders,
       ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY d.total_hours)::numeric, 2) AS median_total_hours,
       ROUND(percentile_cont(0.9) WITHIN GROUP (ORDER BY d.total_hours)::numeric, 2) AS p90_total_hours,
       ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY d.after_shipping_hours)::numeric, 2) AS median_after_shipping_hours,
       ROUND(percentile_cont(0.9) WITHIN GROUP (ORDER BY d.after_shipping_hours)::numeric, 2) AS p90_after_shipping_hours
FROM durations d
JOIN stores s USING (store_id)
GROUP BY s.store_name
ORDER BY s.store_name;`
      },
      {
        id: 'delivery-cancellations-by-channel',
        title: 'Отмены по каналам продаж',
        brief: 'Команда заметила, что количество отмен растёт, но не знает, связано ли это с конкретным каналом оформления заказов.',
        conditions: 'Сравни каналы на одном уровне агрегации. Отменой считай только заказы со статусом cancelled; знаменатель — все созданные заказы канала.',
        expected: 'По каждому каналу: число заказов, отмены и доля отмен в процентах.',
        orderMatters: true,
        solution: `SELECT sales_channel,
       COUNT(*)::int AS total_orders,
       COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_orders,
       ROUND(
         100.0 * COUNT(*) FILTER (WHERE status = 'cancelled') / COUNT(*),
         2
       )::numeric(6,2) AS cancellation_pct
FROM analytics_orders
GROUP BY sales_channel
ORDER BY sales_channel;`
      }
    ]
  },
  {
    id: 'product',
    title: 'Product Analytics',
    subtitle: 'Воронка, активность и удержание',
    level: 'Средний · продвинутый',
    audience: 'Для аналитика продукта, который исследует путь пользователя от первого взаимодействия до целевого действия.',
    context: 'Продуктовая команда получает события из пользовательских сессий. Нужно понять, на каких этапах теряются пользователи, возвращаются ли они в продукт и как отличаются первые месяцы после регистрации.',
    objective: 'Подготовить базовый продуктовый отчёт: воронка сессий, месячная активность и удержание новых когорт.',
    dataset: 'Отдельная событийная модель: 48 пользователей и 576 сессий с последовательностью событий от просмотра страницы до покупки, включая незавершённые сессии.',
    wrapUp: {
      title: 'Продуктовый вывод',
      checks: [
        'Для воронки используй сессию как единицу наблюдения: одна сессия создаёт несколько событий, поэтому число событий не равно числу сессий.',
        'Проверь временной порядок этапов, повторные события и окно конверсии. Наличие события покупки без корректной последовательности не доказывает прохождение всей воронки.',
        'Для активности и retention перейди на зерно «пользователь — календарный месяц», убери повторения внутри месяца и сохрани исходный размер когорты в знаменателе.'
      ],
      prompts: [
        'На каком переходе воронки наибольшая абсолютная и относительная потеря сессий? Совпадают ли эти ответы?',
        'Как меняются месячная активность и доля возвращающихся пользователей?',
        'Какие когорты удерживают активность на первом и втором месяце после старта?'
      ],
      notePrompt: 'Сформулируй вывод для продуктовой команды: наиболее проблемный переход, динамика возвращаемости, наблюдение по когортам и гипотеза для следующего эксперимента.',
      limitation: 'Набор содержит 48 пользователей и 576 синтетических сессий. Воронка измеряется на уровне сессии, а удержание — на уровне пользователя и месяца; эти знаменатели нельзя смешивать. Наблюдаемая потеря на шаге не доказывает, почему пользователь ушёл.',
      review: {
        prompt: 'Почему в продуктовой воронке нужно считать уникальные session_id на каждом этапе, а не количество строк product_events?',
        options: [
          'Потому что один пользователь может создать несколько сессий, и их нужно объединить в одну.',
          'Потому что одна сессия содержит несколько событий. Подсчёт строк завысит число прохождений этапа; нужно считать сессии, в которых этап присутствует.',
          'Потому что события одного типа всегда должны иметь одинаковое время.'
        ],
        correctIndex: 1,
        explanation: 'Единица анализа здесь — сессия. Событий в ней несколько, а повторное событие может добавить ещё строки. Счёт событий измеряет активность событий, но не число сессий, достигших этапа.'
      }
    },
    tasks: [
      {
        id: 'product-session-funnel',
        title: 'Конверсия по этапам воронки',
        brief: 'Продакт-менеджер хочет увидеть, сколько сессий проходит каждый этап пользовательского пути и на каком переходе теряется больше всего сессий.',
        conditions: 'Считай уникальные сессии на каждом этапе, а не количество событий. Сессия, дошедшая до покупки, должна учитываться и на предыдущих этапах. Рассчитай конверсию каждого соседнего перехода.',
        expected: 'Одна строка с общим числом сессий, количеством сессий на каждом этапе и процентами перехода между этапами.',
        orderMatters: false,
        solution: `WITH session_stages AS (
  SELECT session_id,
         BOOL_OR(event_type = 'page_view') AS page_view,
         BOOL_OR(event_type = 'product_view') AS product_view,
         BOOL_OR(event_type = 'add_to_cart') AS add_to_cart,
         BOOL_OR(event_type = 'checkout_started') AS checkout_started,
         BOOL_OR(event_type = 'purchase') AS purchase
  FROM product_events
  GROUP BY session_id
),
counts AS (
  SELECT COUNT(*)::int AS sessions,
         COUNT(*) FILTER (WHERE page_view)::int AS page_view_sessions,
         COUNT(*) FILTER (WHERE product_view)::int AS product_view_sessions,
         COUNT(*) FILTER (WHERE add_to_cart)::int AS cart_sessions,
         COUNT(*) FILTER (WHERE checkout_started)::int AS checkout_sessions,
         COUNT(*) FILTER (WHERE purchase)::int AS purchase_sessions
  FROM session_stages
)
SELECT *,
       ROUND(100.0 * product_view_sessions / NULLIF(page_view_sessions,0), 2)::numeric(6,2) AS page_to_product_pct,
       ROUND(100.0 * cart_sessions / NULLIF(product_view_sessions,0), 2)::numeric(6,2) AS product_to_cart_pct,
       ROUND(100.0 * checkout_sessions / NULLIF(cart_sessions,0), 2)::numeric(6,2) AS cart_to_checkout_pct,
       ROUND(100.0 * purchase_sessions / NULLIF(checkout_sessions,0), 2)::numeric(6,2) AS checkout_to_purchase_pct
FROM counts;`
      },
      {
        id: 'product-monthly-active-users',
        title: 'Активные и возвращающиеся пользователи',
        brief: 'Команда продукта хочет отслеживать месячную активность и понимать, какая часть пользователей уже взаимодействовала с продуктом раньше.',
        conditions: 'Пользователь активен, если у него было хотя бы одно событие в календарном месяце. Повторным считай пользователя, у которого активность была до текущего месяца.',
        expected: 'По каждому месяцу: активные пользователи, возвращающиеся пользователи и доля возвращающихся.',
        orderMatters: true,
        solution: `WITH monthly_active AS (
  SELECT DISTINCT customer_id,
         DATE_TRUNC('month', event_at)::date AS activity_month
  FROM product_events
),
first_activity AS (
  SELECT customer_id, MIN(activity_month) AS first_month
  FROM monthly_active
  GROUP BY customer_id
)
SELECT m.activity_month,
       COUNT(*)::int AS monthly_active_users,
       COUNT(*) FILTER (WHERE m.activity_month > f.first_month)::int AS returning_users,
       ROUND(
         100.0 * COUNT(*) FILTER (WHERE m.activity_month > f.first_month) / COUNT(*),
         2
       )::numeric(6,2) AS returning_user_pct
FROM monthly_active m
JOIN first_activity f USING (customer_id)
GROUP BY m.activity_month
ORDER BY m.activity_month;`
      },
      {
        id: 'product-cohort-retention',
        title: 'Retention продуктовых когорт',
        brief: 'Продуктовая команда хочет сравнить удержание пользователей, впервые проявивших активность в разные месяцы.',
        conditions: 'Когорта определяется месяцем первого события пользователя. Один пользователь может учитываться в месяце только один раз. Рассчитай активность в месяц вступления и в два следующих календарных месяца, используя исходный размер когорты как знаменатель.',
        expected: 'Для каждой когорты и возраста когорты: размер когорты, активные пользователи и retention в процентах.',
        orderMatters: true,
        solution: `WITH monthly_activity AS (
  SELECT DISTINCT customer_id,
         DATE_TRUNC('month', event_at)::date AS activity_month
  FROM product_events
),
cohorts AS (
  SELECT customer_id, MIN(activity_month) AS cohort_month
  FROM monthly_activity
  GROUP BY customer_id
),
cohort_sizes AS (
  SELECT cohort_month, COUNT(*)::int AS cohort_size
  FROM cohorts
  GROUP BY cohort_month
),
activity AS (
  SELECT c.cohort_month,
         m.customer_id,
         (
           (DATE_PART('year', m.activity_month) - DATE_PART('year', c.cohort_month)) * 12
           + DATE_PART('month', m.activity_month) - DATE_PART('month', c.cohort_month)
         )::int AS age_month
  FROM monthly_activity m
  JOIN cohorts c USING (customer_id)
  WHERE m.activity_month >= c.cohort_month
    AND m.activity_month < c.cohort_month + INTERVAL '3 months'
)
SELECT a.cohort_month,
       a.age_month,
       s.cohort_size,
       COUNT(DISTINCT a.customer_id)::int AS active_users,
       ROUND(100.0 * COUNT(DISTINCT a.customer_id) / s.cohort_size, 2)::numeric(6,2) AS retention_pct
FROM activity a
JOIN cohort_sizes s USING (cohort_month)
WHERE a.age_month BETWEEN 0 AND 2
GROUP BY a.cohort_month, a.age_month, s.cohort_size
ORDER BY a.cohort_month, a.age_month;`
      }
    ]
  }
];

export const projectTaskCount = projects.reduce((sum, project) => sum + project.tasks.length, 0);
