<script setup>
import {ref, computed} from 'vue'
import {PlayIcon, AcademicCapIcon} from '@heroicons/vue/20/solid'
import GridBoard from '../GridBoard.vue'
import AnagramBuilder from '../AnagramBuilder.vue'
import LiveScoreSpinner from '../LiveScoreSpinner.vue'

const props = defineProps({
  session: {type: Object, required: true},
  readonly: {type: Boolean, default: false},
  isTutorial: {type: Boolean, default: false},
  landscape: {type: Boolean, default: false},
  settings: {type: Object, required: true},
  scoreFor: {type: Function, required: true},
  showSpinner: {type: Boolean, default: true},
  showLetterScores: {type: Boolean, default: false},
  showTutorialButton: {type: Boolean, default: false},
  coachRow: {type: Number, default: null},
  coachStage: {type: String, default: null},
})

const emit = defineEmits(['update:showLetterScores', 'trigger-tutorial', 'trigger-coach'])

const anagramBuilder = ref(null)

// Expose the internal anagram builder ref for parent use (e.g., ghost player events)
defineExpose({
  anagramBuilder
})

const gm = computed(() => props.session.gm)
const am = computed(() => props.session.am)
const pm = computed(() => props.session.pm)

const anagramPopupClass = () => {
  return [
    'px-2 py-1',
    'rounded-full text-white shadow-lg',
    'bg-gradient-to-tr from-purple-600 to-orange-600',
    'animate-fade-out-5s',
    'leading-none tracking-tight text-center',
  ].join(' ')
}

const onBuilderChange = (word) => {
  props.session.onBuilderChange(word, anagramBuilder)
}

const onVerifyAnagram = (word) => {
  props.session.onVerifyAnagram(word, anagramBuilder)
}

</script>

<template>
  <div class="flex flex-col items-center w-full margana-play-column margana-proportions">
    <!-- Live scoring spinner and buttons -->
    <div v-if="!props.landscape && ($slots['top-banner'] || (props.showSpinner && props.settings.enableLiveScoring))"
         class="w-65 sm:w-80 flex flex-col px-2 mt-1 gap-0">
      <!-- Buttons row (above spinner) OR Top Banner replacement -->
      <div v-if="!props.isTutorial || $slots['top-banner']" 
           class="flex flex-row items-center justify-between"
           :class="{ 'mb-1': !$slots['top-banner'] }">
        <slot name="top-banner">
          <button
              v-if="!props.isTutorial"
              @click="emit('trigger-coach')"
              class="flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/20 text-white shadow ring-1 ring-white/20 transition"
              :style="{ fontSize: 'var(--margana-top-btn-font-size)', padding: 'var(--margana-top-btn-py) var(--margana-top-btn-px)' }"
              title="Get coaching tip"
          >
            <AcademicCapIcon class="w-4 h-4"/>
            <span class="text-sm">Coaching</span>
          </button>

          <button
              v-if="props.showTutorialButton && !props.isTutorial"
              @click="emit('trigger-tutorial')"
              class="flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition shadow-sm ring-1 ring-white/20"
              :style="{ fontSize: 'var(--margana-top-btn-font-size)', padding: 'var(--margana-top-btn-py) var(--margana-top-btn-px)' }"
              title="Start Tutorial"
          >
            <PlayIcon class="w-4 h-4"/>
            <span class="text-sm">Tutorial</span>
          </button>
        </slot>
      </div>

      <div v-if="!$slots['top-banner']" class="margana-live-score flex justify-center">
        <LiveScoreSpinner
            :score="Number(props.session.score.value)"
            :enabled="!!props.settings.enableLiveScoring"
            size="large"
            :reels="3"
        />
      </div>
    </div>

    <GridBoard
        v-if="!props.landscape && props.session.baseGrid.value.length && gm.editableGrid.value.length"
        :baseGrid="props.session.baseGrid.value"
        :editableGrid="gm.editableGrid.value"
        :endOfGame="props.session.endOfGame.value"
        :readonly="props.readonly"
        :shakeRow="props.session.shakeRow.value"
        :errorRow="props.session.errorRow.value"
        :rowError="gm.rowError.value"
        :highlightedCells="props.session.highlightedCells.value"
        :pulseCells="pm.pulseCells.value"
        :pulseThemes="pm.effectivePulseThemes.value"
        :pulseLabels="pm.effectivePulseLabels.value"
        :showPulseLabels="props.settings.showPulseLabels"
        :scoreFor="props.scoreFor"
        :isTargetCell="am.isTargetCell"
        :isVerticalTargetCell="am.isVerticalTargetCell"
        :isDiagonalCell="am.isDiagonalCell"
        :wildcardBypassEnabled="props.settings.enableWildcardBypass"
        :coachRow="props.coachRow"
        :setGridContainer="() => {}"
        :setInputRef="(key, el) => (props.session.im.inputRefs.value[key] = el)"
        size="large"
        @cell-input="props.session.handleInput"
        @cell-backspace="props.session.handleBackspace"
        @cell-arrow="props.session.handleArrow"
        @cell-enter="props.session.handleEnter"
    />

    <div class="relative w-full flex flex-col items-center">
      <!-- Anagram celebration popup -->
      <div v-if="(props.settings.showAnagramPopup !== false) && props.session.anagramPopupVisible.value"
           class="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-full z-30 select-none w-[min(90vw,24rem)] flex justify-center"
           style="top: var(--margana-popup-offset)">
        <div :class="anagramPopupClass()" class="max-w-full" style="font-size: var(--margana-popup-font-size)">
          <span class="font-semibold">{{ props.session.anagramPopupText.value }}</span>
        </div>
      </div>

      <AnagramBuilder
          ref="anagramBuilder"
          :topAnagram="am.topAnagram.value"
          :anagramRevealMask="am.anagramRevealMask.value"
          :endOfGame="props.session.endOfGame.value"
          :readonly="props.readonly"
          :scoreFor="props.scoreFor"
          :hydrating="am.hydrationInProgress.value"
          :initialSnapshot="am.initialBuilderSnapshot.value"
          :landscape="props.landscape"
          :showHelpControls="!props.isTutorial"
          :isTutorial="props.isTutorial"
          :showCoachArrow="props.coachStage === 'ANAGRAM_PROGRESS'"
          size="large"
          @builder-change="onBuilderChange"
          @builder-snapshot="props.session.onBuilderSnapshot"
          @shuffle="props.session.onAnagramShuffleClicked"
          @reset="props.session.onAnagramReset"
          @verify-anagram="onVerifyAnagram"
      >
        <template #right-controls="{ controlsBtnSizeClass }">
          <slot name="right-controls" :controlsBtnSizeClass="controlsBtnSizeClass"></slot>
        </template>
      </AnagramBuilder>
    </div>
  </div>
</template>

<style scoped>
@keyframes shake {
  10%, 90% {
    transform: translate3d(-1px, 0, 0);
  }
  20%, 80% {
    transform: translate3d(2px, 0, 0);
  }
  30%, 50%, 70% {
    transform: translate3d(-4px, 0, 0);
  }
  40%, 60% {
    transform: translate3d(4px, 0, 0);
  }
}

:deep(.animate-shake) {
  animation: shake 0.6s both;
}

@keyframes snapback {
  from {
    transform: translateY(-6px);
  }
  to {
    transform: translateY(0);
  }
}

:deep(.animate-snapback) {
  animation: snapback 0.25s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fadeIn 0.4s ease-out forwards;
}
</style>
