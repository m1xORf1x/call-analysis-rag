# Call Analysis RAG

Система обработки звонков: получает аудио, транскрибирует его, выполняет структурированный LLM-анализ и показывает результат в веб-интерфейсе. Отдельный RAG-модуль отвечает на вопросы по базе документов с цитатами из исходников.

Публичная демо-версия использует тестовые данные; реальные клиентские звонки не используются.

## Demo

**Live:** [https://call-analysis-rag.vercel.app](https://call-analysis-rag.vercel.app)

- UI работает на сохранённом snapshot обработанных тестовых звонков.
- RAG использует Qdrant и LLM API.
- Для запуска полного pipeline локально требуется доступ к используемым внешним API и соответствующие credentials.

## Что реализовано

- Загрузка аудио из Calls API → STT → структурированный LLM-анализ звонка
- SQLite cache и возобновление обработки; ошибка одного звонка не останавливает остальные
- Export snapshot (`data/calls.export.json`) для serverless UI
- RAG: parsing документов → chunking → embeddings → Qdrant
- `POST /ask` с ответом и citations; явный проект в вопросе ограничивает поиск
- Nuxt/Vue UI: список звонков, карточка с transcript и analysis, блок «Спросить базу»

## Архитектура

```
Calls API → STT → LLM analysis → SQLite → snapshot → Nuxt/Nitro API → UI

Documents → parsing / chunking → embeddings → Qdrant → RAG answer + citations
```

## Стек

- TypeScript
- Nuxt 3 / Vue 3 / Nitro
- Soniox STT
- BotHub (OpenAI-compatible LLM API)
- Qdrant
- SQLite
- Vercel

## Локальный запуск

Требуется Node.js 22+.

```bash
npm install
cp .env.example .env
# заполнить ключи — см. таблицу ниже
npm run dev
# http://localhost:3000/communications  (GET / → redirect)
```

Полный pipeline (локально, не на Vercel):

```bash
npm run pipeline      # Calls API → STT → LLM → SQLite
npm run export:calls  # snapshot → data/calls.export.json
npm run ingest        # documents → Qdrant
```

| Переменная | Назначение |
|------------|------------|
| `CALLS_API_BASE_URL`, `CALLS_API_TOKEN` | Calls API |
| `SONIOX_API_KEY` | STT |
| `BOTHUB_API_KEY`, `BOTHUB_MODEL` | LLM-анализ и RAG |
| `EMBEDDINGS_API_KEY`, `EMBEDDINGS_MODEL` | embeddings для ingest |
| `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION` | векторный индекс |
| `DOCS_PATH`, `DB_PATH` | опционально; по умолчанию `./data/docs` и `./data/calls.db` |

Полный список — в `.env.example`.

## Структура проекта

```
├── scripts/pipeline.ts       # локальный pipeline звонков
├── scripts/exportCalls.ts    # snapshot для UI
├── scripts/ingest.ts         # локальный RAG ingest
├── server/api/               # GET /api/calls, GET /api/calls/:id, POST /api/ask
├── server/routes/ask.post.ts # POST /ask
├── pages/communications.vue  # единственный экран
├── data/calls.export.json    # tracked demo snapshot
├── data/calls.db             # локальный SQLite (не в Git)
├── data/docs/                # исходники RAG (не в Git)
└── .env.example
```

## Deployment / ограничения

- `pipeline` и `ingest` запускаются локально.
- UI на Vercel читает tracked snapshot `data/calls.export.json`.
- RAG на Vercel обращается к Qdrant и LLM live.
- Секреты задаются environment variables (Vercel: Project Settings) и не хранятся в Git.
