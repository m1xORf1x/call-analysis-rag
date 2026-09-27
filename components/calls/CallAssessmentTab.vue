<script setup lang="ts">
/**
 * Вкладка «Выполнение чек-листа» — Figma node 1:36276
 *   1:36295 ai assessment (3 cards)
 *   1:36329 check sheet (accordion)
 */
import type { CallDetailResponse } from '~/types/callsApi'

const props = defineProps<{ call: CallDetailResponse }>()

const a = computed(() => props.call.analysis)

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

/** Обрезка subtitle по границе слова с явным «…» */
function truncateWithEllipsis(text: string, maxLen = 72): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLen) return trimmed
  const slice = trimmed.slice(0, maxLen)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = (lastSpace > maxLen * 0.5 ? slice.slice(0, lastSpace) : slice).trim()
  return `${cut}…`
}

/** Короткая тема из текста (первые фразы до запятой, как в Figma) */
function topicFromList(text: string, maxParts = 2): string {
  const parts = text.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length >= 2) return parts.slice(0, maxParts).join(', ')
  return truncateWithEllipsis(text)
}

/** Тема рекомендации — первая clause до «;» / «:» или обрезка */
function topicFromRecommendation(text: string): string {
  const full = text.trim()
  const beforeColon = full.split(':')[0]?.trim()
  if (beforeColon && beforeColon.length <= 80 && beforeColon.length < full.length - 8) {
    return beforeColon
  }
  const firstClause = full.split(';')[0]?.trim()
  if (firstClause && firstClause.length < full.length - 8) {
    return firstClause.length <= 80 ? firstClause : truncateWithEllipsis(firstClause)
  }
  const firstSentence = full.split(/[.!?]/)[0]?.trim()
  if (firstSentence && firstSentence.length <= 80 && firstSentence.length < full.length - 8) {
    return firstSentence
  }
  return truncateWithEllipsis(full)
}

/** Subtitle показываем только если он заметно короче полного текста */
function isDistinctSubtitle(full: string, topic: string): boolean {
  const normalizedFull = normalizeText(full)
  const normalizedTopic = normalizeText(topic.replace(/…$/, ''))
  if (!normalizedTopic) return false
  if (normalizedFull === normalizedTopic) return false
  if (topic.endsWith('…')) return normalizedTopic.length < normalizedFull.length
  return normalizedFull.length > normalizedTopic.length + 8
}

// ── Checklist mock (UI-only, нет в CallAnalysis / Part 1) ─────
interface ChecklistItem {
  id: string
  title: string
}

const checklistItems: ChecklistItem[] = [
  { id: 'greeting', title: 'Приветствие и установка контакта' },
  { id: 'needs', title: 'Выявление потребности' },
  { id: 'presentation', title: 'Презентация продукта' },
  { id: 'objections', title: 'Работа с возражениями' },
]

const openCheckId = ref<string>('')

function toggleCheck(id: string) {
  openCheckId.value = openCheckId.value === id ? '' : id
}

</script>

<template>
  <div class="assessment-tab">
    <div v-if="!a" class="no-data">
      <p>Анализ ещё не выполнен (статус: <strong>{{ call.statusLabel }}</strong>)</p>
    </div>

    <template v-else>
      <!-- ══ AI оценка коммуникации (1:36295) ═══════════════════ -->
      <section class="section ai-section">
        <h2 class="section-title">AI оценка коммуникации</h2>

        <div class="ai-cols">
          <!-- A. Сильные стороны -->
          <article class="ai-card">
            <div class="ai-card-head">
              <span class="ai-icon ai-icon--green">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 1.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm3.2 5.5l-3.8 3.8a.7.7 0 01-.98 0L5.1 9.1a.7.7 0 01.98-.98L8.2 10.3l3.3-3.3a.7.7 0 01.98.98z" fill="currentColor"/>
                </svg>
              </span>
              <h3 class="ai-card-title ai-card-title--green">Сильные стороны</h3>
            </div>
            <div class="ai-card-body">
              <p v-if="isDistinctSubtitle(a.strongPoints, topicFromList(a.strongPoints))" class="ai-topic">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.3"/></svg>
                <span>{{ topicFromList(a.strongPoints) }}</span>
              </p>
              <p class="ai-text">{{ a.strongPoints }}</p>
            </div>
          </article>

          <!-- B. Слабые стороны -->
          <article class="ai-card">
            <div class="ai-card-head">
              <span class="ai-icon ai-icon--red">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 1.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM8.25 6h1.5v4.5h-1.5V6zm0 6h1.5v1.5h-1.5V12z" fill="currentColor"/>
                </svg>
              </span>
              <h3 class="ai-card-title ai-card-title--red">Слабые стороны</h3>
            </div>
            <div class="ai-card-body">
              <p v-if="isDistinctSubtitle(a.weakPoints, topicFromList(a.weakPoints))" class="ai-topic">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.3"/></svg>
                <span>{{ topicFromList(a.weakPoints) }}</span>
              </p>
              <p class="ai-text">{{ a.weakPoints }}</p>
            </div>
          </article>

          <!-- C. AI рекомендации -->
          <article class="ai-card">
            <div class="ai-card-head">
              <span class="ai-icon ai-icon--blue">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 1.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM9.75 12.75h-1.5v-1.5h1.5v1.5zm0-3h-1.5V6h1.5v3.75z" fill="currentColor"/>
                </svg>
              </span>
              <h3 class="ai-card-title ai-card-title--blue">AI рекомендации</h3>
            </div>
            <div class="ai-card-body">
              <p v-if="isDistinctSubtitle(a.recommendation, topicFromRecommendation(a.recommendation))" class="ai-topic">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.3"/></svg>
                <span>{{ topicFromRecommendation(a.recommendation) }}</span>
              </p>
              <p class="ai-text">{{ a.recommendation }}</p>
            </div>
          </article>
        </div>
      </section>

      <!-- ══ Выполнение чек-листа (1:36329) ═════════════════════ -->
      <section class="section checklist-section">
        <div class="checklist-header">
          <h2 class="section-title">Выполнение чек-листа</h2>
          <span class="checklist-total-badge checklist-total-badge--muted">Нет данных</span>
        </div>

        <div class="checklist">
          <div
            v-for="item in checklistItems"
            :key="item.id"
            class="check-item"
            :class="{ 'check-item--open': openCheckId === item.id }"
          >
            <button
              type="button"
              class="check-item-trigger"
              @click="toggleCheck(item.id)"
            >
              <span class="check-score check-score--muted">—</span>
              <span class="check-title">{{ item.title }}</span>
              <span class="check-chevron" :class="{ 'check-chevron--up': openCheckId === item.id }">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </button>

            <div v-if="openCheckId === item.id" class="check-item-body">
              <p class="check-label">Обоснование оценки</p>
              <p class="check-rationale check-rationale--muted">—</p>
              <p class="check-label">Фразы менеджера</p>
              <div class="check-quote check-quote--muted">Нет данных</div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.assessment-tab {
  padding: 0 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.no-data {
  padding: 40px;
  text-align: center;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--c-text-mid);
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
}

.section {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 12px;
  min-width: 0;
}

.section-title {
  font-family: 'Inter', sans-serif;
  font-size: 20px;
  font-weight: 500;
  color: var(--c-text-dark);
  line-height: 1.3;
}

/* ── AI cards (1:36297: 940×278, 3 cols, gap ~8) ─────────── */
.ai-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-cols {
  display: flex;
  gap: 8px;
  align-items: stretch;
  min-width: 0;
}

.ai-card {
  flex: 1 1 0;
  min-width: 0;
  background: var(--c-white);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 278px;
}

.ai-card-head {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.ai-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-icon--green { background: rgba(26,199,121,0.1); border-color: rgba(26,199,121,0.25); color: var(--c-green); }
.ai-icon--red   { background: rgba(251,65,74,0.1);  border-color: rgba(251,65,74,0.25);  color: var(--c-red); }
.ai-icon--blue  { background: rgba(43,127,255,0.1);  border-color: rgba(43,127,255,0.25);  color: var(--c-blue); }

.ai-card-title {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
  min-width: 0;
}

.ai-card-title--green { color: var(--c-green); }
.ai-card-title--red   { color: var(--c-red); }
.ai-card-title--blue  { color: var(--c-blue); }

.ai-card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.ai-topic {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--c-text-deep);
  line-height: 1.3;
}

.ai-topic svg {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--c-text-mid);
}

.ai-text {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--c-text-deep);
  line-height: 1.5;
  margin: 0;
  flex: 1;
  overflow-wrap: anywhere;
}

/* ── Checklist (1:36329) ──────────────────────────────────── */
.checklist-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.checklist-header {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.checklist-total-badge {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  border-radius: 12px;
  background: rgba(26, 199, 121, 0.1);
  border: 1px solid rgba(26, 199, 121, 0.25);
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: var(--c-green);
  white-space: nowrap;
}

.checklist-total-badge--muted {
  background: var(--c-bg);
  border-color: var(--c-border);
  color: var(--c-text-mid);
  font-weight: 500;
}

.checklist {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.check-item {
  background: var(--c-white);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.check-item-trigger {
  width: 100%;
  min-height: 50px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: none;
  background: var(--c-white);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}

.check-item-trigger:hover {
  background: var(--c-bg);
}

.check-score {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  min-width: 44px;
  padding: 0 8px;
  border-radius: 12px;
  border: 1px solid transparent;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 700;
}

.check-score--muted {
  background: var(--c-bg);
  border-color: var(--c-border);
  color: var(--c-text-mid);
  font-weight: 500;
}

.check-title {
  flex: 1;
  min-width: 0;
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: var(--c-text-dark);
  line-height: 1.3;
}

.check-chevron {
  flex-shrink: 0;
  color: var(--c-text-mid);
  display: flex;
  align-items: center;
  transition: transform 0.15s ease;
}

.check-chevron--up {
  transform: rotate(180deg);
}

.check-item-body {
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--c-border);
  padding-top: 12px;
  margin: 0 16px 16px;
}

.check-label {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: var(--c-text-mid);
  line-height: 1.3;
}

.check-rationale {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--c-text-deep);
  line-height: 1.5;
  margin: 0 0 4px;
}

.check-rationale--muted,
.check-quote--muted {
  color: var(--c-text-mid);
}

.check-quote {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--c-text-deep);
  line-height: 1.5;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  padding: 12px;
}
</style>
