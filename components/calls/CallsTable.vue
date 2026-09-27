<script setup lang="ts">
/**
 * Таблица коммуникаций — точное повторение Figma:
 *   header row : node 1:35954 (container, 2945×74, gap 16, padding 16)
 *   data row   : node 1:36033 (Table instance, 2945×64, gap 16, padding 16)
 *
 * Колонки и их ширины взяты из design context узла 1:35954 / 1:36033
 * (см. x/width каждого "Text" подузла). Порядок и состав колонок НЕ сокращены.
 */
import type { CommunicationRow, Tag, Tone } from '~/data/mockCommunications'

const props = defineProps<{
  rows: CommunicationRow[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  select: [row: CommunicationRow]
}>()

const toneVars: Record<Tone, { text: string; bg: string; border: string }> = {
  green:  { text: 'var(--c-green)',  bg: 'rgba(26,199,121,0.05)',  border: 'rgba(26,199,121,0.25)' },
  blue:   { text: '#251af1e6',       bg: 'rgba(37,26,241,0.05)',   border: 'rgba(37,26,241,0.25)' },
  red:    { text: 'var(--c-red)',    bg: 'rgba(251,65,74,0.05)',   border: 'rgba(251,65,74,0.25)' },
  yellow: { text: '#ffb702',         bg: 'rgba(255,183,2,0.05)',   border: 'rgba(255,183,2,0.25)' },
  gray:   { text: 'var(--c-text-mid)', bg: 'rgba(108,141,175,0.05)', border: 'rgba(108,141,175,0.25)' },
  purple: { text: 'var(--c-purple)', bg: 'rgba(173,70,255,0.05)',  border: 'rgba(173,70,255,0.25)' },
}

const scoreColor: Record<Tone, string> = {
  green: 'var(--c-green)', blue: 'var(--c-blue)', red: 'var(--c-red)',
  yellow: '#ffb702', gray: 'var(--c-text-mid)', purple: 'var(--c-purple)',
}

const roleTagTone: Record<string, Tone> = { 'Клиент': 'blue', 'Менеджер': 'purple', 'Агент': 'green' }
</script>

<template>
  <div class="table-scroll">
    <div class="table-inner">
      <!-- ── Header row (1:35954) ─────────────────────────────── -->
      <div class="row row--head">
        <div class="col col-checkbox"><span class="head-checkbox" /></div>
        <div class="col col-channel-icon" />
        <div class="col col-channel"><span class="head-label">Канал</span><SortIcon /></div>
        <div class="col col-type"><span class="head-label">Тип</span><SortIcon /></div>
        <div class="col col-mql"><span class="head-label">MQL</span><SortIcon /></div>
        <div class="col col-sql"><span class="head-label">SQL</span><SortIcon /></div>
        <div class="col col-crm"><span class="head-label">Лид<br>из crm</span><SortIcon /></div>
        <div class="col col-date"><span class="head-label">Дата</span><SortIcon /></div>
        <div class="col col-time"><span class="head-label">Время</span><SortIcon /></div>
        <div class="col col-contact"><span class="head-label">С кем говорили</span><SortIcon /></div>
        <div class="col col-phone"><span class="head-label">Контакты</span><SortIcon /></div>
        <div class="col col-manager"><span class="head-label">Менеджер</span><SortIcon /></div>
        <div class="col col-duration"><span class="head-label">Длительность</span><SortIcon /></div>
        <div class="col col-score"><span class="head-label">Оценка</span><SortIcon /></div>
        <div class="col col-labels"><span class="head-label">Метка</span><SortIcon /></div>
        <div class="col col-city"><span class="head-label">Город</span><SortIcon /></div>
        <div class="col col-source"><span class="head-label">Источник</span><SortIcon /></div>
        <div class="col col-pct"><span class="head-label">Менеджер<br>говорит, %</span><SortIcon /></div>
        <div class="col col-pct"><span class="head-label">Клиент<br>говорит, %</span><SortIcon /></div>
        <div class="col col-dept"><span class="head-label">Отдел</span><SortIcon /></div>
        <div class="col col-summary"><span class="head-label">Резюме</span><SortIcon /></div>
        <div class="col col-trailing-icon"><span class="head-icon-btn"><MoreIcon /></span></div>
      </div>

      <!-- ── Data rows (1:36033) ──────────────────────────────── -->
      <div
        v-for="row in rows"
        :key="row.id"
        class="row row--data"
        :class="{ 'row--selected': row.id === selectedId }"
        @click="emit('select', row)"
      >
        <div class="col col-checkbox"><input type="checkbox" class="row-checkbox" @click.stop /></div>

        <div class="col col-channel-icon">
          <span class="icon-chip">
            <PhoneIcon :out="row.channelDirection === 'out'" />
          </span>
        </div>

        <div class="col col-channel"><span class="cell-text">{{ row.channel }}</span></div>
        <div class="col col-type"><span class="cell-text">{{ row.type }}</span></div>

        <div class="col col-mql">
          <span v-if="row.mql" class="tag" :style="{ color: toneVars[row.mql.tone].text, background: toneVars[row.mql.tone].bg, borderColor: toneVars[row.mql.tone].border }">{{ row.mql.label }}</span>
          <span v-else class="cell-dash">—</span>
        </div>
        <div class="col col-sql">
          <span v-if="row.sql" class="tag" :style="{ color: toneVars[row.sql.tone].text, background: toneVars[row.sql.tone].bg, borderColor: toneVars[row.sql.tone].border }">{{ row.sql.label }}</span>
          <span v-else class="cell-dash">—</span>
        </div>
        <div class="col col-crm">
          <span v-if="row.crmLead" class="tag" :style="{ color: toneVars[row.crmLead.tone].text, background: toneVars[row.crmLead.tone].bg, borderColor: toneVars[row.crmLead.tone].border }">{{ row.crmLead.label }}</span>
          <span v-else class="cell-dash">—</span>
        </div>

        <div class="col col-date"><span class="cell-text">{{ row.date }}</span></div>
        <div class="col col-time"><span class="cell-text">{{ row.time }}</span></div>

        <div class="col col-contact">
          <span class="cell-text">{{ row.contactName }}</span>
          <span
            class="tag tag--role"
            :style="{ color: toneVars[roleTagTone[row.contactRole]].text, background: 'rgba(0,122,255,0.05)', borderColor: 'rgba(0,122,255,0.15)' }"
          >{{ row.contactRole }}</span>
        </div>

        <div class="col col-phone"><span class="cell-text">{{ row.contactPhone }}</span></div>
        <div class="col col-manager"><span class="cell-text">{{ row.manager }}</span></div>
        <div class="col col-duration"><span class="cell-text cell-text--center">{{ row.durationLabel }}</span></div>

        <div class="col col-score">
          <span v-if="row.score !== null" class="score" :style="{ color: scoreColor[row.scoreTone] }">{{ row.score }}</span>
          <span v-else class="cell-dash">—</span>
        </div>

        <div class="col col-labels">
          <span
            v-for="(lbl, i) in row.labels"
            :key="i"
            class="tag"
            :style="{ color: toneVars[lbl.tone].text, background: toneVars[lbl.tone].bg, borderColor: toneVars[lbl.tone].border }"
          >{{ lbl.label }}</span>
        </div>

        <div class="col col-city"><span class="cell-text">{{ row.city }}</span></div>
        <div class="col col-source"><span class="cell-text">{{ row.source }}</span></div>
        <div class="col col-pct"><span class="cell-text">{{ row.managerTalkPct }}%</span></div>
        <div class="col col-pct"><span class="cell-text">{{ row.clientTalkPct }}%</span></div>
        <div class="col col-dept"><span class="cell-text">{{ row.department }}</span></div>
        <div class="col col-summary"><span class="cell-text cell-text--clamp">{{ row.summary }}</span></div>

        <div class="col col-trailing-icon">
          <span class="icon-chip"><MoreIcon /></span>
        </div>
      </div>

      <div v-if="rows.length === 0" class="empty-state">Коммуникации не найдены</div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, h } from 'vue'

/** Иконка сортировки/подсказки у заголовка колонки (16×16, "coin" в Figma) */
const SortIcon = defineComponent({
  render() {
    return h('svg', { width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', style: 'flex-shrink:0;color:var(--c-text-mid)' }, [
      h('path', { d: 'M4 5l3 3 3-3', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    ])
  },
})

const MoreIcon = defineComponent({
  render() {
    return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', style: 'color:var(--c-text-mid)' }, [
      h('circle', { cx: 4, cy: 8, r: 1.3, fill: 'currentColor' }),
      h('circle', { cx: 8, cy: 8, r: 1.3, fill: 'currentColor' }),
      h('circle', { cx: 12, cy: 8, r: 1.3, fill: 'currentColor' }),
    ])
  },
})

const PhoneIcon = defineComponent({
  props: { out: { type: Boolean, default: false } },
  render() {
    return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', style: 'color:var(--c-text-mid)' }, [
      this.out
        ? h('path', { d: 'M10 3h3v3M13 3L9 7M3 3h2.2c.4 0 .8.3.9.7l.6 2.1c.1.3 0 .7-.3.9L5 8c.6 1.4 1.6 2.4 3 3l1.3-1.4c.2-.3.6-.4.9-.3l2.1.6c.4.1.7.5.7.9V13c0 .6-.5 1-1 1h-.5C6.4 14 2 9.6 2 4.5V4c0-.6.4-1 1-1z', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
        : h('path', { d: 'M3 3h2.2c.4 0 .8.3.9.7l.6 2.1c.1.3 0 .7-.3.9L5 8c.6 1.4 1.6 2.4 3 3l1.3-1.4c.2-.3.6-.4.9-.3l2.1.6c.4.1.7.5.7.9V13c0 .6-.5 1-1 1h-.5C6.4 14 2 9.6 2 4.5V4c0-.6.4-1 1-1z', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    ])
  },
})

export default defineComponent({ components: { SortIcon, MoreIcon, PhoneIcon } })
</script>

<style scoped>
/* ── Scroll container ───────────────────────────────────── */
.table-scroll {
  flex: 1;
  overflow: auto;
  background: var(--c-white);
  min-height: 0;
}

.table-inner {
  display: flex;
  flex-direction: column;
  min-width: max-content;
}

/* ── Row base (matches 1:35954 / 1:36033: padding 16, gap 16) ── */
.row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid var(--c-border);
  min-width: max-content;
}

.row--head {
  background: var(--c-white);
  position: sticky;
  top: 0;
  z-index: 2;
}

.row--data {
  cursor: pointer;
  transition: background 0.12s ease;
}

.row--data:hover { background: var(--c-bg); }

.row--selected {
  background: #eef4ff;
}

/* ── Column widths (exact px from Figma) ─────────────────── */
.col { flex-shrink: 0; display: flex; align-items: center; }

.col-checkbox      { width: 16px; }
.col-channel-icon  { width: 32px; justify-content: center; }
.col-channel       { width: 120px; }
.col-type          { width: 120px; }
.col-mql           { width: 82px; }
.col-sql           { width: 82px; }
.col-crm           { width: 82px; }
.col-date          { width: 114px; }
.col-time          { width: 75px; }
.col-contact       { width: 200px; gap: 8px; }
.col-phone         { width: 150px; }
.col-manager       { width: 150px; }
.col-duration      { width: 154px; justify-content: center; }
.col-score         { width: 84px; }
.col-labels        { width: 300px; gap: 8px; flex-wrap: wrap; }
.col-city          { width: 114px; }
.col-source        { width: 150px; }
.col-pct           { width: 110px; }
.col-dept          { width: 150px; }
.col-summary       { width: 300px; }
.col-trailing-icon { width: 32px; justify-content: center; }

/* ── Header cell ──────────────────────────────────────────── */
.head-label {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: var(--c-text-mid);
  line-height: 1.3;
  white-space: nowrap;
}

.row--head .col { gap: 8px; }
.row--head .col-contact,
.row--head .col-labels { gap: 8px; }

.head-checkbox {
  width: 16px;
  height: 16px;
  border: 1px solid var(--c-text-mid);
  border-radius: 4px;
  display: inline-block;
}

.head-icon-btn {
  width: 32px;
  height: 32px;
  background: var(--c-bg);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Data cell ────────────────────────────────────────────── */
.cell-text {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: var(--c-text-dark);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-text--center { width: 100%; text-align: center; }

.cell-text--clamp {
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.cell-dash {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--c-text-mid);
}

.row-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--c-blue);
  cursor: pointer;
}

.icon-chip {
  width: 32px;
  height: 32px;
  background: var(--c-bg);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ── Tag / badge ──────────────────────────────────────────── */
.tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 12px;
  border: 1px solid transparent;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.tag--role { font-weight: 700; }

.score {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
}

/* ── Empty state ──────────────────────────────────────────── */
.empty-state {
  padding: 48px 16px;
  text-align: center;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--c-text-mid);
}
</style>
