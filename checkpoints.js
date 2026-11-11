// Накопительные практические проверки: задачи объединяют уже изученные темы.
// Их результаты не входят в обычные 130 упражнений и не подменяют модульные тесты.
export const cumulativeCheckpoints = [
  {
    id: 'core-foundation-check',
    track: 'core',
    title: 'Рубеж 1 · Выборка и фильтрация',
    afterModule: 'sorting',
    skills: ['SELECT', 'WHERE', 'IN / BETWEEN', 'ORDER BY', 'LIMIT'],
    description: 'Вспомни выборку, несколько условий и сортировку. Способ решения выбираешь самостоятельно.',
    tasks: [
      {
        id: 'core-foundation-orders',
        title: 'Контроль качества заказов',
        prompt: 'Отделу контроля нужны пять самых дорогих доставленных заказов. Покажи номер заказа, дату оформления и сумму. При равенстве сумм первым должен идти заказ с меньшим номером.',
        solution: "SELECT order_id, created_at, total_amount FROM orders WHERE status = 'delivered' ORDER BY total_amount DESC, order_id LIMIT 5;",
        orderMatters: true
      },
      {
        id: 'core-foundation-customers',
        title: 'Клиенты для региональной кампании',
        prompt: 'Подготовь список клиентов Москвы и Казани, зарегистрированных с 1 апреля по 31 июля 2024 года включительно. Нужны идентификатор, имя, город и дата регистрации. Порядок — по дате регистрации, затем по идентификатору.',
        solution: "SELECT customer_id, customer_name, city, registered_at FROM customers WHERE city IN ('Москва', 'Казань') AND registered_at BETWEEN DATE '2024-04-01' AND DATE '2024-07-31' ORDER BY registered_at, customer_id;",
        orderMatters: true
      }
    ]
  },
  {
    id: 'core-aggregation-check',
    track: 'core',
    title: 'Рубеж 2 · Агрегация и условия',
    afterModule: 'aggregates',
    skills: ['WHERE', 'GROUP BY', 'HAVING', 'SUM', 'COUNT', 'ORDER BY'],
    description: 'Соедини фильтрацию строк с группировками и проверкой агрегированных показателей.',
    tasks: [
      {
        id: 'core-aggregation-statuses',
        title: 'Сводка по состояниям заказов',
        prompt: 'Руководителю нужна сводка по каждому статусу заказа: название статуса, количество заказов и общая сумма. Сначала покажи статусы с большим количеством заказов, при равенстве — по алфавиту.',
        solution: 'SELECT status, COUNT(*) AS orders_count, SUM(total_amount) AS total_amount FROM orders GROUP BY status ORDER BY orders_count DESC, status;',
        orderMatters: true
      },
      {
        id: 'core-aggregation-customers',
        title: 'Клиенты с крупным оборотом',
        prompt: 'Найди клиентов, общая сумма всех заказов которых строго больше 3000. Покажи идентификатор клиента и общую сумму, начиная с самой большой; при равенстве сортируй по идентификатору.',
        solution: 'SELECT customer_id, SUM(total_amount) AS total_amount FROM orders GROUP BY customer_id HAVING SUM(total_amount) > 3000 ORDER BY total_amount DESC, customer_id;',
        orderMatters: true
      }
    ]
  },
  {
    id: 'core-joins-check',
    track: 'core',
    title: 'Рубеж 3 · Соединения и зерно',
    afterModule: 'joins',
    skills: ['JOIN', 'LEFT JOIN', 'GROUP BY', 'NULL', 'Зерно данных'],
    description: 'Проверь, умеешь ли сохранять нужные строки и не искажать показатели соединениями.',
    tasks: [
      {
        id: 'core-joins-stores',
        title: 'Доставки по всем магазинам',
        prompt: 'Подготовь отчёт по каждому магазину, включая магазины без заказов. Покажи название магазина и количество его доставленных заказов. Отсортируй по названию магазина.',
        solution: "SELECT s.store_name, COUNT(o.order_id) FILTER (WHERE o.status = 'delivered') AS delivered_orders FROM stores s LEFT JOIN orders o ON o.store_id = s.store_id GROUP BY s.store_id, s.store_name ORDER BY s.store_name;",
        orderMatters: true
      },
      {
        id: 'core-joins-items',
        title: 'Сверка суммы и товарных позиций',
        prompt: 'Для каждого заказа покажи его номер, записанную в заказе сумму и сумму всех товарных позиций (количество × цена за единицу). Если позиций нет, сумма позиций должна быть равна нулю. Отсортируй по номеру заказа.',
        solution: 'SELECT o.order_id, o.total_amount, COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS items_amount FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.order_id GROUP BY o.order_id, o.total_amount ORDER BY o.order_id;',
        orderMatters: true
      }
    ]
  }
];

export const checkpointTaskIds = cumulativeCheckpoints.flatMap(checkpoint => checkpoint.tasks.map(task => task.id));
