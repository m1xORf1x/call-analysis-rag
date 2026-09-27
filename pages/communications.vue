<script setup lang="ts">
/**
 * Главный экран «Коммуникации» — точное повторение Figma node 1:35849
 * "1920/ Коммуникации" (1920×950).
 *
 * Использованные Figma-узлы (см. отчёт в чате для полного списка):
 *   1:35850 sidebar (Menu)
 *   1:35852 title (заголовок + пилюли-табы)
 *   1:35874 filters (search + кнопки)
 *   1:35888 filters (чипсы фильтров)
 *   1:35922 count row (частично — см. известные ограничения)
 *   1:35954 table header
 *   1:36033 table row
 */
import type { CallDetailResponse, CallsListResponse } from '~/types/callsApi'
import type { CommunicationRow } from '~/data/mockCommunications'
import CallDetailPopup from '~/components/calls/CallDetailPopup.vue'

useHead({ title: 'Коммуникации — Bestseller AI' })

const {
  data: callsResponse,
  pending: callsPending,
  error: callsError,
  refresh: refreshCalls,
} = await useFetch<CallsListResponse>('/api/calls')

const rows = computed(() => callsResponse.value?.calls ?? [])

const popupCallId = ref<string | null>(null)
const selectedCall = ref<CallDetailResponse | null>(null)
const callDetailPending = ref(false)
const callDetailError = ref<string | null>(null)
const headerFilter = ref<'all' | 'clients' | 'agents'>('all')

async function openRow(row: CommunicationRow) {
  popupCallId.value = row.callId
  selectedCall.value = null
  callDetailError.value = null
  callDetailPending.value = true
  try {
    selectedCall.value = await $fetch<CallDetailResponse>(`/api/calls/${row.callId}`)
  } catch {
    callDetailError.value = 'Не удалось загрузить данные звонка'
  } finally {
    callDetailPending.value = false
  }
}

function closePopup() {
  popupCallId.value = null
  selectedCall.value = null
  callDetailError.value = null
  callDetailPending.value = false
}

/** id строки таблицы, соответствующей открытому в popup звонку (для подсветки) */
const selectedRowId = computed<string | null>(() => {
  if (!popupCallId.value) return null
  return rows.value.find(r => r.callId === popupCallId.value)?.id ?? null
})

/** Активный фильтр «Тип» (null = показать все строки) */
const typeFilter = ref<string | null>(null)
const typeMenuOpen = ref(false)

/** Уникальные значения type из presentation rows — без хардкода */
const typeOptions = computed(() => [...new Set(rows.value.map(row => row.type))].sort())

const displayedRows = computed(() => {
  if (!typeFilter.value) return rows.value
  return rows.value.filter(row => row.type === typeFilter.value)
})

function selectType(value: string) {
  typeFilter.value = value
  typeMenuOpen.value = false
}

function clearTypeFilter() {
  typeFilter.value = null
  typeMenuOpen.value = false
}

function clearAllFilters() {
  typeFilter.value = null
  typeMenuOpen.value = false
}

function onDocumentClick() {
  typeMenuOpen.value = false
}

onMounted(() => { document.addEventListener('click', onDocumentClick) })
onBeforeUnmount(() => { document.removeEventListener('click', onDocumentClick) })

/** Чипсы фильтров без логики (Figma) — кроме «Тип», см. typeFilter */
const filterChips = [
  'MQL', 'SQL', 'Дата', 'Время', 'Менеджер', 'Длительность',
  'Оценка', 'Город', 'Источник', 'Менеджер говорит %', 'Клиент говорит %',
  'Отдел', 'Метка', 'Объект', 'Этап воронки', 'Агентство',
]
</script>

<template>
  <div class="page">
    <!-- ══ Sidebar (1:35850 "Menu") ══════════════════════════ -->
    <nav class="sidebar">
      <div class="sidebar-top">
        <div class="sidebar-logo">BZ</div>

        <div class="sidebar-icons">
          <button class="side-icon side-icon--active" title="Коммуникации">
            <!-- Тот же path, что в CallsTable PhoneIcon (viewBox 16×16 → 24×24) -->
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none"><path d="M3 3h2.2c.4 0 .8.3.9.7l.6 2.1c.1.3 0 .7-.3.9L5 8c.6 1.4 1.6 2.4 3 3l1.3-1.4c.2-.3.6-.4.9-.3l2.1.6c.4.1.7.5.7.9V13c0 .6-.5 1-1 1h-.5C6.4 14 2 9.6 2 4.5V4c0-.6.4-1 1-1z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="side-icon" title="Метки">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M11 4H6a2 2 0 00-2 2v5l9.6 9.6a2 2 0 002.8 0l4.2-4.2a2 2 0 000-2.8L11 4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8" cy="9" r="1.3" fill="currentColor"/></svg>
          </button>
          <button class="side-icon" title="Документы">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 3h9l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 12h7M9 16h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>

        <div class="side-divider" />

        <div class="sidebar-icons">
          <button class="side-icon" title="Дашборд">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/></svg>
          </button>
          <button class="side-icon" title="Аналитика">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="4" y="13" width="4" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="10" y="9" width="4" height="11" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="16" y="4" width="4" height="16" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>
          </button>
          <button class="side-icon" title="Отчёты">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 3h9l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 10h7M9 14h7M9 18h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <button class="side-icon" title="Клиенты">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 20c0-3 2.5-5.5 5.5-5.5S14.5 17 14.5 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="17" cy="9" r="2.3" stroke="currentColor" stroke-width="1.5"/><path d="M15 20c0-2.3 1.5-4.1 3.5-4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <button class="side-icon" title="Скоринг">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 15a8 8 0 1116 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 15l4-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <button class="side-icon" title="Задачи">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 6h14M5 12h14M5 18h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <button class="side-icon" title="Уведомления">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 10a6 6 0 1112 0c0 3 1 4.5 1.5 5.5H4.5C5 14.5 6 13 6 10z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 19a2 2 0 004 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <button class="side-icon" title="Настройки">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M12 3v2M12 19v2M4.2 7l1.7 1M18.1 16l1.7 1M4.2 17l1.7-1M18.1 8l1.7-1M3 12h2M19 12h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>

      <div class="sidebar-bottom">
        <button class="side-icon" title="Понравилось">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M7 11v9H4a1 1 0 01-1-1v-7a1 1 0 011-1h3zm0 0l3.5-7a2 2 0 013.7 1.2L13.3 9H19a2 2 0 012 2.3l-1.4 7A2 2 0 0117.6 20H10a3 3 0 01-3-3v-6z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
        </button>
        <button class="side-icon" title="Сохранённое">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 3h12v18l-6-4-6 4V3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </button>
        <button class="side-icon" title="Медиа">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="14" rx="1.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="9" r="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M3 15l5-4 4 3 3-3 6 5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </nav>

    <!-- ══ Main ═══════════════════════════════════════════════ -->
    <main class="main">

      <!-- ── Title block (1:35852) ───────────────────────────── -->
      <div class="title-block">

        <!-- header row: title + tab pills + search + filter btn + icon btns -->
        <div class="header-row">
          <div class="header-left">
            <h1 class="page-title">Коммуникации</h1>
            <div class="pill-group">
              <button
                class="pill"
                :class="{ 'pill--active': headerFilter === 'all' }"
                @click="headerFilter = 'all'"
              >Все</button>
              <button
                class="pill"
                :class="{ 'pill--active': headerFilter === 'clients' }"
                @click="headerFilter = 'clients'"
              >Клиенты</button>
              <button
                class="pill"
                :class="{ 'pill--active': headerFilter === 'agents' }"
                @click="headerFilter = 'agents'"
              >Агенты</button>
            </div>
          </div>

          <div class="header-right">
            <div class="search-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M20 20l-4.5-4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
              <input class="search-input" placeholder="Клиент, менеджер, телефон..." />
            </div>

            <button class="filters-btn">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M6 12h12M10 18h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
              <span class="filters-btn-label">Фильтры</span>
              <span class="filters-badge">3</span>
            </button>

            <button class="icon-btn" title="Добавить виджет">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/></svg>
            </button>
            <button class="icon-btn" title="Загрузить коммуникацию">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3v12M12 15l-4-4M12 15l4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 19h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
            <button class="icon-btn" title="Скачать таблицу">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3v12M8 11l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 19h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>

        <!-- filter chips panel (1:35888) -->
        <div class="filter-chips-panel">
          <div class="filter-chips">
            <span class="chip"><ChipIcon /> Канал <ChevronIcon /></span>
            <span v-if="typeFilter" class="chip chip--active">
              Тип: {{ typeFilter }}
              <span class="chip-close" role="button" tabindex="0" aria-label="Сбросить фильтр типа" @click="clearTypeFilter" @keydown.enter="clearTypeFilter"><CloseIcon /></span>
            </span>
            <span v-else class="chip-wrap">
              <span class="chip" @click.stop="typeMenuOpen = !typeMenuOpen"><ChipIcon /> Тип <ChevronIcon /></span>
              <div v-if="typeMenuOpen" class="type-menu" @click.stop>
                <button
                  v-for="option in typeOptions"
                  :key="option"
                  type="button"
                  class="type-menu-item"
                  @click="selectType(option)"
                >{{ option }}</button>
              </div>
            </span>
            <span v-for="chip in filterChips" :key="chip" class="chip"><ChipIcon /> {{ chip }} <ChevronIcon /></span>

            <span class="chip-actions">
              <button class="btn-reset" @click="clearAllFilters">Сбросить все <CloseIcon /></button>
              <button class="btn-apply">Применить</button>
            </span>
          </div>
        </div>
      </div>

      <!-- ── Table area (1:35921 container) ──────────────────── -->
      <div class="table-area">
        <div class="count-row">
          <span class="count-text">Найдено коммуникаций: <strong>{{ displayedRows.length }}</strong></span>
          <!--
            ИЗВЕСТНЫЙ ПРОБЕЛ (подтверждён повторно через get_metadata на 1:35926):
            между текстом счётчика и группой действий в Figma есть ещё 2 ButtonSecondary
            (65px и 159px, gap 8px, перед кнопкой "Сбросить" 113px) — их текст/иконки
            не удалось получить: get_design_context на 1:35926 уперся в месячный лимит
            Figma MCP (Starter/View = 20 вызовов/мес, исчерпан). Инстансы в metadata не
            разворачивают текстовые дочерние узлы, поэтому не придумываю их содержимое.
          -->
          <div class="count-actions">
            <button class="btn-reset-sm">
              Сбросить
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            </button>
            <button class="icon-btn-sm" title="Действие">
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M8.5 2v13M2 8.5h13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            </button>
            <button class="icon-btn-sm" title="Действие">
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M8.5 3v9M4.5 8l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>

        <div class="calls-panel">
          <div v-if="callsPending" class="panel-state">Загрузка коммуникаций…</div>
          <div v-else-if="callsError" class="panel-state panel-state--error">
            <p>Не удалось загрузить список коммуникаций</p>
            <button type="button" class="panel-state-btn" @click="refreshCalls()">Повторить</button>
          </div>
          <CallsTable
            v-else
            :rows="displayedRows"
            :selected-id="selectedRowId"
            @select="openRow"
          />
        </div>
      </div>
    </main>

    <!-- ══ Popup (не меняется на этом этапе) ══════════════════ -->
    <Transition name="popup">
      <CallDetailPopup
        v-if="popupCallId"
        :call="selectedCall"
        :loading="callDetailPending"
        :load-error="callDetailError"
        @close="closePopup"
      />
    </Transition>
  </div>
</template>

<script lang="ts">
import { defineComponent, h } from 'vue'

const ChipIcon = defineComponent({
  render() { return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', style: 'flex-shrink:0' }, [h('circle', { cx: 8, cy: 8, r: 5.5, stroke: 'currentColor', 'stroke-width': 1.3 })]) },
})
const ChevronIcon = defineComponent({
  render() { return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', style: 'flex-shrink:0' }, [h('path', { d: 'M4 6l4 4 4-4', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })]) },
})
const CloseIcon = defineComponent({
  render() { return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', style: 'flex-shrink:0' }, [h('path', { d: 'M4 4l8 8M12 4l-8 8', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round' })]) },
})

export default defineComponent({ components: { ChipIcon, ChevronIcon, CloseIcon } })
</script>

<style scoped>
/* ══ Page layout: 32px canvas padding, 32px gap sidebar/main (Figma frame margins) ══ */
.page {
  display: flex;
  height: 100vh;
  padding: 32px;
  gap: 32px;
  background: var(--c-bg);
  overflow: hidden;
}

/* ══ Sidebar (1:35850) — 40px wide ══════════════════════════ */
.sidebar {
  flex-shrink: 0;
  width: 40px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
}

.sidebar-top {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.sidebar-logo {
  width: 40px;
  height: 40px;
  background: #e20718;
  border-radius: 4px;
  color: #fefeff;
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sidebar-icons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  align-items: center;
}

.side-divider {
  width: 100%;
  height: 1px;
  background: var(--c-border);
}

.side-icon {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--c-text-mid);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.12s, color 0.12s;
}

.side-icon svg {
  display: block;
  flex-shrink: 0;
}

.side-icon:hover { background: var(--c-bg); color: var(--c-text-dark); }

.side-icon--active {
  background: rgba(43, 127, 255, 0.1);
  color: var(--c-blue);
}

.sidebar-bottom {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid var(--c-border);
  width: 100%;
}

/* ══ Main ═══════════════════════════════════════════════════ */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  overflow: hidden;
}

/* ── Title block (1:35852) ──────────────────────────────────── */
.title-block {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex-shrink: 0;
}

/* header row */
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.page-title {
  font-family: 'Inter', sans-serif;
  font-size: 32px;
  font-weight: 500;
  color: var(--c-text-dark);
  line-height: 1.3;
  white-space: nowrap;
}

/* Tab pills (1:35856) */
.pill-group {
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--c-white);
  border: 1px solid var(--c-border);
  border-radius: 12px;
  padding: 6px;
}

.pill {
  height: 34px;
  min-width: 84px;
  padding: 0 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--c-text-mid);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s, color 0.12s;
}

.pill--active {
  background: rgba(43, 127, 255, 0.1);
  color: var(--c-blue);
}

/* Header right: search + filters + icons */
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 489px;
  height: 44px;
  background: var(--c-white);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 6px 8px;
  color: var(--c-text-mid);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-family: 'Inder', sans-serif;
  font-size: 14px;
  color: var(--c-text-dark);
  outline: none;
  min-width: 0;
}

.search-input::placeholder { color: var(--c-text-mid); }

.filters-btn {
  height: 44px;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--c-blue);
  border: 1px solid var(--c-blue);
  border-radius: var(--radius);
  color: #fefeff;
  cursor: pointer;
  flex-shrink: 0;
}

.filters-btn-label {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.filters-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  min-width: 20px;
  padding: 0 6px;
  border-radius: 12px;
  background: var(--c-bg);
  color: var(--c-blue);
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 700;
}

.icon-btn {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  padding: 6px;
  background: var(--c-white);
  border: 1px solid var(--c-blue);
  border-radius: var(--radius);
  color: var(--c-blue);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s;
}

.icon-btn:hover { background: var(--c-bg); }

/* Filter chips panel (1:35888) */
.filter-chips-panel {
  background: var(--c-white);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow-02);
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 8px;
  background: var(--c-white);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--c-text-deep);
  white-space: nowrap;
  cursor: pointer;
}

.chip--active {
  background: rgba(43, 127, 255, 0.1);
  border-color: var(--c-blue);
}

.chip-close {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.chip-wrap {
  position: relative;
  display: inline-flex;
}

.type-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 10;
  min-width: 100%;
  background: var(--c-white);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-02);
  padding: 4px;
  display: flex;
  flex-direction: column;
}

.type-menu-item {
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--c-text-deep);
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}

.type-menu-item:hover {
  background: var(--c-bg);
}

.chip-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 4px;
}

.btn-reset {
  height: 32px;
  min-width: 109px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--c-text-mid);
  cursor: pointer;
  white-space: nowrap;
}

.btn-apply {
  height: 32px;
  min-width: 109px;
  padding: 8px 12px;
  background: var(--c-blue);
  border: none;
  border-radius: var(--radius);
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--c-bg);
  cursor: pointer;
  white-space: nowrap;
}

/* ── Table area (1:35921) ────────────────────────────────────── */
.table-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: hidden;
}

.count-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  /* Figma (1:35923): содержимое count-row смещено на 16px, чтобы совпасть
     с левым отступом чекбокса таблицы (col-checkbox начинается с x=16 в 1:35954/1:36033) */
  padding-left: 16px;
}

.count-text {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--c-text-mid);
}

.count-text strong { color: var(--c-text-dark); font-weight: 600; }

.count-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-reset-sm {
  height: 32px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--c-text-mid);
  cursor: pointer;
}

.icon-btn-sm {
  width: 32px;
  height: 32px;
  background: var(--c-bg);
  border: none;
  border-radius: var(--radius);
  color: var(--c-text-mid);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.calls-panel {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  display: flex;
}

.panel-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--c-text-mid);
  background: var(--c-white);
}

.panel-state--error p {
  margin: 0;
  color: var(--c-red);
}

.panel-state-btn {
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  background: var(--c-white);
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--c-text-dark);
  cursor: pointer;
}

.panel-state-btn:hover {
  background: var(--c-bg);
}

/* ── Popup transition ────────────────────────────────────────── */
.popup-enter-active,
.popup-leave-active { transition: transform 0.22s ease, opacity 0.22s ease; }
.popup-enter-from,
.popup-leave-to     { transform: translateX(32px); opacity: 0; }

/* ── Minimal responsive safety net (~1280px) ────────────────── */
@media (max-width: 1400px) {
  .search-box { width: 320px; }
}
</style>
