<script setup lang="ts">
const props = defineProps<{
  transcript: string
}>()

interface TranscriptLine {
  role: 'manager' | 'client'
  text: string
}

const lines = computed<TranscriptLine[]>(() => {
  return props.transcript
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      if (l.startsWith('Менеджер:')) {
        return { role: 'manager' as const, text: l.replace('Менеджер:', '').trim() }
      }
      if (l.startsWith('Клиент:')) {
        return { role: 'client' as const, text: l.replace('Клиент:', '').trim() }
      }
      return { role: 'manager' as const, text: l.trim() }
    })
})
</script>

<template>
  <div class="transcript-block">
    <p class="block-title">Транскрипция</p>
    <div class="lines">
      <div
        v-for="(line, i) in lines"
        :key="i"
        class="line"
        :class="`line--${line.role}`"
      >
        <span class="line-role">{{ line.role === 'manager' ? 'Менеджер:' : 'Клиент:' }}</span>
        <span class="line-text">{{ line.text }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.transcript-block {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.block-title {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: var(--c-text-dark);
  line-height: 1.3;
}

.lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.line {
  display: flex;
  gap: 8px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.3;
}

.line-role {
  flex-shrink: 0;
  width: 88px;
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-text { flex: 1; }

.line--manager .line-role,
.line--manager .line-text { color: var(--c-text-dark); }

.line--client .line-role,
.line--client .line-text  { color: var(--c-blue); }
</style>
