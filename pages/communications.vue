<script setup lang="ts">
import type { CallRecord } from '~/types/index'
import { mockCalls } from '~/data/mockCalls'

useHead({ title: 'Коммуникации — Bestseller AI' })

const calls = ref<CallRecord[]>(mockCalls)
const selectedCall = ref<CallRecord | null>(null)

// Filter state
const activeFilter = ref<'all' | 'clients' | 'agents'>('all')

const filteredCalls = computed(() => calls.value)

function openCall(call: CallRecord) { selectedCall.value = call }
function closeCall() { selectedCall.value = null }
</script>

<template>
  <div class="layout">
    <!-- ── Left sidebar (40px, matches Figma Menu) ─────────── -->
    <nav class="sidebar">
      <div class="sidebar-logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="var(--c-blue)"/>
          <path d="M7 12h10M7 8h6M7 16h8" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="sidebar-icons">
        <button class="nav-icon nav-icon--active" title="Коммуникации">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6l-4 3V5z"
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="nav-icon" title="Аналитика">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="11" width="3" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="8.5" y="7" width="3" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="14" y="3" width="3" height="14" rx="1" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
        <button class="nav-icon" title="База знаний">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                  stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 7h4M8 11h4M8 15h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </nav>

    <!-- ── Main content ─────────────────────────────────────── -->
    <main class="main">
      <!-- Header -->
      <header class="page-header">
        <div class="header-left">
          <h1 class="page-title">Коммуникации</h1>
          <div class="header-tabs">
            <button
              class="header-tab"
              :class="{ 'header-tab--active': activeFilter === 'all' }"
              @click="activeFilter = 'all'"
            >Все</button>
            <button
              class="header-tab"
              :class="{ 'header-tab--active': activeFilter === 'clients' }"
              @click="activeFilter = 'clients'"
            >Клиенты</button>
            <button
              class="header-tab"
              :class="{ 'header-tab--active': activeFilter === 'agents' }"
              @click="activeFilter = 'agents'"
            >Агенты</button>
          </div>
        </div>
        <div class="header-right">
          <div class="search-box">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.4"/>
              <path d="M12.5 12.5L16 16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            <input class="search-input" placeholder="Клиент, менеджер, телефон..." />
          </div>
          <button class="filter-btn">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 5h14M5 9h8M8 13h2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            Фильтры
          </button>
        </div>
      </header>

      <!-- Subheader: count -->
      <div class="subheader">
        <span class="count-label">Найдено коммуникаций: <strong>{{ filteredCalls.length }}</strong></span>
      </div>

      <!-- Table -->
      <div class="table-container">
        <CallsTable
          :calls="filteredCalls"
          :selected-id="selectedCall?.id ?? null"
          @select="openCall"
        />
      </div>
    </main>

    <!-- ── Popup ────────────────────────────────────────────── -->
    <Transition name="popup">
      <CallDetailPopup
        v-if="selectedCall"
        :call="selectedCall"
        @close="closeCall"
      />
    </Transition>
  </div>
</template>

<style scoped>
/* ── Layout ──────────────────────────────────────────── */
.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--c-bg);
}

/* ── Sidebar ─────────────────────────────────────────── */
.sidebar {
  flex-shrink: 0;
  width: 64px;
  background: var(--c-white);
  border-right: 1px solid var(--c-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  gap: 8px;
}

.sidebar-logo {
  margin-bottom: 16px;
}

.sidebar-icons {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-icon {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--c-text-mid);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.nav-icon:hover { background: var(--c-bg); color: var(--c-text-dark); }

.nav-icon--active {
  background: rgba(43,127,255,0.1);
  color: var(--c-blue);
}

/* ── Main ────────────────────────────────────────────── */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* ── Page header ─────────────────────────────────────── */
.page-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 64px;
  border-bottom: 1px solid var(--c-border);
  background: var(--c-white);
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.page-title {
  font-family: 'Inter', sans-serif;
  font-size: 24px;
  font-weight: 500;
  color: var(--c-text-dark);
  white-space: nowrap;
}

.header-tabs {
  display: flex;
  background: var(--c-bg);
  border-radius: var(--radius-sm);
  padding: 3px;
  gap: 2px;
}

.header-tab {
  height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  color: var(--c-text-deep);
  cursor: pointer;
  transition: background 0.12s;
}

.header-tab--active {
  background: var(--c-white);
  font-weight: 500;
  box-shadow: var(--shadow-sm);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Search */
.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 0 12px;
  height: 40px;
  min-width: 280px;
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
}

.search-input::placeholder { color: var(--c-text-mid); }

/* Filter button */
.filter-btn {
  height: 40px;
  padding: 0 16px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  background: var(--c-bg);
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--c-text-dark);
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background 0.12s;
  white-space: nowrap;
}

.filter-btn:hover { background: var(--c-border); }

/* ── Subheader ───────────────────────────────────────── */
.subheader {
  flex-shrink: 0;
  padding: 8px 16px;
  background: var(--c-white);
  border-bottom: 1px solid var(--c-border);
}

.count-label {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  color: var(--c-text-mid);
}

/* ── Table container ─────────────────────────────────── */
.table-container {
  flex: 1;
  overflow: hidden;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

/* ── Popup transition ────────────────────────────────── */
.popup-enter-active,
.popup-leave-active { transition: transform 0.22s ease, opacity 0.22s ease; }
.popup-enter-from,
.popup-leave-to     { transform: translateX(32px); opacity: 0; }
</style>
