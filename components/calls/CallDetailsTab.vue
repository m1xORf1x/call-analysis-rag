<script setup lang="ts">
/**
 * Вкладка "Детали" в popup — Figma node 1:36178 → секции внутри 1:36181
 *
 * Геометрия из сохранённого get_metadata XML-дампа секции 1:35665:
 *
 * 1:36197  basic data     y=76,  h=418  (padding 12; 3×3 grid + AI summary)
 *   1:36198  input grid   y=12,  h=235  (3 rows × 73px, gap 8px)
 *   1:36211  ai section   y=259, h=147  (padding 12; icon 32 + content)
 *
 * 1:36222  client/manager y=510, h=212  (два блока 474px, gap 16)
 *   1:36223  client        x=0,   w=474
 *     input+link           x=12,  w=258, 3 fields × 53px gap 4
 *     chart                x=282, w=187, h=187
 *   1:36233  manager       x=490, w=474
 *     same structure
 *
 * 1:36243  audio           y=738, h=111
 *   title row              y=12,  h=32
 *   controls               y=52,  h=47  (play w32 + timeline w731 + vol/spd w118)
 *
 * 1:36267  transcription   y=865, h=209
 *   title                  y=12,  h=21
 *   6 lines                y=49,  h=148 (18px × 6, gap 8px)
 *
 * Gaps between sections: все 16px.
 * Padding left/right: 16px (от popup border до x=16 всех секций).
 * Note: panel-body уже задаёт padding-top:16px (gap header→first section).
 */

import type { CallDetailResponse } from '~/types/callsApi'
import { formatDuration, formatOptionalDate } from '~/utils/callFormat'
import TranscriptSection from '~/components/calls/TranscriptSection.vue'
import KnowledgeBaseBlock from '~/components/calls/KnowledgeBaseBlock.vue'

const props = defineProps<{
  call: CallDetailResponse
}>()

const a = computed(() => props.call.analysis)

const DONUT_R = 70

// ── Audio player state (visual only, no API) ──────────────────
const isPlaying = ref(false)
const progress = ref(18) // % — static demo

// ── Interest label ────────────────────────────────────────────
const interestLabel = computed(() => {
  const map = { high: 'Высокий', medium: 'Средний', low: 'Низкий' }
  return a.value ? (map[a.value.client.interest] ?? '—') : '—'
})
const interestColor = computed(() => {
  const map = { high: 'var(--c-green)', medium: 'var(--c-blue)', low: 'var(--c-red)' }
  return a.value ? (map[a.value.client.interest] ?? 'var(--c-text-mid)') : 'var(--c-text-mid)'
})
</script>

<template>
  <!--
    Внешний контейнер: padding 0 16px 24px (left/right = popup padding 16px).
    gap: 16px между секциями (Figma: все разрывы между секциями = 16px).
    panel-body уже задал padding-top: 16px.
  -->
  <div class="details-tab">

    <!-- ══ 1. Basic data (1:36197) y=76,h=418 ══════════════════
         Card: UNRESOLVED bg — используем var(--c-bg) как близкое к Figma.
         Internal padding: 12px (children x=12,y=12 внутри секции).     -->
    <section class="section basic-data">

      <!--
        Fields 3×3 grid (1:36198 "input" y=12,h=235):
          3 cols × 308px = 924, gap 8px × 2 = 16 → total 940 ✓
          3 rows × 73px = 219, gap 8px × 2 = 16 → total 235 ✓
        UNRESOLVED: точные метки полей — не читаются из collapsed instances.
        Используем поля CallDetailResponse / CallAnalysis (GET /api/calls/:id).
      -->
      <div class="fields-grid">
        <!-- Row 1: общая информация о звонке -->
        <div class="field">
          <span class="field-label">Тип звонка</span>
          <!-- UNRESOLVED: CallDetailResponse не содержит direction (in/out) -->
          <span class="field-value">—</span>
        </div>
        <div class="field">
          <span class="field-label">Дата и время</span>
          <span class="field-value">{{ formatOptionalDate(null) }}</span>
        </div>
        <div class="field">
          <span class="field-label">Длительность</span>
          <span class="field-value">{{ formatDuration(call.duration_sec) }}</span>
        </div>

        <!-- Row 2: клиентский контекст -->
        <div class="field">
          <span class="field-label">Объект</span>
          <span class="field-value">{{ a?.client.object ?? '—' }}</span>
        </div>
        <div class="field">
          <span class="field-label">Бюджет</span>
          <span class="field-value">{{ a?.client.budget ?? '—' }}</span>
        </div>
        <div class="field">
          <span class="field-label">Интерес клиента</span>
          <span class="field-value" :style="{ color: interestColor, fontWeight: 600 }">{{ interestLabel }}</span>
        </div>

        <!-- Row 3: дополнительный контекст -->
        <div class="field field--multiline">
          <span class="field-label">Возражения</span>
          <span class="field-value field-value--wrap">{{ a?.client.objections.join(', ') || '—' }}</span>
        </div>
        <div class="field field--multiline">
          <span class="field-label">Конкуренты</span>
          <span class="field-value field-value--wrap">{{ a?.client.competitors.join(', ') || '—' }}</span>
        </div>
        <div class="field">
          <span class="field-label">Статус анализа</span>
          <span class="field-value">{{ call.statusLabel }}</span>
        </div>
      </div>

      <!--
        AI Summary block (1:36211 "ai" x=12,y=259,h=147) — внутри basic-data.
        Gap от grid bottom (12+235=247) до ai start (259) = 12px.
        Internal: padding 12 → 1:36213 (icon + content frame) x=12,y=12,w=916,h=123.
        Icon (1:36214): w=32,h=32.
        Content (1:36215): x=48,w=868 → gap icon→content = 48-32=16px.
          Title "Резюме коммуникации" (1:36217): w=184,h=21.
          Tags row (1:36218): y=25,h=18 → gap от title bottom (21) = 4px.
          Body text (1:36221): y=51,h=72 → gap от header bottom (43) = 8px.
      -->
      <div v-if="a" class="ai-card">
        <!-- AI icon: 32×32 "Tab icon" (1:36214) — UNRESOLVED: точный вид -->
        <div class="ai-icon">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <path d="M7 10l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <!-- Content frame (1:36215): x=48 relative to ai-card padding area -->
        <div class="ai-content">
          <!-- Header section (1:36216 w=341,h=43): title + tags row -->
          <div class="ai-head">
            <!-- Title (1:36217 h=21) -->
            <span class="ai-title">Резюме коммуникации</span>
            <!-- Tags row (1:36218 y=25,h=18 → gap 4px below title) -->
            <div class="ai-tags">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;color:var(--c-text-mid)">
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.3"/>
              </svg>
              <span class="ai-tags-text">
                {{ [a.client.object, a.client.budget].filter(Boolean).join(', ') || 'Контекст не выявлен' }}
              </span>
            </div>
          </div>
          <!-- Body text (1:36221 y=51,h=72 → gap 8px below header) -->
          <p class="ai-text">{{ a.summary }}</p>
        </div>
      </div>
    </section>

    <!-- ══ 2. Client/Manager (1:36222) y=510,h=212 ══════════════
         Два полублока 474px с gap 16px: (474+16+474=964) ✓            -->
    <section class="section cm-section">

      <!-- Client half (1:36223 x=0,w=474) -->
      <div class="cm-half">
        <!-- "input + link" (1:36224 x=12,y=12,w=258,h=188) -->
        <div class="cm-inputs">
          <!-- "link" (1:36225 h=17): секционный заголовок со ссылкой -->
          <div class="cm-link-row">
            <span class="cm-link">Клиент</span>
          </div>
          <!-- 3 поля × h=53, gap 4px (y=0,57,114 → 53+4=57 ✓) -->
          <div class="cm-fields">
            <div class="cm-field">
              <span class="field-label">Имя</span>
              <span class="field-value">Не определено</span>
            </div>
            <div class="cm-field">
              <span class="field-label">Интерес</span>
              <span class="field-value" :style="{ color: interestColor, fontWeight: 600 }">{{ interestLabel }}</span>
            </div>
            <div class="cm-field">
              <span class="field-label">Объект</span>
              <span class="field-value">{{ a?.client.object ?? '—' }}</span>
            </div>
          </div>
        </div>
        <!-- chart (1:36232): placeholder «Нет данных» (CallDetailResponse без talk %) -->
        <div class="cm-chart">
          <svg viewBox="0 0 187 187" fill="none" aria-hidden="true">
            <circle cx="93.5" cy="93.5" :r="DONUT_R" stroke="var(--c-border)" stroke-width="18" fill="none"/>
            <text x="93.5" y="86" text-anchor="middle" font-family="Inter" font-size="12" fill="var(--c-text-mid)">Клиент</text>
            <text x="93.5" y="104" text-anchor="middle" font-family="Inter" font-size="13" font-weight="500" fill="var(--c-text-mid)">Нет данных</text>
          </svg>
        </div>
      </div>

      <!-- Manager half (1:36233 x=490,w=474) -->
      <div class="cm-half">
        <div class="cm-inputs">
          <div class="cm-link-row">
            <span class="cm-link">Менеджер</span>
          </div>
          <div class="cm-fields">
            <div class="cm-field">
              <!-- UNRESOLVED: CallDetailResponse не содержит manager name -->
              <span class="field-label">Имя менеджера</span>
              <span class="field-value">—</span>
            </div>
            <div class="cm-field">
              <span class="field-label">Статус</span>
              <span class="field-value">{{ call.statusLabel }}</span>
            </div>
            <div class="cm-field">
              <span class="field-label">Файл</span>
              <span class="field-value field-value--sm">{{ call.filename }}</span>
            </div>
          </div>
        </div>
        <div class="cm-chart">
          <svg viewBox="0 0 187 187" fill="none" aria-hidden="true">
            <circle cx="93.5" cy="93.5" :r="DONUT_R" stroke="var(--c-border)" stroke-width="18" fill="none"/>
            <text x="93.5" y="86" text-anchor="middle" font-family="Inter" font-size="12" fill="var(--c-text-mid)">Менеджер</text>
            <text x="93.5" y="104" text-anchor="middle" font-family="Inter" font-size="13" font-weight="500" fill="var(--c-text-mid)">Нет данных</text>
          </svg>
        </div>
      </div>
    </section>

    <!-- ══ 3. Audio player (1:36243) y=738,h=111 ════════════════
         title row (1:36244 y=12,h=32) + controls (1:36247 y=52,h=47).
         Gap title→controls: 52-(12+32)=8px.                           -->
    <section class="section audio-section">

      <!-- Title row (1:36244): text "Прослушать звонок" + toggle icon -->
      <div class="audio-title-row">
        <!-- text (1:36245 y=5.5,w=900,h=21 → vertical center in 32: (32-21)/2=5.5 ✓) -->
        <span class="audio-title">Прослушать звонок</span>
        <!-- toggle icon (1:36246 "Tab icon" x=908,w=32,h=32) -->
        <button class="audio-toggle" aria-label="Развернуть">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <!--
        Controls row (1:36247 y=52,w=940,h=47):
          play btn (1:36248 x=13,y=7,w=32,h=32)
          timeline (1:36251 x=61,y=14,w=731,h=18) → gap play→timeline: 61-13-32=16 ✓
          vol+speed (1:36257 x=808,y=11,w=118,h=24) → gap timeline→vol: 808-(61+731)=16 ✓
      -->
      <div class="audio-controls">
        <!-- Play/Pause button (1:36248 w=32,h=32) -->
        <button class="play-btn" @click="isPlaying = !isPlaying">
          <svg v-if="!isPlaying" width="12" height="14" viewBox="0 0 12 14" fill="none">
            <path d="M1 1.5l10 5L1 11.5V1.5z" fill="currentColor"/>
          </svg>
          <svg v-else width="12" height="14" viewBox="0 0 12 14" fill="none">
            <rect x="1" y="1" width="4" height="12" rx="1" fill="currentColor"/>
            <rect x="7" y="1" width="4" height="12" rx="1" fill="currentColor"/>
          </svg>
        </button>

        <!--
          Timeline (1:36251 x=61,y=14,w=731,h=18):
          "00:51" (w=38) | progress bar (flex-1) | "04:51" (w=38, at x=693)
          Gap from each time label to bar: approximately 8px.
        -->
        <div class="timeline">
          <span class="time-text">00:51</span>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: progress + '%' }"/>
          </div>
          <span class="time-text">{{ formatDuration(call.duration_sec) }}</span>
        </div>

        <!--
          Volume + speed (1:36257 x=808,y=11,w=118,h=24):
          volume (1:36258 x=0,w=86): icon(24) + slider bar(60×4 at y=10)
          speed  (1:36265 x=94,w=24): "1×" text
          Gap volume→speed: 94-86=8px ✓
        -->
        <div class="vol-speed">
          <!-- Volume (1:36259 w=86,h=24): icon 24×24 + slider bar 60×4 -->
          <div class="volume">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div class="vol-bar">
              <div class="vol-fill" style="width: 70%;"/>
            </div>
          </div>
          <!-- Speed (1:36265 x=94,w=24,h=24) -->
          <button class="speed-btn">1×</button>
        </div>
      </div>
    </section>

    <!-- ══ 4. Transcription (1:36267) y=865,h=209 ═══════════════
         Title (y=12,h=21) + container (y=49,h=148): 6 lines × 18px, gap 8.
         Note: Figma title = "Транскрипбация" (опечатка), используем "Транскрипция".
         TranscriptSection — существующий компонент с рабочим парсингом.    -->
    <TranscriptSection v-if="call.transcript" :transcript="call.transcript" />

    <!-- ══ 5. KnowledgeBase (не в Figma frame, после оригинальных блоков) ═══ -->
    <KnowledgeBaseBlock />

  </div>
</template>

<style scoped>
/* ══ Outer layout ════════════════════════════════════════════
   padding: 0 16px 24px — левый/правый = popup padding (x=16 всех секций).
   gap: 16px = расстояние между секциями в Figma (все gaps = 16px).
   panel-body уже задал padding-top: 16px сверху.                    */
.details-tab {
  padding: 0 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

/* ══ Section card base ═══════════════════════════════════════
   UNRESOLVED: фон секций — нет fill data из metadata.
   Используем var(--c-bg) как ближайший известный токен.              */
.section {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
}

/* ══ 1. Basic data (1:36197) h=418 ══════════════════════════
   padding: 12px = x=12 для children внутри секции.                  */
.basic-data {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px; /* gap grid→ai: 259-(12+235)=12px */
  min-width: 0;
}

/* ── Fields 3×3 grid (1:36198 h=235) ────────────────────────
   cols: 3 × 308px, gap 8px → 308×3 + 8×2 = 940 ✓
   rows: 3 × 73px, gap 8px → 73×3 + 8×2 = 235 ✓                     */
.fields-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

/* Каждое поле (imput instance 308×73) */
.field {
  height: 73px; /* точная высота из Figma 1:36200-1:36210 */
  min-width: 0;
  background: var(--c-white);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
}

.field--multiline {
  height: auto;
  min-height: 73px;
}

.field-label {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 400;
  color: var(--c-text-mid);
  line-height: 1.3;
}

.field-value {
  font-family: 'Inder', sans-serif;
  font-size: 15px;
  font-weight: 400;
  color: var(--c-text-dark);
  line-height: 1.3;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-value--wrap {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  text-overflow: unset;
  overflow: visible;
}

/* ── AI Summary card (1:36211 y=259,h=147) ─────────────────
   padding: 12px → 1:36213 at x=12,y=12.
   Icon (1:36214): w=32,h=32.
   Gap icon→content: 48-32=16px.
   UNRESOLVED: фон/рамка — используем var(--c-white) + border.       */
.ai-card {
  background: var(--c-white);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 12px;
  display: flex;
  gap: 16px; /* gap icon→content: x_content=48, icon_end=32, gap=16 ✓ */
  min-height: calc(147px - 24px); /* h=147 - 2×12 padding */
}

/* AI icon (1:36214 "Tab icon" w=32,h=32) */
.ai-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  background: rgba(43, 127, 255, 0.1);
  border: 1px solid rgba(43, 127, 255, 0.25);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-blue);
}

/* Content (1:36215 x=48,w=868) */
.ai-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px; /* gap header→body: 51-43=8px ✓ */
  min-width: 0;
}

/* Header (1:36216 h=43): title + tags */
.ai-head {
  display: flex;
  flex-direction: column;
  gap: 4px; /* gap title→tags: y_tags=25, title_end=21, gap=4 ✓ */
}

/* Title (1:36217 h=21) */
.ai-title {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: var(--c-text-dark);
  line-height: 1.3;
}

/* Tags row (1:36218 h=18): coin icon + text */
.ai-tags {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-tags-text {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  color: var(--c-text-mid);
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* Body (1:36221 y=51,h=72) */
.ai-text {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--c-text-deep);
  line-height: 1.5;
  margin: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* ══ 2. Client/Manager (1:36222) h=212 ══════════════════════
   Два блока: 1:36223 client (x=0,w=474), 1:36233 manager (x=490,w=474)
   gap = 490-474=16px.                                                 */
.cm-section {
  display: flex;
  gap: 16px;
  padding: 0; /* у каждого cm-half своя структура */
  min-width: 0;
}

/* cm-half: flex row, inputs(w=258) + chart(187×187) */
.cm-half {
  flex: 1 1 0; /* (964-16)/2=474 ✓ */
  min-width: 0;
  display: flex;
  gap: 12px; /* gap inputs→chart: 282-(12+258)=12px ✓ */
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 12px;
}

/* Inputs column (1:36224 " input + link" x=12,w=258) */
.cm-inputs {
  flex: 258 1 0;
  min-width: 0;
  max-width: 258px;
  display: flex;
  flex-direction: column;
  gap: 4px; /* gap между link row и fields: 21-17=4px */
}

/* "link" row (1:36225 h=17) — заголовок секции */
.cm-link-row {
  display: flex;
  align-items: center;
  height: 17px;
  margin-bottom: 0;
}

.cm-link {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: var(--c-text-mid);
}

/* 3 поля × h=53px, gap 4px (1:36229-1:36231 y=0,57,114 → 53+4=57 ✓) */
.cm-fields {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cm-field {
  height: 53px; /* точная высота из Figma */
  background: var(--c-white);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 4px;
  box-sizing: border-box;
}

/* Фиксированные строки label/value — одна вертикаль для всех cm-field cards */
.cm-field .field-label {
  flex-shrink: 0;
  height: 16px;
  line-height: 16px;
}

.cm-field .field-value {
  flex-shrink: 0;
  height: 20px;
  line-height: 20px;
}

.cm-field .field-value--sm {
  height: 20px;
  line-height: 20px;
}

/* Chart placeholder (1:36232 x=282,y=12,w=187,h=187) */
.cm-chart {
  flex: 187 1 0;
  min-width: 0;
  max-width: 187px;
  aspect-ratio: 1;
  align-self: flex-start;
}

.cm-chart svg {
  width: 100%;
  height: 100%;
}

.field-value--sm {
  font-size: 11px;
  white-space: normal;
  word-break: break-all;
}

/* ══ 3. Audio player (1:36243) h=111 ════════════════════════
   padding: 12px (children x=12,y=12).                                */
.audio-section {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px; /* gap title-row→controls: 52-(12+32)=8px ✓ */
}

/* Title row (1:36244 h=32): text (h=21,y=5.5) + toggle icon (w=32) */
.audio-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
}

.audio-title {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: var(--c-text-dark);
  line-height: 1.3;
}

.audio-toggle {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--c-white);
  border-radius: var(--radius);
  color: var(--c-text-mid);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid var(--c-border);
}

/* Controls row (1:36247 h=47): flex row, height 47px */
.audio-controls {
  display: flex;
  align-items: center;
  height: 47px;
  gap: 16px; /* gap play→timeline=16, timeline→vol=16 ✓ */
  min-width: 0;
}

/* Play button (1:36248 w=32,h=32, y=7 → centered in h=47: (47-32)/2=7.5 ≈ 7 ✓) */
.play-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--c-white);
  border: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-text-dark);
  cursor: pointer;
  transition: background 0.12s;
}

.play-btn:hover { background: var(--c-bg); }

/* Timeline (1:36251 x=61,y=14,w=731,h=18):
   "00:51"(38px) | bar(flex-1) | total_time(38px).
   height: 18px (timeline frame height).                              */
.timeline {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 18px;
}

.time-text {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  color: var(--c-text-mid);
  flex-shrink: 0;
  width: 38px;
  text-align: center;
}

.progress-track {
  flex: 1;
  height: 4px; /* bar h=4 (1:36253-1:36255) */
  background: var(--c-border);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--c-blue);
  border-radius: 2px;
  transition: width 0.3s;
}

/* Volume + speed (1:36257 x=808,w=118,h=24) */
.vol-speed {
  flex-shrink: 0;
  width: 118px;
  display: flex;
  align-items: center;
  gap: 8px; /* gap vol→speed: 94-86=8px ✓ */
}

/* Volume (1:36258→1:36259 w=86,h=24): icon(24) + slider bar(60×4) */
.volume {
  display: flex;
  align-items: center;
  gap: 2px;
  width: 86px;
  color: var(--c-text-mid);
}

.vol-bar {
  flex: 1;
  height: 4px;
  background: var(--c-border);
  border-radius: 2px;
  overflow: hidden;
}

.vol-fill {
  height: 100%;
  background: var(--c-text-mid);
  border-radius: 2px;
}

/* Speed button (1:36265→1:36266 w=24,h=24, text "1×") */
.speed-btn {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--c-text-mid);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: background 0.12s;
}

.speed-btn:hover { background: var(--c-bg); }
</style>
