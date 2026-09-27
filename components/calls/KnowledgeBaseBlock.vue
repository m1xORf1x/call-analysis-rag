<script setup lang="ts">
import type { AskResponse, Citation } from '~/types/index'

const question = ref('')
const answer = ref<string | null>(null)
const citations = ref<Citation[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

async function submit() {
  const trimmed = question.value.trim()
  if (!trimmed || isLoading.value) return

  isLoading.value = true
  error.value = null
  answer.value = null
  citations.value = []

  try {
    const result = await $fetch<AskResponse>('/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { question: trimmed },
    })

    answer.value = result.answer
    citations.value = result.citations ?? []
  } catch {
    error.value = 'Не удалось получить ответ. Проверьте соединение и попробуйте ещё раз.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="kb-block">
    <!-- Header -->
    <div class="kb-header">
      <div class="kb-icon">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm1 13H9v-2h2v2zm0-4H9V5h2v6z"
                fill="currentColor" />
        </svg>
      </div>
      <div class="kb-header-text">
        <p class="kb-title">Спросить базу знаний</p>
        <p class="kb-subtitle">Задайте вопрос по скриптам продаж, возражениям или объектам</p>
      </div>
    </div>

    <!-- Input -->
    <div class="kb-input-wrap">
      <textarea
        v-model="question"
        class="kb-input"
        placeholder="Например: как отработать возражение «дорого» для ЖК Алиса?"
        rows="2"
        :disabled="isLoading"
        @keydown.enter.ctrl="submit"
        @keydown.enter.meta="submit"
      />
      <button
        class="kb-btn"
        :class="{ 'kb-btn--loading': isLoading }"
        :disabled="isLoading || !question.trim()"
        @click="submit"
      >
        <span v-if="isLoading">Загрузка…</span>
        <span v-else>Отправить</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="kb-loading">
      <span>Ищем ответ в базе знаний…</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="kb-error">
      <span>{{ error }}</span>
    </div>

    <!-- Answer area -->
    <div v-else-if="answer !== null" class="kb-answer">
      <div class="kb-answer-icon">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
          <path d="M5.5 8.5l2 2 3-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="kb-answer-body">
        <p class="kb-answer-label">Ответ базы знаний</p>
        <p class="kb-answer-text">{{ answer }}</p>

        <div v-if="citations.length" class="kb-citations">
          <p class="kb-citations-label">Источники</p>
          <div
            v-for="(citation, index) in citations"
            :key="index"
            class="kb-citation"
          >
            <p class="kb-citation-source">{{ citation.source }}</p>
            <blockquote class="kb-citation-quote">{{ citation.quote }}</blockquote>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="kb-empty">
      <span>Ответ появится здесь</span>
    </div>
  </div>
</template>

<style scoped>
.kb-block {
  background: var(--c-white);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  box-shadow: var(--shadow-01);
}

/* Header */
.kb-header {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-4);
}

.kb-icon {
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

.kb-header-text { flex: 1; }

.kb-title {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: var(--c-text-dark);
  line-height: 1.3;
}

.kb-subtitle {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 400;
  color: var(--c-text-mid);
  line-height: 1.3;
  margin-top: 2px;
}

/* Input */
.kb-input-wrap {
  display: flex;
  gap: var(--sp-2);
  align-items: flex-end;
}

.kb-input {
  flex: 1;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 8px 12px;
  font-family: 'Inder', sans-serif;
  font-size: 14px;
  color: var(--c-text-dark);
  resize: none;
  line-height: 1.4;
  transition: border-color 0.15s;
  outline: none;
}

.kb-input:focus { border-color: var(--c-blue); }

.kb-input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.kb-input::placeholder { color: var(--c-text-mid); }

.kb-btn {
  flex-shrink: 0;
  height: 40px;
  padding: 0 20px;
  background: var(--c-blue);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.kb-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.kb-btn--loading { opacity: 0.7; }

/* Loading / error */
.kb-loading,
.kb-error {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 16px;
  text-align: center;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  line-height: 1.4;
}

.kb-loading { color: var(--c-text-mid); }

.kb-error {
  color: var(--c-red);
  border-color: rgba(251, 65, 74, 0.25);
  background: rgba(251, 65, 74, 0.05);
}

/* Answer */
.kb-answer {
  display: flex;
  gap: var(--sp-3);
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: var(--sp-3);
}

.kb-answer-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  background: rgba(26,199,121,0.1);
  border: 1px solid rgba(26,199,121,0.25);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-green);
}

.kb-answer-body { flex: 1; min-width: 0; }

.kb-answer-label {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 400;
  color: var(--c-text-mid);
  margin-bottom: 4px;
}

.kb-answer-text {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--c-text-deep);
  line-height: 1.5;
  margin: 0;
}

.kb-citations {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kb-citations-label {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: var(--c-text-mid);
  line-height: 1.3;
}

.kb-citation {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kb-citation-source {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: var(--c-text-dark);
  line-height: 1.3;
  margin: 0;
  word-break: break-word;
}

.kb-citation-quote {
  margin: 0;
  padding: 10px 12px;
  background: var(--c-white);
  border: 1px solid var(--c-border);
  border-left: 3px solid var(--c-blue);
  border-radius: var(--radius-sm);
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 400;
  color: var(--c-text-deep);
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* Empty state */
.kb-empty {
  background: var(--c-bg);
  border: 1px dashed var(--c-border);
  border-radius: var(--radius);
  padding: 20px 16px;
  text-align: center;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--c-text-mid);
}
</style>
