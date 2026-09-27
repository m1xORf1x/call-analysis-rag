<script setup lang="ts">
import type { CallRecord } from '~/types/index'
import { formatDuration, formatDate, clientNameFromFilename } from '~/data/mockCalls'

const props = defineProps<{ call: CallRecord }>()

const a = computed(() => props.call.analysis)

// Audio player state (visual only)
const isPlaying = ref(false)
const progress = ref(18) // % — static demo

const interestBadge = computed(() => {
  const map = { high: { label: 'Высокий', color: 'var(--c-green)' },
                medium: { label: 'Средний', color: 'var(--c-blue)' },
                low: { label: 'Низкий', color: 'var(--c-red)' } }
  return map[a.value?.client.interest ?? 'medium']
})
</script>

<template>
  <div class="details-tab">
    <!-- ── Basic data ───────────────────────────────────────── -->
    <section class="card">
      <div class="card-fields">
        <div class="field">
          <span class="field-label">Тип</span>
          <span class="field-value">Входящий</span>
        </div>
        <div class="field">
          <span class="field-label">Дата / Время</span>
          <span class="field-value">{{ formatDate(call.created_at) }}</span>
        </div>
        <div class="field">
          <span class="field-label">Длительность</span>
          <span class="field-value">{{ formatDuration(call.duration_sec) }}</span>
        </div>
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
          <span
            v-if="a"
            class="badge"
            :style="{ color: interestBadge.color,
                      background: interestBadge.color + '14',
                      borderColor: interestBadge.color + '40' }"
          >{{ interestBadge.label }}</span>
          <span v-else class="field-value">—</span>
        </div>
      </div>

      <!-- AI Summary -->
      <div v-if="a" class="ai-card">
        <div class="ai-icon">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 2c.6 0 1.1.2 1.5.5L5 10.5A6 6 0 0110 4zm0 12a6 6 0 01-5.5-3.6L11 6.9A6 6 0 0110 16z"
                  fill="currentColor"/>
          </svg>
        </div>
        <div class="ai-content">
          <div class="ai-header-row">
            <span class="ai-title">Резюме коммуникации</span>
            <div class="ai-topics" v-if="a.client.interest">
              <span class="topic-tag">
                {{ a.client.object ?? 'Объект не выявлен' }}
              </span>
              <span v-if="a.client.budget" class="topic-tag">{{ a.client.budget }}</span>
            </div>
          </div>
          <p class="ai-text">{{ a.summary }}</p>
          <div v-if="a.client.objections.length" class="objections">
            <span class="field-label">Возражения:</span>
            <span
              v-for="obj in a.client.objections"
              :key="obj"
              class="badge badge--red"
            >{{ obj }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Client / Manager ─────────────────────────────────── -->
    <section class="two-cols">
      <div class="card card--inner">
        <div class="cm-header">
          <span class="field-label">Клиент</span>
        </div>
        <div class="card-fields">
          <div class="field">
            <span class="field-label">Имя</span>
            <span class="field-value">{{ clientNameFromFilename(call.filename) }}</span>
          </div>
          <div class="field">
            <span class="field-label">Интерес</span>
            <span v-if="a" class="field-value" :style="{ color: interestBadge.color, fontWeight: 600 }">
              {{ interestBadge.label }}
            </span>
          </div>
          <div v-if="a?.client.object" class="field">
            <span class="field-label">Объект</span>
            <span class="field-value">{{ a.client.object }}</span>
          </div>
          <div v-if="a?.client.budget" class="field">
            <span class="field-label">Бюджет</span>
            <span class="field-value">{{ a.client.budget }}</span>
          </div>
        </div>
      </div>
      <div class="card card--inner">
        <div class="cm-header">
          <span class="field-label">Менеджер</span>
        </div>
        <div class="card-fields">
          <div class="field">
            <span class="field-label">Файл звонка</span>
            <span class="field-value filename">{{ call.filename }}</span>
          </div>
          <div class="field">
            <span class="field-label">Статус</span>
            <span class="field-value">{{ call.status }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Audio player (visual) ────────────────────────────── -->
    <section class="card">
      <div class="player-header">
        <span class="block-title">Прослушать звонок</span>
        <span class="field-label">{{ formatDuration(call.duration_sec) }}</span>
      </div>
      <div class="player-controls">
        <button class="play-btn" @click="isPlaying = !isPlaying">
          <svg v-if="!isPlaying" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 2l9 5-9 5V2z" fill="currentColor"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor"/>
            <rect x="8" y="2" width="3" height="10" rx="1" fill="currentColor"/>
          </svg>
        </button>

        <div class="timeline">
          <span class="time-label">00:51</span>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: progress + '%' }" />
          </div>
          <span class="time-label">{{ formatDuration(call.duration_sec) }}</span>
        </div>

        <div class="player-extra">
          <span class="speed-btn">1×</span>
        </div>
      </div>
    </section>

    <!-- ── Transcript ────────────────────────────────────────── -->
    <TranscriptSection v-if="call.transcript" :transcript="call.transcript" />

    <!-- ── Knowledge Base ────────────────────────────────────── -->
    <KnowledgeBaseBlock />
  </div>
</template>

<style scoped>
.details-tab {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-4) var(--sp-6);
}

/* ── Card ──────────────────────────────────────────────── */
.card {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.card--inner {
  background: var(--c-bg);
  flex: 1;
}

.two-cols {
  display: flex;
  gap: var(--sp-3);
}

/* ── Fields grid ───────────────────────────────────────── */
.card-fields {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-2);
}

.field {
  background: var(--c-white);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: var(--sp-2);
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 53px;
  justify-content: center;
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
  font-size: 16px;
  font-weight: 400;
  color: var(--c-text-dark);
  line-height: 1.3;
}

.filename {
  font-size: 12px;
  word-break: break-all;
}

/* ── Badge ─────────────────────────────────────────────── */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-xl);
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
}

.badge--red { color: var(--c-red); background: rgba(251,65,74,0.08); border-color: rgba(251,65,74,0.3); }

/* ── AI card ───────────────────────────────────────────── */
.ai-card {
  background: var(--c-white);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: var(--sp-3);
  display: flex;
  gap: var(--sp-4);
  box-shadow: var(--shadow-sm);
}

.ai-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  background: rgba(108,141,175,0.1);
  border: 1px solid rgba(108,141,175,0.25);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-text-mid);
}

.ai-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.ai-header-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.ai-title {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: var(--c-text-dark);
}

.ai-topics { display: flex; gap: 6px; flex-wrap: wrap; }

.topic-tag {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: var(--c-text-mid);
}

.topic-tag::before { content: '#'; }

.ai-text {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--c-text-deep);
  line-height: 1.3;
}

.objections {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}

/* ── Client/Manager headers ──────────────────────────── */
.cm-header {
  padding-bottom: 4px;
  border-bottom: 1px solid var(--c-border);
}

/* ── Player ────────────────────────────────────────────── */
.player-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.block-title {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: var(--c-text-dark);
}

.player-controls {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
}

.play-btn {
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
  flex-shrink: 0;
}

.play-btn:hover { background: var(--c-bg); }

.timeline {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.time-label {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--c-text-mid);
  flex-shrink: 0;
}

.progress-track {
  flex: 1;
  height: 4px;
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

.player-extra { display: flex; align-items: center; }

.speed-btn {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: var(--c-text-mid);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
}
</style>
