<script setup>
import { computed } from 'vue'
/**
 * GridBoard.vue
 * Purpose: Presentational board for the Kriss Kross letter grid.
 * (rest of your header comments unchanged)
 */

/** @type {import('vue').DefineProps<any>} */
const props = defineProps({
  baseGrid: { type: Array, required: true },
  editableGrid: { type: Array, required: true },
  endOfGame: { type: Boolean, required: true },
  shakeRow: { type: [Number, null], default: null },
  errorRow: { type: [Number, null], default: null },
  rowError: { type: Array, default: () => [] },
  highlightedCells: { type: Object, required: true }, // Set<string>
  pulseCells: { type: Object, default: () => new Set() }, // Set<string>
  pulseThemes: { type: Object, default: () => new Map() }, // Map<string,string>
  pulseLabels: { type: Object, default: () => new Map() }, // Map<string,string>
  // New: allow parent to completely disable celebratory pulses/labels
  showPulseLabels: { type: Boolean, default: true },
  scoreFor: { type: Function, required: true },
  isTargetCell: { type: Function, required: true },
  isVerticalTargetCell: { type: Function, required: true },
  isDiagonalCell: { type: Function, required: true },
  setGridContainer: { type: Function, required: true },
  setInputRef: { type: Function, required: true },
  skippedRows: { type: Array, default: () => [] },
  wildcardBypassEnabled: { type: Boolean, default: true },
  readonly: { type: Boolean, default: false },
  size: { type: String, default: 'large' }, // small | medium | large
  coachRow: { type: Number, default: null },
})

const emit = defineEmits(['cell-input', 'cell-backspace', 'cell-arrow', 'cell-enter'])

import marganaStarMark from '@/assets/margana_min_logo.svg'

/**
 * @param {number} row
 * @param {number} col
 * @param {KeyboardEvent} e
 */
function handleKeydown(row, col, e) {
  if (props.endOfGame || (props.readonly && e.isTrusted)) return

  const clearWildcardRow = () => {
    const cols = props.baseGrid[row]?.length ?? 0
    for (let c = 0; c < cols; c++) {
      if (!props.isTargetCell(row, c) && props.editableGrid[row][c] === '*') {
        props.editableGrid[row][c] = ''
      }
    }
  }

  if (e.key === '*') {
    if (!props.wildcardBypassEnabled) return
    e.preventDefault()
    e.stopPropagation()
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation()

    const cols = props.baseGrid[row]?.length ?? 0
    for (let c = 0; c < cols; c++) {
      if (!props.isTargetCell(row, c)) props.editableGrid[row][c] = '*'
    }
    return
  }

  if (
    props.wildcardBypassEnabled &&
    (e.key === 'Backspace' || e.key === 'Delete') &&
    props.editableGrid[row]?.[col] === '*'
  ) {
    e.preventDefault()
    e.stopPropagation()
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation()
    clearWildcardRow()
    return
  }

  const isPrintable = e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
  if (props.wildcardBypassEnabled && isPrintable && e.key !== '*' && props.editableGrid[row]?.[col] === '*') {
    clearWildcardRow()
  }
}

function isRowErrored(r) {
  return !!(Array.isArray(props.rowError) && props.rowError[r] === true)
}


function ringThemeClass(theme) {
  const t = String(theme || 'default')
  return `pulse-theme-${['pal', 'sem', 'ana', 'diag', 'mad'].includes(t) ? t : 'default'}`
}

/**
 * @param {string} theme one of 'pal'|'sem'|'ana'|'diag'|'default'
 * @param {number} c column index
 * @param {number} cols total columns in this row
 */
function popupClass(theme, c, cols) {
  const t = String(theme || 'default')

  let base =
    'pointer-events-none absolute z-50 select-none rounded-full text-white shadow-lg ' +
    'animate-fade-out-5s bg-gradient-to-tr ' +
    'whitespace-nowrap leading-none tracking-tight px-2 py-1'

  let pos = 'left-1/2 -translate-x-1/2'
  if (c <= 1) pos = 'left-1 translate-x-0'
  else if (c >= cols - 2) pos = 'right-1 left-auto translate-x-0'

  if (t === 'pal') base += ' from-fuchsia-600 via-pink-600 to-violet-700'
  else if (t === 'sem') base += ' from-amber-500 via-orange-500 to-rose-500 shadow-amber-500/30'
  else if (t === 'ana') base += ' from-purple-600 to-orange-600'
  else if (t === 'diag') base += ' from-purple-500 to-fuchsia-600'
  else if (t === 'mad') base += ' bg-gradient-to-tr from-emerald-600 to-amber-400'
  else base += ' from-indigo-500 to-violet-600'

  return `${base} ${pos}`
}


const tileSizeClass = computed(() => ({
  tiny: 'margana-grid-tile-tiny',
  small: 'margana-grid-tile-small',
  medium: 'margana-grid-tile-medium',
  large: 'margana-grid-tile-large',
}[props.size] ?? 'margana-grid-tile-large'))

const radiusClass = computed(() => ({
  tiny: 'margana-grid-radius-tiny',
  small: 'margana-grid-radius-small',
  medium: 'margana-grid-radius-medium',
  large: 'margana-grid-radius-large',
}[props.size] ?? 'margana-grid-radius-large'))

const shadowClass = computed(() => ({
  tiny: 'shadow-sm',
  small: 'shadow-md',
  medium: 'shadow-md',
  large: 'shadow-xl',
}[props.size] ?? 'shadow-xl'))

const textSizeClass = computed(() => '')

const labelTextClass = computed(() => ({
  tiny: 'text-[6px]',
  small: 'text-[8px]',
  medium: 'text-[9px]',
  large: 'text-[10px] sm:text-xs',
}[props.size] ?? 'text-[10px] sm:text-xs'))

</script>

<template>
  <div :ref="props.setGridContainer" @dragover.prevent.stop @drop.prevent.stop class="margana-grid-wrap margana-grid-width">
    <div class="grid mb-2 sm:mb-4 margana-grid-gap">
      <div
        v-for="(row, r) in props.baseGrid"
        :key="r"
        class="flex justify-center margana-grid-row relative"
        :class="[
          props.shakeRow === r ? 'animate-shake' : ''
        ]"
        :aria-label="props.skippedRows && props.skippedRows.includes(r) ? 'Skipped row' : undefined"
      >
        <div
          v-if="props.coachRow === r"
          class="absolute -left-9 sm:-left-10 top-1/2 -translate-y-1/2 flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] flex items-center justify-center shadow-md pointer-events-none select-none"
        >
          <svg class="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <div
          v-for="(cell, c) in row"
          :key="c"
          class="relative flex items-center justify-center tracking-widest transition-transform duration-200"
          :class="[
            tileSizeClass,
            radiusClass,
            shadowClass,
            textSizeClass,
            props.highlightedCells.has(`${r}:${c}`)
              ? 'bg-gradient-to-tr from-fuchsia-500 via-purple-700 to-slate-700'
              : 'bg-gradient-to-tr from-pink-500 to-yellow-400',

            (props.isVerticalTargetCell(r, c) || props.isDiagonalCell(r, c))
              ? 'text-gray-900'
              : (isRowErrored(r) || props.errorRow === r)
              ? 'text-red-700'
              : 'text-white',

            props.highlightedCells.has(`${r}:${c}`)
              ? 'ring-1 ring-fuchsia-300 ring-offset-1 ring-offset-transparent shadow-lg shadow-fuchsia-500/30 text-white'
              : '',

            'focus-within:ring-1 focus-within:ring-white focus-within:ring-offset-1 focus-within:ring-offset-transparent'
          ]"
        >
          <div
              v-if="props.showPulseLabels && (
                (props.pulseThemes && props.pulseThemes.get && props.pulseThemes.get(`${r}:${c}`)) ||
                (props.pulseCells && props.pulseCells.has(`${r}:${c}`))
              )
            "
            :class="[
              'pointer-events-none absolute inset-0 z-40',
              radiusClass,
              ringThemeClass((props.pulseThemes && props.pulseThemes.get && props.pulseThemes.get(`${r}:${c}`)) || 'default')
            ]"
          >
            <div class="pulse-ring"></div>

            <div
              v-if="props.showPulseLabels && props.pulseLabels && props.pulseLabels.get && props.pulseLabels.get(`${r}:${c}`)"
              :class="popupClass(
                props.pulseLabels.get(`${r}:${c}`).theme || 'default',
                c,
                row.length
              )"
              :style="{ top: 'var(--margana-popup-offset)', fontSize: 'var(--margana-popup-font-size)' }"
            >
              <span class="font-semibold">{{ props.pulseLabels.get(`${r}:${c}`).text }}</span>
            </div>
          </div>

          <template v-if="props.isTargetCell(r, c)">
            <span class="margana-grid-letter w-full h-full flex items-center justify-center uppercase" aria-hidden="true">{{ props.baseGrid[r][c] }}</span>
          </template>

          <template v-else>
            <img
              v-if="
                props.editableGrid[r] && (
                  (props.wildcardBypassEnabled && props.editableGrid[r][c] === '*') ||
                  (props.skippedRows && props.skippedRows.includes(r))
                )
              "
              :src="marganaStarMark"
              alt=""
              aria-hidden="true"
              class="pointer-events-none absolute inset-0 m-auto w-full object-contain opacity-95"
            />

            <input
              v-if="props.editableGrid[r]"
              :id="`grid-cell-${r}-${c}`"
              v-model="props.editableGrid[r][c]"
              maxlength="1"
              :tabindex="props.readonly ? -1 : 0"
              :ref="(el) => props.setInputRef(`r${r}c${c}`, el)"
              @input="emit('cell-input', r, c)"
              @keydown="handleKeydown(r, c, $event)"
              @keydown.backspace.prevent="emit('cell-backspace', r, c)"
              @keydown.enter.prevent="emit('cell-enter', r, c)"
              @keydown.up.prevent="emit('cell-arrow', r, c, 'up')"
              @keydown.down.prevent="emit('cell-arrow', r, c, 'down')"
              @keydown.left.prevent="emit('cell-arrow', r, c, 'left')"
              @keydown.right.prevent="emit('cell-arrow', r, c, 'right')"
              :disabled="props.endOfGame"
              :readonly="props.readonly"
              :inputmode="props.readonly ? 'none' : 'text'"
              class="margana-grid-letter w-full h-full text-center bg-transparent outline-none uppercase disabled:cursor-not-allowed disabled:opacity-100"
              :class="[
                textSizeClass,
                props.readonly ? 'pointer-events-none' : '',
                (props.wildcardBypassEnabled && props.editableGrid[r][c] === '*') ||
                (props.skippedRows && props.skippedRows.includes(r))
                  ? 'text-transparent caret-transparent'
                  : (isRowErrored(r) || props.errorRow === r)
                  ? 'text-red-700'
                  : 'text-white',
                props.endOfGame ? 'cursor-not-allowed opacity-80' : 'caret-white',
              ]"
              inputmode="text"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              aria-label="Letter"
            />
          </template>

          <span
              v-if="props.isTargetCell(r, c) ?
              props.baseGrid[r][c] : (props.editableGrid[r] && props.editableGrid[r][c] && props.editableGrid[r][c] !== '*' && !props.skippedRows.includes(r))"
              class="margana-grid-score margana-grid-score-pos pointer-events-none absolute bottom-1 right-1 z-10 font-semibold opacity-90"
              aria-hidden="true"
              :class="labelTextClass"
          >
            {{
              props.isTargetCell(r, c)
                  ? props.scoreFor(props.baseGrid[r][c])
                  : props.scoreFor(props.editableGrid[r][c])
            }}
</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Theme -> ring colour (space-separated RGB) */
.pulse-theme-default { --pulse-rgb: 99 102 241; }
.pulse-theme-pal     { --pulse-rgb: 232 121 249; }
.pulse-theme-sem     { --pulse-rgb: 245 158 11; }
.pulse-theme-ana     { --pulse-rgb: 147 51 234; }
.pulse-theme-diag    { --pulse-rgb: 217 70 239; }
/* Madness theme (match banner vibe: use violet-600 core for ring glow) */
.pulse-theme-mad { --pulse-rgb: 35 141 132; }

@keyframes pulseRingFade {
  0% {
    opacity: 1;
    box-shadow:
      0 0 0 0 rgb(var(--pulse-rgb) / 0.85),
      0 0 0 8px rgb(var(--pulse-rgb) / 0.45),
      0 0 24px 6px rgb(var(--pulse-rgb) / 0.45);
  }
  50% {
    opacity: 0.7;
    box-shadow:
      0 0 0 0 rgb(var(--pulse-rgb) / 0.65),
      0 0 0 10px rgb(var(--pulse-rgb) / 0.30),
      0 0 28px 8px rgb(var(--pulse-rgb) / 0.32);
  }
  100% {
    opacity: 0;
    box-shadow:
      0 0 0 0 rgb(var(--pulse-rgb) / 0),
      0 0 0 14px rgb(var(--pulse-rgb) / 0),
      0 0 36px 12px rgb(var(--pulse-rgb) / 0);
  }
}

.pulse-ring {
  position: absolute;
  inset: -3px;
  border-radius: inherit;
  animation: pulseRingFade 5s ease-out forwards;
}

/* fade for labels (doesn't fight Tailwind transforms) */
@keyframes fadeOut5s {
  0% { opacity: 1; translate: 0 0; scale: 1; }
  60% { opacity: 0.85; translate: 0 -2px; scale: 1.02; }
  100% { opacity: 0; translate: 0 -6px; scale: 0.98; }
}
.animate-fade-out-5s { animation: fadeOut5s 5s ease-out forwards; }
</style>
