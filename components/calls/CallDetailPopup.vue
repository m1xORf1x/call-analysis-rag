<script setup lang="ts">
import type { CallRecord } from '~/types/index'
import { clientNameFromFilename, formatDate } from '~/data/mockCalls'

const props = defineProps<{ call: CallRecord }>()
const emit = defineEmits<{ close: [] }>()

type Tab = 'details' | 'assessment'
const activeTab = ref<Tab>('details')

// Close on overlay click
function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

// Close on Escape
onMounted(() => { document.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('keydown', onKey) })
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close') }
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click="onOverlayClick">
      <div class="panel" role="dialog" aria-modal="true">

        <!-- ── Panel header (tabs + close) ─────────────── -->
        <div class="panel-header">
          <div class="tabs">
            <button
              class="tab"
              :class="{ 'tab--active': activeTab === 'details' }"
              @click="activeTab = 'details'"
            >
              Детали
            </button>
            <button
              class="tab"
              :class="{ 'tab--active': activeTab === 'assessment' }"
              @click="activeTab = 'assessment'"
            >
              Оценка коммуникации
            </button>
          </div>
          <div class="panel-meta">
            <span class="meta-name">{{ clientNameFromFilename(call.filename) }}</span>
            <span class="meta-date">{{ formatDate(call.created_at) }}</span>
          </div>
          <button class="close-btn" aria-label="Закрыть" @click="emit('close')">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- ── Panel body (scrollable) ─────────────────── -->
        <div class="panel-body">
          <Transition name="tab-fade" mode="out-in">
            <CallDetailsTab   v-if="activeTab === 'details'"    :call="call" />
            <CallAssessmentTab v-else                            :call="call" />
          </Transition>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Overlay ─────────────────────────────────────────── */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 35, 70, 0.18);
  z-index: 100;
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
}

/* ── Panel ───────────────────────────────────────────── */
.panel {
  width: min(996px, calc(100vw - 104px));
  max-width: 100vw;
  height: 100%;
  background: var(--c-white);
  box-shadow: -4px 0 40px rgba(0, 35, 70, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ─────────────────────────────────────────── */
.panel-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  height: 60px;
  border-bottom: 1px solid var(--c-border);
  background: var(--c-white);
}

.tabs {
  display: flex;
  align-items: center;
  background: var(--c-white);
  border-radius: var(--radius-sm);
  gap: 2px;
}

.tab {
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--c-text-deep);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s;
}

.tab:hover { background: var(--c-bg); }

.tab--active {
  background: var(--c-bg);
  font-weight: 500;
}

.panel-meta {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.meta-name {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: var(--c-text-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-date {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  color: var(--c-text-mid);
  white-space: nowrap;
}

.close-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--c-bg);
  border-radius: var(--radius);
  color: var(--c-text-mid);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.close-btn:hover { background: var(--c-border); color: var(--c-text-dark); }

/* ── Body ────────────────────────────────────────────── */
.panel-body {
  flex: 1;
  overflow-y: auto;
}

/* ── Tab transition ─────────────────────────────────── */
.tab-fade-enter-active,
.tab-fade-leave-active { transition: opacity 0.15s ease; }
.tab-fade-enter-from,
.tab-fade-leave-to      { opacity: 0; }
</style>
