# Call Analysis RAG

> **Задеплоенное приложение:** https://call-analysis-rag.vercel.app
> Хостинг: **Vercel**.

Тестовое задание: пайплайн аудио → LLM-анализ + RAG по документам + UI из Figma.
Один репозиторий, три части, один экран `/communications`.

---

## Части проекта

| Часть | Что делает | Команда |
|-------|-----------|---------|
| **1. Звонки** | Calls API → Soniox STT → BotHub LLM → SQLite; ошибка одного звонка не останавливает остальные. Export в `data/calls.export.json` для Nitro/UI | `npm run pipeline` (локально, не на Vercel runtime) |
| **2. RAG** | Документы `data/docs/<project>/` (`alisa` \| `bestseller`) → embeddings → Qdrant. Live `POST /ask` с citations; явный проект в вопросе ограничивает retrieval | `npm run ingest` (локально) |
| **3. UI** | Vue 3 / Nuxt 3 / Nitro / TypeScript: список звонков через backend API, popup с transcript + analysis, KnowledgeBaseBlock → реальный `POST /ask` | `npm run dev` |

---

## Требования

- **Node.js 22+** (используется `node:sqlite` и другие API Node 22)

## Локальный запуск

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить переменные окружения

```bash
cp .env.example .env
# Заполнить .env реальными ключами (см. раздел «Переменные окружения»)
```

### 3. Запустить пайплайн звонков (Часть 1)

> Требует: `CALLS_API_BASE_URL`, `CALLS_API_TOKEN`, `SONIOX_API_KEY`, `BOTHUB_API_KEY`, `BOTHUB_MODEL`
> Пайплайн выполняется **локально**. На Vercel runtime он не запускается: UI читает snapshot `data/calls.export.json`.

```bash
npm run pipeline
npm run export:calls   # snapshot → data/calls.export.json
```

### 4. Наполнить базу знаний (Часть 2)

> Положите документы (PDF/DOCX/PPTX/XLSX/Markdown) в `data/docs/<project>/`
> (`<project>` = `alisa` \| `bestseller`). Каталог `data/docs/` в Git не коммитится.
> Требует: `EMBEDDINGS_API_KEY`, `EMBEDDINGS_MODEL`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`

```bash
npm run ingest
```

`npm run ingest` запускает полный pipeline: парсинг → чанкинг → embeddings →
запись в Qdrant. Команда идемпотентна — при повторном запуске коллекция
Qdrant полностью пересоздаётся, поэтому в ней остаются ровно chunks текущего
состояния `data/docs/` (без «зависших» точек от удалённых/изменённых файлов).

### 5. Запустить UI

```bash
npm run dev
# http://localhost:3000/communications  (GET / → redirect)
```

Список: `GET /api/calls`. Карточка: `GET /api/calls/:id` (transcript + analysis).
База знаний: `POST /ask`. Есть loading / error / empty states.

---

## Переменные окружения

Все переменные описаны в `.env.example`. Ни один реальный ключ не попадает в Git.

На **Vercel** runtime-required secrets задаются в **Project Settings → Environment Variables** и не коммитятся.

| Переменная | Описание |
|------------|----------|
| `CALLS_API_BASE_URL` | Базовый URL Calls API |
| `CALLS_API_TOKEN` | Bearer-токен Calls API |
| `SONIOX_API_KEY` | STT (Soniox); нужен для локального `npm run pipeline` |
| `BOTHUB_API_KEY`, `BOTHUB_MODEL` | LLM: анализ звонков и RAG (`POST /ask`) |
| `EMBEDDINGS_API_KEY`, `EMBEDDINGS_MODEL` | Embeddings для ingest |
| `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION` | Векторный индекс RAG |
| `DOCS_PATH` | Опционально; по умолчанию `./data/docs` |
| `DB_PATH` | Опционально; по умолчанию `./data/calls.db` (локальный SQLite) |

---

## Структура проекта

```
├── types/index.ts            # Call, CallAnalysis, RAG-типы, AskRequest…
├── scripts/
│   ├── pipeline.ts           # Часть 1 (локально): fetch → STT → LLM → SQLite
│   ├── exportCalls.ts        # snapshot → data/calls.export.json
│   └── ingest.ts             # Часть 2 (локально): parse → chunk → embed → Qdrant
├── server/
│   ├── api/                  # GET /api/calls, GET /api/calls/:id, POST /api/ask
│   ├── routes/ask.post.ts    # POST /ask (тот же handler)
│   └── utils/
├── pages/communications.vue  # Единственный экран; GET / → /communications
├── components/               # Таблица, popup, KnowledgeBaseBlock
├── data/
│   ├── calls.export.json     # Tracked snapshot; Nitro API на Vercel читает его
│   ├── calls.db              # Локальный SQLite cache пайплайна, не serverless
│   └── docs/                 # Исходники RAG (gitignored)
└── .env.example
```

---

## Figma MCP

Для верстки использовался Figma MCP в Cursor.

| Вызов MCP | Результат |
|-----------|-----------|
| `get_metadata` | Успешно использовался при верстке. Основной экран: **1:35849**. Сохранённые metadata для **1:35665** и связанных узлов popup/table (**1:36178** / **1:36181**, **1:35954**, **1:36033**). |
| `get_design_context` | Вызов для **1:35926** упёрся в месячный лимит Figma MCP. |
| `get_variable_defs` | Вызов для **1:35849** перед сдачей: Figma MCP вернул `You've reached the Figma MCP tool call limit on the Starter plan.` Значения variables получить не удалось. |

---

## Деплой

Продакшен: [https://call-analysis-rag.vercel.app](https://call-analysis-rag.vercel.app) (Vercel).

Секреты — в Environment Variables проекта. `npm run pipeline` и `npm run ingest` на runtime Vercel не выполняются: звонки отдаются из `data/calls.export.json`, RAG ходит в Qdrant + BotHub live.

---

## Статус реализации

- [x] Часть 1: Пайплайн реализован с обработкой ошибок отдельных звонков
- [x] Часть 2: RAG по документам, live `POST /ask` с citations
- [x] Часть 3: UI `/communications` из Figma
