# Call Analysis RAG

> **Задеплоенное приложение:** _[ссылка появится после деплоя]_

Тестовое задание: пайплайн аудио → LLM-анализ + RAG по документам + UI из Figma.  
Один репозиторий, три части, один экран.

---

## Части проекта

| Часть | Что делает | Команда |
|-------|-----------|---------|
| **1. Звонки** | Забирает аудио по API, транскрибирует (STT), анализирует (LLM), сохраняет результат | `npm run pipeline` |
| **2. RAG** | Парсит PDF/DOCX/PPTX/XLSX/Markdown, создаёт embeddings и записывает их в Qdrant; отвечает на вопросы с цитатами | `npm run ingest` |
| **3. UI** | Единственный экран: список звонков, карточка анализа, блок «Спросить базу» | `npm run dev` |

---

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

> Требует: `CALLS_API_BASE_URL`, `CALLS_API_TOKEN`, `STT_API_KEY`, `LLM_API_KEY`

```bash
npm run pipeline
```

### 4. Наполнить базу знаний (Часть 2)

> Положите документы (PDF/DOCX/PPTX/XLSX/Markdown) в `data/docs/<project>/`
> (`<project>` = `alisa` | `bestseller`)  
> Требует: `EMBEDDINGS_API_KEY`, `EMBEDDINGS_MODEL`, `QDRANT_URL`, `QDRANT_COLLECTION`

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
# http://localhost:3000
```

---

## Переменные окружения

Все переменные описаны в `.env.example`. Ни один реальный ключ не попадает в Git.

| Переменная | Описание |
|------------|----------|
| `CALLS_API_BASE_URL` | Базовый URL сервера с записями звонков (предоставляет заказчик) |
| `CALLS_API_TOKEN` | Bearer-токен для Calls API (предоставляет заказчик) |
| `STT_API_KEY` | Ключ провайдера Speech-to-Text |
| `LLM_API_KEY` | Ключ провайдера LLM (анализ + RAG) |
| `LLM_MODEL` | Модель LLM (например, `gpt-4o`) |
| `EMBEDDINGS_API_KEY` | Ключ для получения эмбеддингов (может совпадать с `LLM_API_KEY`) |

На хостинге (Vercel / Render / Railway) переменные прописываются в настройках окружения — **не в файлах**.

---

## Структура проекта

```
├── types/index.ts        # TypeScript-типы: Call, CallAnalysis, Chunk, AskRequest…
├── scripts/
│   ├── pipeline.ts       # Часть 1: fetch → STT → LLM → save
│   └── ingest.ts         # Часть 2: parse → chunk → embed → Qdrant (npm run ingest)
├── server/
│   ├── api/              # Nitro API-эндпоинты (POST /api/ask)
│   └── utils/            # ragIngest / ragChunk / ragEmbed / ragStore / ragAnswer…
├── pages/index.vue       # Единственный экран (Часть 3)
├── components/           # Vue-компоненты
├── data/                 # Локальные данные (в .gitignore)
│   ├── docs/             # Документы ЖК: PDF, DOCX, PPTX, XLSX, MD/Markdown
│   └── calls.db          # SQLite
│                         # (векторы хранятся не локально, а в Qdrant Cloud)
└── .env.example          # Шаблон переменных без секретов
```

---

## Figma MCP

> _Раздел будет заполнен на этапе верстки экрана._

Экран верстался по макету Figma через Figma MCP в Cursor.

| Вызов MCP | node-id | Что получено |
|-----------|---------|-------------|
| `get_metadata` | _[будет заполнено]_ | Список фреймов, размеры |
| `get_design_context` | _[будет заполнено]_ | Токены цветов, шрифтов, отступов |
| `get_variable_defs` | _[будет заполнено]_ | CSS-переменные и токены дизайн-системы |

---

## Деплой

> _Инструкции появятся после выбора хостинга._

Планируемый хостинг: Vercel / Render / Railway (бесплатный tier).

---

## Статус реализации

- [ ] Часть 1: Пайплайн звонков (ожидает ключей API)
- [ ] Часть 2: RAG по документам (ожидает документов и ключей)
- [ ] Часть 3: UI из Figma (ожидает ссылки на макет)
