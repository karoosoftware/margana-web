<script setup>
import { ref, computed } from 'vue'
import coachMessages from '@/resources/coach-messages.json'

const props = defineProps({
  session: { type: Object, required: true }
})

const currentMessages = ref([])
const currentMessageIndex = ref(0)
const currentRowIndex = ref(null)
const currentStage = ref(null)

const currentMessage = computed(() => {
  if (currentMessages.value.length === 0) return ''
  return currentMessages.value[currentMessageIndex.value] || ''
})

const totalMessages = computed(() => currentMessages.value.length)

const nextMessage = () => {
  if (currentMessages.value.length === 0) return
  currentMessageIndex.value = (currentMessageIndex.value + 1) % currentMessages.value.length
}

const analyze = () => {
  const { gm, am, result, canSubmit } = props.session
  
  const rowCount = props.session.baseGrid.value?.length || 0
  
  let firstIncompleteRow = -1
  for (let i = 0; i < rowCount; i++) {
    if (!gm.hasAnyEditableInRow(i)) continue

    const wildcardOk = gm.rowHasWildcard(i)
    const ok = wildcardOk || !!gm.rowValid.value[i]

    if (!ok) {
      firstIncompleteRow = i
      break
    }
  }

  let stage = null
  let messages = []

  if (firstIncompleteRow !== -1) {
    stage = 'ROW_INCOMPLETE'
    messages = coachMessages.stages.ROW_INCOMPLETE
    currentRowIndex.value = firstIncompleteRow
  } else {
    // Grid is complete
    currentRowIndex.value = null

    const userAnagram = am.builderWord.value || ''
    const longestAnagramCount = result.value?.meta?.longestAnagramCount || 0
    const isAnagramMaximized = (am.anagramVerifiedPoints.value > 0) && (userAnagram.length >= longestAnagramCount)
    
    if (!isAnagramMaximized) {
      stage = 'ANAGRAM_PROGRESS'
      messages = coachMessages.stages.ANAGRAM_PROGRESS
    } else {
      // Anagram maximized
      stage = 'ADVANCED_TACTICS'
      messages = coachMessages.stages.ADVANCED_TACTICS
    }
  }

  // Clicking coach button (analyze) starts from index 0
  currentMessageIndex.value = 0
  currentStage.value = stage
  currentMessages.value = messages
}

const clear = () => {
  currentMessages.value = []
  currentMessageIndex.value = 0
  currentRowIndex.value = null
  currentStage.value = null
}

defineExpose({
  analyze,
  clear,
  nextMessage,
  currentMessage,
  currentMessageIndex,
  totalMessages,
  currentRowIndex,
  currentStage
})
</script>

<template>
  <div v-if="false"></div>
</template>
