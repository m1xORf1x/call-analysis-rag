<script setup lang="ts">
const props = defineProps<{
  transcript: string
}>()

interface TranscriptLine {
  label: string
  variant: 'manager' | 'client' | 'speaker-a' | 'speaker-b' | 'neutral'
  text: string
}

const SPEAKER_RE = /^\[Speaker (\d+)\]\s*(.*)$/

function variantForSpeaker(num: string): TranscriptLine['variant'] {
  if (num === '1') return 'speaker-a'
  if (num === '2') return 'speaker-b'
  return 'neutral'
}

const lines = computed<TranscriptLine[]>(() => {
  return props.transcript
    .split('\n')
    .filter(l => l.trim())
    .map((line) => {
      const speaker = line.match(SPEAKER_RE)
      if (speaker) {
        const num = speaker[1]!
        const text = speaker[2]?.trim() ?? ''
        return {
          label: `Спикер ${num}:`,
          variant: variantForSpeaker(num),
          text: text || '—',
        }
      }

      if (line.startsWith('Менеджер:')) {
        return {
          label: 'Менеджер:',
          variant: 'manager' as const,
          text: line.replace('Менеджер:', '').trim(),
        }
      }

      if (line.startsWith('Клиент:')) {
        return {
          label: 'Клиент:',
          variant: 'client' as const,
          text: line.replace('Клиент:', '').trim(),
        }
      }

      return {
        label: '—',
        variant: 'neutral' as const,
        text: line.trim(),
      }
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
        :class="`line--${line.variant}`"
      >
        <span class="line-role">{{ line.label }}</span>
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
  min-width: 0;
  max-width: 100%;
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

.line-text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.line--manager .line-role,
.line--manager .line-text,
.line--speaker-a .line-role,
.line--speaker-a .line-text { color: var(--c-text-dark); }

.line--client .line-role,
.line--client .line-text,
.line--speaker-b .line-role,
.line--speaker-b .line-text { color: var(--c-blue); }

.line--neutral .line-role,
.line--neutral .line-text { color: var(--c-text-mid); }
</style>
