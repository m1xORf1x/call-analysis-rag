<script setup lang="ts">
/**
 * Popup "pop up детали коммуникации" — Figma node 1:36178
 *
 * Геометрия из сохранённого get_metadata XML-дампа (1:35665 → 1:36178):
 *   Overlay   : 1:36180 Rectangle 1920×950, полупрозрачный тёмный фон
 *   Panel     : 1:36181 "pop up" x=462,y=26,w=996,h=1053
 *               → центрирован (462=(1920-996)/2), y=26 от верха frame
 *   Header    : 1:36186 y=16,h=44 (x=16 = padding popup)
 *     Tabs    : 1:36188 "Tabs days" w=304 → Tab1 w=74, Tab2 w=230
 *     Close   : 1:36192 "Tab" x=920,w=44,h=44; icon 1:36195 x=10,y=10,w=24,h=24
 */
import type { CallDetailResponse } from '~/types/callsApi'
import CallDetailsTab from '~/components/calls/CallDetailsTab.vue'
import CallAssessmentTab from '~/components/calls/CallAssessmentTab.vue'

const props = defineProps<{
  call: CallDetailResponse | null
  loading?: boolean
  loadError?: string | null
}>()
const emit = defineEmits<{ close: [] }>()

type Tab = 'details' | 'assessment'
const activeTab = ref<Tab>('details')

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

onMounted(() => { document.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('keydown', onKey) })
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close') }
</script>

<template>
  <Teleport to="body">
    <!--
      Overlay (1:36180): полупрозрачный фон 1920×950.
      Figma: popup x=462 = (1920-996)/2 → justify-content: center
      Figma: popup y=26 → padding-top: 26px
    -->
    <div class="overlay" @click="onOverlayClick">

      <!--
        Panel (1:36181): w=996, h=1053 > viewport(950) → внутренний скролл.
        Реализуем как height=calc(100vh-26px) с overflow: hidden,
        внутреннее тело прокручивается отдельно.
      -->
      <div class="panel" role="dialog" aria-modal="true">

        <!--
          Header (1:36186): y=16,h=44 от верха popup.
          Верхний отступ 16px складывается в panel-header (padding-top: 16px → итого 60px).
          Состав: tabs слева + close button справа (x=920, w=44, h=44).
          УДАЛЕНО из шапки: client name + date (их нет в 1:36186 Figma).
        -->
        <div class="panel-header">
          <!-- Tabs (1:36188): Tab1 w=74, Tab2 w=230 — auto-width из содержимого -->
          <div class="tabs">
            <button
              class="tab"
              :class="{ 'tab--active': activeTab === 'details' }"
              @click="activeTab = 'details'"
            >Детали</button>
            <button
              class="tab tab--with-badge"
              :class="{ 'tab--active': activeTab === 'assessment' }"
              @click="activeTab = 'assessment'"
            >
              Выполнение чек-листа
              <span class="tab-score tab-score--muted">—</span>
            </button>
          </div>

          <!-- Close button (1:36192 w=44,h=44; icon 1:36195 "icon/add" 24×24 at x=10,y=10) -->
          <button class="close-btn" aria-label="Закрыть" @click="emit('close')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!--
          Body: scrollable area.
          padding-top: 16px = gap от низа header (y=60) до 1:36197 basic data (y=76).
        -->
        <div class="panel-body">
          <div v-if="loading" class="popup-state">Загрузка данных звонка…</div>
          <div v-else-if="loadError" class="popup-state popup-state--error">{{ loadError }}</div>
          <div v-else-if="!call" class="popup-state">Данные звонка недоступны</div>
          <Transition v-else name="tab-fade">
            <CallDetailsTab
              v-if="activeTab === 'details'"
              key="details"
              :call="call"
            />
            <CallAssessmentTab
              v-else
              key="assessment"
              :call="call"
            />
          </Transition>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ══ Overlay (1:36180) ═══════════════════════════════════════
   Figma: popup x=462=(1920-996)/2 → centered
          popup y=26 → padding-top: 26px                       */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 35, 70, 0.18);
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 26px;
}

/* ══ Panel (1:36181) w=996, h=1053 ════════════════════════════
   height = calc(100vh - 26px) чтобы вписаться в viewport;
   контент h=1053 > доступного пространства → панель прокручивается.
   UNRESOLVED: border-radius — используем токен var(--radius) = 8px.
   UNRESOLVED: box-shadow — используем var(--shadow-02).             */
.panel {
  width: 996px;
  max-width: calc(100vw - 32px);
  height: calc(100vh - 26px);
  background: var(--c-white);
  border-radius: var(--radius);
  box-shadow: var(--shadow-02);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* Верхний padding 16px = расстояние от верха popup до 1:36186 header */
  padding-top: 16px;
}

/* ══ Header (1:36186): y=16,h=44 ══════════════════════════════
   Позиционирован y=16 от верха popup (=panel padding-top).
   Высота 44px. padding-left: 16px = x=16 в Figma.
   Close button занимает правый край (w=44 до правого padding=0).
   UNRESOLVED: border-bottom — не подтверждён из metadata, 
   оставлен как разделитель по соглашению.                     */
.panel-header {
  flex-shrink: 0;
  height: 44px;
  padding: 0 0 0 16px;
  display: flex;
  align-items: center;
  background: var(--c-white);
  border-bottom: 1px solid var(--c-border);
}

/* ── Tabs (1:36188 "Tabs days" w=304) ──────────────────────── */
.tabs {
  flex: 1;
  display: flex;
  align-items: center;
}

/* Tab1 w=74 ("Детали"), Tab2 w=230 ("Оценка коммуникации") —
   ширина складывается естественно из padding + текста.
   UNRESOLVED: точные цвета неактивного/активного таба.        */
.tab {
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--c-text-mid);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s, color 0.12s;
}

.tab:hover { background: var(--c-bg); }

.tab--active {
  background: rgba(43, 127, 255, 0.1);
  color: var(--c-blue);
  font-weight: 500;
}

.tab--with-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tab-score {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  min-width: 28px;
  padding: 0 7px;
  border-radius: 12px;
  background: rgba(26, 199, 121, 0.1);
  border: 1px solid rgba(26, 199, 121, 0.25);
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: var(--c-green);
  line-height: 1;
}

.tab-score--muted {
  background: var(--c-bg);
  border-color: var(--c-border);
  color: var(--c-text-mid);
  font-weight: 500;
}

/* ── Close button (1:36192 w=44,h=44, icon 24×24 at x=10,y=10) */
.close-btn {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  color: var(--c-text-mid);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.12s;
}

.close-btn:hover { color: var(--c-text-dark); }

/* ══ Body ══════════════════════════════════════════════════════
   Прокручиваемая область с секциями.
   padding-top: 16px = gap от низа header (y=60) до 1:36197 (y=76). */
.panel-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: clip;
  scrollbar-gutter: stable;
  padding-top: 16px;
  min-width: 0;
}

.panel-body :deep(.details-tab),
.panel-body :deep(.assessment-tab) {
  min-width: 0;
  max-width: 100%;
}

.popup-state {
  padding: 40px;
  text-align: center;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--c-text-mid);
}

.popup-state--error {
  color: var(--c-red);
}

/* ── Tab switch transition ────────────────────────────────────  */
.tab-fade-enter-active,
.tab-fade-leave-active { transition: opacity 0.15s ease; }
.tab-fade-enter-from,
.tab-fade-leave-to      { opacity: 0; }
</style>
