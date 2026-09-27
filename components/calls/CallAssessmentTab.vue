<script setup lang="ts">
import type { CallRecord } from '~/types/index'

const props = defineProps<{ call: CallRecord }>()

const a = computed(() => props.call.analysis)
</script>

<template>
  <div class="assessment-tab">
    <!-- No analysis placeholder -->
    <div v-if="!a" class="no-data">
      <p>Анализ ещё не выполнен (статус: <strong>{{ call.status }}</strong>)</p>
    </div>

    <template v-else>
      <!-- ── AI Assessment ─────────────────────────────────── -->
      <section class="assess-section">
        <p class="section-title">AI оценка коммуникации</p>

        <div class="assess-cols">
          <!-- Сильные стороны -->
          <div class="assess-card assess-card--green">
            <div class="assess-card-header">
              <div class="assess-icon assess-icon--green">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.5 5.5l-4 4a.75.75 0 01-1.06 0L4.5 8.56a.75.75 0 011.06-1.06L7 8.94l3.44-3.44a.75.75 0 011.06 1.06z"
                        fill="currentColor"/>
                </svg>
              </div>
              <span class="assess-card-title assess-card-title--green">Сильные стороны</span>
            </div>
            <div class="assess-points">
              <div class="point-tag point-tag--gray">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="2" fill="currentColor"/>
                </svg>
                <span>{{ a.strongPoints }}</span>
              </div>
            </div>
          </div>

          <!-- Слабые стороны -->
          <div class="assess-card assess-card--red">
            <div class="assess-card-header">
              <div class="assess-icon assess-icon--red">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4h1.5v5h-1.5V5zm0 6h1.5v1.5h-1.5V11z"
                        fill="currentColor"/>
                </svg>
              </div>
              <span class="assess-card-title assess-card-title--red">Слабые стороны</span>
            </div>
            <div class="assess-points">
              <div class="point-tag point-tag--gray">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="2" fill="currentColor"/>
                </svg>
                <span>{{ a.weakPoints }}</span>
              </div>
            </div>
          </div>

          <!-- Рекомендации -->
          <div class="assess-card assess-card--blue">
            <div class="assess-card-header">
              <div class="assess-icon assess-icon--blue">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm1 12H9v-1.5h2V14zm0-3H9V6h2v5z"
                        fill="currentColor"/>
                </svg>
              </div>
              <span class="assess-card-title assess-card-title--blue">AI рекомендации</span>
            </div>
            <div class="assess-points">
              <div class="point-tag point-tag--gray">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="2" fill="currentColor"/>
                </svg>
                <span>{{ a.recommendation }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Client context ────────────────────────────────── -->
      <section class="card">
        <p class="section-title">Контекст клиента</p>
        <div class="client-grid">
          <div class="field">
            <span class="field-label">Объект</span>
            <span class="field-value">{{ a.client.object ?? '—' }}</span>
          </div>
          <div class="field">
            <span class="field-label">Бюджет</span>
            <span class="field-value">{{ a.client.budget ?? '—' }}</span>
          </div>
          <div class="field">
            <span class="field-label">Интерес</span>
            <span class="field-value"
              :style="{
                color: a.client.interest === 'high' ? 'var(--c-green)'
                     : a.client.interest === 'low'  ? 'var(--c-red)'
                     : 'var(--c-blue)',
                fontWeight: 600
              }"
            >{{
              a.client.interest === 'high' ? 'Высокий'
                : a.client.interest === 'low' ? 'Низкий'
                : 'Средний'
            }}</span>
          </div>
        </div>

        <div v-if="a.client.objections.length" class="objection-list">
          <span class="field-label">Возражения:</span>
          <div class="obj-tags">
            <span v-for="obj in a.client.objections" :key="obj" class="obj-tag">{{ obj }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.assessment-tab {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-4) var(--sp-6);
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

/* ── Section ────────────────────────────────────────── */
.assess-section {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: var(--sp-3);
}

.card {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.section-title {
  font-family: 'Inter', sans-serif;
  font-size: 20px;
  font-weight: 500;
  color: var(--c-text-dark);
  line-height: 1.3;
}

/* ── Three columns ─────────────────────────────────── */
.assess-cols {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-2);
}

/* ── Assess card ───────────────────────────────────── */
.assess-card {
  background: var(--c-white);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.assess-card-header {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
}

.assess-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.assess-icon--green { background: rgba(26,199,121,0.1);  border-color: rgba(26,199,121,0.25);  color: var(--c-green); }
.assess-icon--red   { background: rgba(251,65,74,0.1);   border-color: rgba(251,65,74,0.25);   color: var(--c-red); }
.assess-icon--blue  { background: rgba(43,127,255,0.1);  border-color: rgba(43,127,255,0.25);  color: var(--c-blue); }

.assess-card-title {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assess-card-title--green { color: var(--c-green); }
.assess-card-title--red   { color: var(--c-red); }
.assess-card-title--blue  { color: var(--c-blue); }

/* ── Points ────────────────────────────────────────── */
.assess-points {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.point-tag {
  display: flex;
  gap: 4px;
  align-items: flex-start;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--c-text-deep);
  line-height: 1.3;
}

.point-tag svg { flex-shrink: 0; margin-top: 3px; }

.point-tag--gray svg { color: var(--c-text-mid); }

/* ── Client fields ─────────────────────────────────── */
.client-grid {
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
  color: var(--c-text-mid);
  line-height: 1.3;
}

.field-value {
  font-family: 'Inder', sans-serif;
  font-size: 16px;
  color: var(--c-text-dark);
  line-height: 1.3;
}

/* ── Objections ─────────────────────────────────────── */
.objection-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.obj-tags { display: flex; flex-wrap: wrap; gap: 6px; }

.obj-tag {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: var(--c-red);
  background: rgba(251,65,74,0.08);
  border: 1px solid rgba(251,65,74,0.3);
  border-radius: var(--radius-xl);
  padding: 3px 10px;
}
</style>
