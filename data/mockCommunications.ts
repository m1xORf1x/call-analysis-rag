/**
 * View-model для главной таблицы коммуникаций.
 *
 * ВАЖНО: это frontend-only view-model, специально расширенный под полный
 * набор колонок Figma (node 1:35849 → 1:35954 header → 1:36033 row).
 * Backend-типы (types/index.ts, CallRecord) НЕ меняются — сюда попадают
 * только поля, нужные для точного визуального повторения таблицы.
 *
 * callId связывает строку с записью в mockCalls.ts (используется существующим
 * popup, который в рамках этой правки не меняется).
 */

export type Tone = 'green' | 'blue' | 'red' | 'yellow' | 'gray' | 'purple'

export interface Tag {
  label: string
  tone: Tone
}

export interface CommunicationRow {
  id: string
  /** Связь с CallRecord из mockCalls.ts для popup */
  callId: string

  channelDirection: 'in' | 'out'
  channel: string /* "Входящий звонок" / "Исходящий звонок" */
  type: string /* "Первичная" / "Повторная" */

  mql: Tag | null
  sql: Tag | null
  crmLead: Tag | null

  date: string /* "3 апр 2026" */
  time: string /* "20:45" */

  contactName: string
  contactRole: 'Клиент' | 'Менеджер' | 'Агент'

  contactPhone: string
  manager: string
  durationLabel: string /* "02:20" */

  score: number | null
  scoreTone: Tone

  labels: Tag[] /* "Метка" — может быть несколько */

  city: string
  source: string

  managerTalkPct: number
  clientTalkPct: number

  department: string
  summary: string
}

export const mockCommunications: CommunicationRow[] = [
  {
    id: 'row-001',
    callId: 'call-001',
    channelDirection: 'in',
    channel: 'Входящий звонок',
    type: 'Первичная',
    mql: { label: 'Целевой', tone: 'green' },
    sql: { label: 'На дозвоне', tone: 'blue' },
    crmLead: { label: 'Квал', tone: 'green' },
    date: '3 апр 2026',
    time: '20:45',
    contactName: 'Макаров Иван',
    contactRole: 'Клиент',
    contactPhone: '7(914)574-82-12',
    manager: 'Андреева Анастасия',
    durationLabel: '02:20',
    score: 100,
    scoreTone: 'green',
    labels: [{ label: 'Перезвонить', tone: 'yellow' }],
    city: 'Москва',
    source: 'Алиса из marquiz.ru',
    managerTalkPct: 50,
    clientTalkPct: 50,
    department: 'Колл-центр',
    summary:
      'Для повышения вероятности закрытия сделки необходимо перевести диалог в предметную стадию выбора. Рекомендуется сократить количество вариантов до оптимального набора.',
  },
  {
    id: 'row-002',
    callId: 'call-002',
    channelDirection: 'in',
    channel: 'Входящий звонок',
    type: 'Повторная',
    mql: { label: 'Целевой', tone: 'green' },
    sql: { label: 'В работе', tone: 'blue' },
    crmLead: null,
    date: '4 апр 2026',
    time: '10:15',
    contactName: 'Петрова Светлана',
    contactRole: 'Клиент',
    contactPhone: '7(925)112-33-44',
    manager: 'Екатерина Волкова',
    durationLabel: '03:18',
    score: 78,
    scoreTone: 'blue',
    labels: [{ label: 'КП отправлено', tone: 'blue' }],
    city: 'Санкт-Петербург',
    source: 'Сайт: форма заявки',
    managerTalkPct: 62,
    clientTalkPct: 38,
    department: 'Отдел продаж',
    summary:
      'Клиент интересуется студией для инвестиций в ЖК «Лесной парк». Уточнён срок сдачи, отправлено коммерческое предложение.',
  },
  {
    id: 'row-003',
    callId: 'call-003',
    channelDirection: 'out',
    channel: 'Исходящий звонок',
    type: 'Первичная',
    mql: { label: 'Не целевой', tone: 'gray' },
    sql: null,
    crmLead: { label: 'Отказ', tone: 'red' },
    date: '4 апр 2026',
    time: '14:30',
    contactName: 'Сидоров Алексей',
    contactRole: 'Клиент',
    contactPhone: '7(903)456-78-90',
    manager: 'Сергей Никитин',
    durationLabel: '02:23',
    score: 32,
    scoreTone: 'red',
    labels: [{ label: 'Дорого', tone: 'red' }],
    city: 'Москва',
    source: 'Реклама: Яндекс.Директ',
    managerTalkPct: 55,
    clientTalkPct: 45,
    department: 'Колл-центр',
    summary:
      'Клиента смутила цена ЖК «Центральный», ипотеку рассматривать не готов. Возражение по цене не отработано, звонок завершён без договорённости.',
  },
  {
    id: 'row-004',
    callId: 'call-004',
    channelDirection: 'in',
    channel: 'Входящий звонок',
    type: 'Первичная',
    mql: null,
    sql: null,
    crmLead: null,
    date: '5 апр 2026',
    time: '09:00',
    contactName: 'Козлова Марина',
    contactRole: 'Клиент',
    contactPhone: '7(916)222-11-00',
    manager: 'Андреева Анастасия',
    durationLabel: '--',
    score: null,
    scoreTone: 'gray',
    labels: [],
    city: 'Москва',
    source: 'Telegram-бот',
    managerTalkPct: 0,
    clientTalkPct: 0,
    department: 'Колл-центр',
    summary: 'Обрабатывается: транскрипция получена, анализ ещё не выполнен.',
  },
  {
    id: 'row-005',
    callId: 'call-005',
    channelDirection: 'out',
    channel: 'Исходящий звонок',
    type: 'Повторная',
    mql: { label: 'Целевой', tone: 'green' },
    sql: { label: 'На дозвоне', tone: 'blue' },
    crmLead: { label: 'Квал', tone: 'green' },
    date: '5 апр 2026',
    time: '11:20',
    contactName: 'Новиков Павел',
    contactRole: 'Клиент',
    contactPhone: '7(929)887-65-43',
    manager: 'Сергей Никитин',
    durationLabel: '--',
    score: null,
    scoreTone: 'gray',
    labels: [{ label: 'Ошибка STT', tone: 'red' }],
    city: 'Казань',
    source: 'Партнёр: ЦИАН',
    managerTalkPct: 0,
    clientTalkPct: 0,
    department: 'Отдел продаж',
    summary: 'Ошибка обработки: STT timeout after 120s.',
  },
  {
    id: 'row-006',
    callId: 'call-001',
    channelDirection: 'in',
    channel: 'Входящий звонок',
    type: 'Повторная',
    mql: { label: 'Целевой', tone: 'green' },
    sql: { label: 'Встреча', tone: 'blue' },
    crmLead: { label: 'Квал', tone: 'green' },
    date: '6 апр 2026',
    time: '16:05',
    contactName: 'Макаров Иван',
    contactRole: 'Клиент',
    contactPhone: '7(914)574-82-12',
    manager: 'Андреева Анастасия',
    durationLabel: '05:42',
    score: 91,
    scoreTone: 'green',
    labels: [{ label: 'Встреча назначена', tone: 'green' }],
    city: 'Москва',
    source: 'Алиса из marquiz.ru',
    managerTalkPct: 48,
    clientTalkPct: 52,
    department: 'Отдел продаж',
    summary:
      'Повторный звонок: клиент подтвердил встречу в офисе продаж в пятницу в 15:00. Уточнены детали по ипотеке.',
  },
  {
    id: 'row-007',
    callId: 'call-002',
    channelDirection: 'in',
    channel: 'Входящий звонок',
    type: 'Первичная',
    mql: { label: 'Целевой', tone: 'green' },
    sql: { label: 'На дозвоне', tone: 'blue' },
    crmLead: { label: 'Квал', tone: 'green' },
    date: '6 апр 2026',
    time: '18:40',
    contactName: 'Петрова Светлана',
    contactRole: 'Агент',
    contactPhone: '7(925)112-33-44',
    manager: 'Екатерина Волкова',
    durationLabel: '01:57',
    score: 64,
    scoreTone: 'blue',
    labels: [{ label: 'Онлайн-презентация', tone: 'blue' }],
    city: 'Санкт-Петербург',
    source: 'Сайт: форма заявки',
    managerTalkPct: 58,
    clientTalkPct: 42,
    department: 'Отдел продаж',
    summary:
      'Клиент приглашён на онлайн-презентацию объекта на следующей неделе, ожидает подтверждения по email.',
  },
  {
    id: 'row-008',
    callId: 'call-003',
    channelDirection: 'out',
    channel: 'Исходящий звонок',
    type: 'Повторная',
    mql: { label: 'Не целевой', tone: 'gray' },
    sql: { label: 'Закрыт', tone: 'gray' },
    crmLead: { label: 'Отказ', tone: 'red' },
    date: '7 апр 2026',
    time: '12:10',
    contactName: 'Сидоров Алексей',
    contactRole: 'Клиент',
    contactPhone: '7(903)456-78-90',
    manager: 'Сергей Никитин',
    durationLabel: '00:48',
    score: 15,
    scoreTone: 'red',
    labels: [{ label: 'Не берёт трубку', tone: 'gray' }],
    city: 'Москва',
    source: 'Реклама: Яндекс.Директ',
    managerTalkPct: 70,
    clientTalkPct: 30,
    department: 'Колл-центр',
    summary: 'Повторная попытка связаться — клиент не ответил, звонок сброшен.',
  },
]
