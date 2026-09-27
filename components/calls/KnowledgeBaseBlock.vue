<script setup lang="ts">
const question = ref('')
const answer = ref('')
const isLoading = ref(false)

// Placeholder — POST /ask не подключён на этом этапе
function submit() {
  if (!question.value.trim() || isLoading.value) return
  isLoading.value = true
  answer.value = ''
  // TODO: интеграция с POST /api/ask
  setTimeout(() => {
    answer.value = '[Интеграция с базой знаний будет добавлена на следующем этапе]'
    isLoading.value = false
  }, 600)
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
        @keydown.enter.ctrl="submit"
        @keydown.enter.meta="submit"
      />
      <button
        class="kb-btn"
        :class="{ 'kb-btn--loading': isLoading }"
        :disabled="isLoading || !question.trim()"
        @click="submit"
      >
        <span v-if="isLoading">...</span>
        <span v-else>Отправить</span>
      </button>
    </div>

    <!-- Answer area -->
    <div v-if="answer" class="kb-answer">
      <div class="kb-answer-icon">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
          <path d="M5.5 8.5l2 2 3-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="kb-answer-body">
        <p class="kb-answer-label">Ответ базы знаний</p>
        <p class="kb-answer-text">{{ answer }}</p>
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

.kb-answer-body { flex: 1; }

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
  line-height: 1.3;
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
