<script setup lang="ts">
import type { CallRecord } from '~/types/index'
import { formatDuration, formatDate, clientNameFromFilename } from '~/data/mockCalls'

const props = defineProps<{
  calls: CallRecord[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  select: [call: CallRecord]
}>()

const interestLabel: Record<string, string> = {
  high:   'Высокий',
  medium: 'Средний',
  low:    'Низкий',
}

const statusLabel: Record<string, string> = {
  pending:     'В очереди',
  downloaded:  'Скачан',
  transcribed: 'Транскрибирован',
  analyzed:    'Проанализирован',
  error:       'Ошибка',
}

function scoreColor(interest: string | undefined): string {
  if (interest === 'high')   return 'var(--c-green)'
  if (interest === 'low')    return 'var(--c-red)'
  return 'var(--c-blue)'
}
</script>

<template>
  <div class="table-wrap">
    <!-- ── Header row ─────────────────────────────────────── -->
    <div class="tbl-head">
      <div class="col col-name">Клиент / Контакт</div>
      <div class="col col-date">Дата</div>
      <div class="col col-dur">Длит.</div>
      <div class="col col-status">Статус</div>
      <div class="col col-object">Объект</div>
      <div class="col col-interest">Интерес</div>
      <div class="col col-summary">Резюме</div>
    </div>

    <!-- ── Rows ───────────────────────────────────────────── -->
    <div
      v-for="call in calls"
      :key="call.id"
      class="tbl-row"
      :class="{ 'tbl-row--selected': call.id === selectedId }"
      @click="emit('select', call)"
    >
      <!-- Клиент -->
      <div class="col col-name">
        <div class="cell-primary">{{ clientNameFromFilename(call.filename) }}</div>
        <div class="cell-secondary">{{ call.filename.replace(/.*_(\d{2}_\d{2}_\d{4})\..*/, '$1').replace(/_/g, '.') }}</div>
      </div>

      <!-- Дата -->
      <div class="col col-date">
        <span class="cell-primary">{{ formatDate(call.created_at) }}</span>
      </div>

      <!-- Длительность -->
      <div class="col col-dur">
        <span class="cell-primary">{{ formatDuration(call.duration_sec) }}</span>
      </div>

      <!-- Статус -->
      <div class="col col-status">
        <span
          class="badge"
          :class="{
            'badge--green':  call.status === 'analyzed',
            'badge--blue':   call.status === 'transcribed' || call.status === 'downloaded',
            'badge--gray':   call.status === 'pending',
            'badge--red':    call.status === 'error',
          }"
        >{{ statusLabel[call.status] }}</span>
      </div>

      <!-- Объект -->
      <div class="col col-object">
        <span class="cell-primary">{{ call.analysis?.client.object ?? '—' }}</span>
      </div>

      <!-- Интерес клиента -->
      <div class="col col-interest">
        <span
          v-if="call.analysis"
          class="badge"
          :style="{ color: scoreColor(call.analysis.client.interest),
                    background: scoreColor(call.analysis.client.interest) + '14',
                    borderColor: scoreColor(call.analysis.client.interest) + '40' }"
        >{{ interestLabel[call.analysis.client.interest] }}</span>
        <span v-else class="cell-secondary">—</span>
      </div>

      <!-- Краткое резюме -->
      <div class="col col-summary">
        <span class="cell-summary">{{ call.analysis?.summary ?? call.error ?? '—' }}</span>
      </div>
    </div>

    <div v-if="calls.length === 0" class="tbl-empty">
      Звонки не найдены
    </div>
  </div>
</template>

<style scoped>
.table-wrap {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  background: var(--c-white);
  border-radius: var(--radius);
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-01);
}

/* ── Header ─────────────────────────────────────────────── */
.tbl-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  height: 46px;
  background: var(--c-bg);
  border-bottom: 1px solid var(--c-border);
  position: sticky;
  top: 0;
  z-index: 2;
}

.tbl-head .col {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 400;
  color: var(--c-text-mid);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
}

/* ── Row ─────────────────────────────────────────────────── */
.tbl-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  min-height: 64px;
  border-bottom: 1px solid var(--c-border);
  cursor: pointer;
  transition: background 0.12s ease;
  background: var(--c-white);
}

.tbl-row:last-child { border-bottom: none; }

.tbl-row:hover { background: var(--c-bg); }

.tbl-row--selected {
  background: #eef4ff;
  border-left: 3px solid var(--c-blue);
  padding-left: 13px;
}

/* ── Column sizes ────────────────────────────────────────── */
.col-name     { flex: 0 0 180px; min-width: 140px; }
.col-date     { flex: 0 0 120px; min-width: 100px; }
.col-dur      { flex: 0 0 72px;  min-width: 60px; }
.col-status   { flex: 0 0 148px; min-width: 120px; }
.col-object   { flex: 0 0 148px; min-width: 120px; }
.col-interest { flex: 0 0 100px; min-width: 90px; }
.col-summary  { flex: 1;         min-width: 160px; }

/* ── Cell text ───────────────────────────────────────────── */
.cell-primary {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: var(--c-text-dark);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.cell-secondary {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 400;
  color: var(--c-text-mid);
  line-height: 1.3;
  display: block;
  margin-top: 2px;
}

.cell-summary {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--c-text-dark);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Badge ───────────────────────────────────────────────── */
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 10px;
  border-radius: var(--radius-xl);
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
  white-space: nowrap;
}

.badge--green  { color: var(--c-green); background: rgba(26,199,121,0.08); border-color: rgba(26,199,121,0.25); }
.badge--blue   { color: var(--c-blue);  background: rgba(43,127,255,0.08); border-color: rgba(43,127,255,0.25); }
.badge--gray   { color: var(--c-text-mid); background: rgba(108,141,175,0.08); border-color: rgba(108,141,175,0.25); }
.badge--red    { color: var(--c-red);   background: rgba(251,65,74,0.08); border-color: rgba(251,65,74,0.3); }

/* ── Empty ───────────────────────────────────────────────── */
.tbl-empty {
  padding: 48px 16px;
  text-align: center;
  font-size: 14px;
  color: var(--c-text-mid);
}
</style>
