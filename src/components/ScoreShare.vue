<script setup>
import { computed, ref, nextTick, onMounted } from 'vue'
import AppCard from './AppCard.vue'
import { toBlob } from 'html-to-image'
import marganaLogo from '@/assets/margana_full_logo.svg'

const emit = defineEmits(['back-to-play'])

const props = defineProps({
  marganaResult: { type: Object, required: false, default: null },
  // Controls whether breadcrumb navigation and share toolbar are shown
  showControls: { type: Boolean, required: false, default: true },
  // When true (default), preload the logo on mount for iOS capture reliability.
  // Set to false to avoid an extra network request when ScoreShare is mounted
  // but sharing is not immediately needed (e.g., embedded read-only views).
  preloadOnMount: { type: Boolean, required: false, default: true },
})

// ---- Data extraction ----
const items = computed(() =>
  Array.isArray(props.marganaResult?.valid_words_metadata)
    ? props.marganaResult.valid_words_metadata
    : [],
)

const finalScore = computed(() => {
  // Strict source of truth: always read from the JSON payload's total_score
  const topTotal = Number(props.marganaResult?.total_score)
  return Number.isFinite(topTotal) && topTotal >= 0 ? topTotal : 0
})

const dateLabel = computed(() => {
  const raw = String(props.marganaResult?.meta?.date || '').trim()
  if (!raw) return ''

  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const [, y, mo, d] = m
    return `${d}.${mo}.${y}`
  }

  const dt = new Date(raw)
  if (!isNaN(dt.getTime())) {
    const dd = String(dt.getDate()).padStart(2, '0')
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const yyyy = dt.getFullYear()
    return `${dd}.${mm}.${yyyy}`
  }

  return raw
})

// ---- Stats for display (spoiler-free) ----
const palTotalScore = computed(() =>
  items.value.reduce((sum, it) => {
    if (!it?.palindrome) return sum
    const s = Number(it?.score)
    return Number.isFinite(s) ? sum + s : sum
  }, 0),
)

const semTotalScore = computed(() =>
  items.value.reduce((sum, it) => {
    if (!it?.semordnilap) return sum
    const s = Number(it?.score)
    return Number.isFinite(s) ? sum + s : sum
  }, 0),
)

const diagTotalScore = computed(() =>
  items.value.reduce((sum, it) => {
    if (String(it?.type || '') !== 'diagonal') return sum
    if (it?.palindrome) return sum
    if (it?.semordnilap) return sum
    const s = Number(it?.score)
    return Number.isFinite(s) ? sum + s : sum
  }, 0),
)

// Total score for horizontal (row) words, LR direction only (exclude RL)
// Also exclude palindromes and semordnilap from this horizontal total per requirement
const rowTotalScore = computed(() =>
  items.value.reduce((sum, it) => {
    if (String(it?.type || '') !== 'row') return sum
    const dir = String(it?.direction || '').toLowerCase()
    if (dir !== 'lr') return sum
    if (it?.palindrome) return sum
    if (it?.semordnilap) return sum
    const s = Number(it?.score)
    return Number.isFinite(s) ? sum + s : sum
  }, 0),
)

// Total score for anagram including any bonus that was awarded
const anagramScoreTotal = computed(() =>
  items.value.reduce((sum, it) => {
    if (String(it?.type || '') !== 'anagram') return sum
    const base_score = Number(it?.base_score)
    const bonus = Number(it?.bonus)
    const base_scoreOk = Number.isFinite(base_score) ? base_score : 0
    const bonusOk = Number.isFinite(bonus) ? bonus : 0
    return sum + base_scoreOk + bonusOk
  }, 0),
)

const anagramTarget = computed(() => {
  const v = Number(props.marganaResult?.meta?.longestAnagramCount)
  return Number.isFinite(v) && v > 0 ? v : 0
})

const userAnagramLen = computed(() => {
  const raw = String(props.marganaResult?.meta?.userAnagram || '')
  return raw.replace(/[^a-zA-Z]/g, '').length
})

const madnessAvailable = computed(
  () => !!props.marganaResult?.meta?.madnessAvailable,
)
const madnessFound = computed(
  () => !!props.marganaResult?.meta?.madnessFound,
)

const madnessItem = computed(() =>
  items.value.find((item) => {
    const word = String(item?.word || '').toLowerCase()
    return item?.type === 'madness' || word === 'margana'
  }) || null,
)

const madnessScore = computed(() => {
  const item = madnessItem.value
  if (!item) return 0
  const s = Number(item?.score)
  return Number.isFinite(s) ? s : 0
})

const currentRank = computed(() => {
  const v = Number(props.marganaResult?.metrics?.current_rank)
  return Number.isFinite(v) && v > 0 ? v : null
})

// ---- Sharing state ----
const shareRoot = ref(null)
// Independent flags so one button's state doesn't affect the others
const isMobileSharing = ref(false)
const isCopying = ref(false)
const isDownloading = ref(false)

// Desktop vs mobile (for toolbar options)
const isDesktop = computed(() => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Macintosh|Windows/i.test(ua)
})

// ---- Toast (inline near buttons, can replace Copy) ----
const toast = ref({ visible: false, message: '', type: 'info', forCopy: false })
let toastTimerId = null

function showToast(message, type = 'info', options = {}) {
  const forCopy = !!options.forCopy
  toast.value = { visible: true, message, type, forCopy }

  if (toastTimerId !== null && typeof window !== 'undefined') {
    window.clearTimeout(toastTimerId)
  }
  if (typeof window !== 'undefined') {
    toastTimerId = window.setTimeout(() => {
      toast.value.visible = false
    }, 2400)
  }
}

// ---- Logo preloading (for iOS capture reliability) ----
const logoSrc = ref(marganaLogo)
const logoReady = ref(false)

async function preloadLogoToDataUrl() {
  try {
    const res = await fetch(marganaLogo, { cache: 'force-cache' })
    const blob = await res.blob()

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('reader'))
      reader.onload = () => resolve(String(reader.result || ''))
      reader.readAsDataURL(blob)
    })

    const img = new Image()
    img.src = dataUrl
    try {
      await img.decode?.()
    } catch {
      // ignore
    }

    logoSrc.value = dataUrl
  } catch {
    logoSrc.value = marganaLogo
  } finally {
    logoReady.value = true
  }
}

async function ensureLogoLoaded() {
  // Make sure we have a data URL ready
  if (!logoReady.value) {
    await preloadLogoToDataUrl().catch(() => {
      // even on failure, don't block capture
      logoReady.value = true
    })
  }

  // Flush logoSrc change into the DOM
  await nextTick()

  // Ensure the actual <img> inside shareRoot has finished loading
  try {
    const rootEl = shareRoot.value
    const imgEl = rootEl?.querySelector?.('.logo-img')
    if (imgEl && !imgEl.complete) {
      await new Promise(resolve => {
        const done = () => {
          imgEl.removeEventListener('load', done)
          imgEl.removeEventListener('error', done)
          resolve()
        }
        imgEl.addEventListener('load', done)
        imgEl.addEventListener('error', done)
      })
    }
  } catch {
    // best-effort only
  }
}


onMounted(() => {
  if (props.preloadOnMount) {
    preloadLogoToDataUrl().catch(() => {
      logoReady.value = true
    })
  } else {
    // Defer until a share action triggers ensureLogoLoaded()
    logoReady.value = false
  }
})

// ---- Lightweight analytics hooks ----
function dispatchUsage(name, data) {
  try {
    window.dispatchEvent(
      new CustomEvent('margana-usage', { detail: { name, data } }),
    )
  } catch {
    // ignore
  }
}

function shareAnalytics(payload = {}) {
  const meta = {
    date: props.marganaResult?.meta?.date || null,
    total_score: Number(props.marganaResult?.total_score),
    words: items.value.length,
    ...payload,
  }
  dispatchUsage('share_scorecard', meta)
}

function filenameForShare() {
  const d = String(props.marganaResult?.meta?.date || '').replaceAll('-', '')
  return `margana-${d || 'share'}.png`
}

// ---- Rescale helper (used after capture) ----
async function scaleBlobToWidth(blob, targetWidth) {
  try {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.src = url
    await img.decode()

    // If already small enough, no scaling
    if (!(targetWidth > 0) || img.width <= targetWidth) {
      URL.revokeObjectURL(url)
      return blob
    }

    const scale = targetWidth / img.width
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = Math.round(img.height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      URL.revokeObjectURL(url)
      return blob
    }

    ctx.imageSmoothingEnabled = true
    try { ctx.imageSmoothingQuality = 'high' } catch {}

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    URL.revokeObjectURL(url)

    const out = await new Promise(resolve => {
      canvas.toBlob(b => resolve(b || blob), 'image/png')
    })

    return out || blob
  } catch {
    return blob
  }
}

async function createShareBlob() {
  if (!shareRoot.value) throw new Error('shareRoot missing')

  // Make sure logo is inlined and rendered before capture
  await ensureLogoLoaded()

  try {
    await document.fonts?.ready
  } catch {
    // ignore
  }

  const el = shareRoot.value
  el.classList.add('share-capture')

  try {
    const rect = el.getBoundingClientRect()
    const width = rect.width || el.offsetWidth || 0
    const height = rect.height || el.offsetHeight || 0
    if (!width || !height) throw new Error('invalid element size')

    const blob0 = await toBlob(el, {
      width,
      height,
      pixelRatio: 2,
      skipFonts: false,
      cacheBust: true,
    })
    if (!blob0) throw new Error('html-to-image: failed to render blob')

    const TARGET_WIDTH = 360
    const blob = await scaleBlobToWidth(blob0, TARGET_WIDTH)
    return blob
  } finally {
    el.classList.remove('share-capture')
  }
}


// ---- Mobile: native share ----
async function shareOnMobile() {
  isMobileSharing.value = true
  shareAnalytics({ stage: 'start', method: 'web_share' })

  try {
    const blob = await createShareBlob()
    const file = new File([blob], filenameForShare(), { type: 'image/png' })

    if (navigator?.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Margana – Score Share',
        text: 'Here’s my Margana score card!',
      })
      shareAnalytics({ stage: 'complete', method: 'web_share', success: true })
      showToast('Shared!', 'info', { forCopy: false })
    } else {
      throw new Error('native share not supported')
    }
  } catch (err) {
    console.error(err)
    showToast('Unable to share on this device.', 'error', { forCopy: false })
    shareAnalytics({
      stage: 'error',
      method: 'web_share',
      success: false,
      message: String(err?.message || err).slice(0, 200),
    })
  } finally {
    isMobileSharing.value = false
  }
}

// ---- Desktop: copy to clipboard ----
async function copyImageDesktop() {
  isCopying.value = true
  shareAnalytics({ stage: 'start', method: 'clipboard' })

  try {
    const blob = await createShareBlob()

    if (navigator?.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
      shareAnalytics({
        stage: 'complete',
        method: 'clipboard',
        success: true,
      })
      // inline toast replaces Copy button
      showToast('Copied to clipboard', 'info', { forCopy: true })
    } else {
      // Fallback to download if clipboard unsupported
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filenameForShare()
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      shareAnalytics({
        stage: 'complete',
        method: 'download_fallback_from_clipboard',
        success: true,
      })
      showToast('Clipboard not available, image downloaded instead', 'info', {
        forCopy: true,
      })
    }
  } catch (err) {
    console.error(err)
    showToast('Unable to copy image', 'error', { forCopy: true })
    shareAnalytics({
      stage: 'error',
      method: 'clipboard',
      success: false,
      message: String(err?.message || err).slice(0, 200),
    })
  } finally {
    isCopying.value = false
  }
}

// ---- Desktop: download ----
async function downloadImageDesktop() {
  isDownloading.value = true
  shareAnalytics({ stage: 'start', method: 'download' })

  try {
    const blob = await createShareBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filenameForShare()
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    shareAnalytics({
      stage: 'complete',
      method: 'download',
      success: true,
    })
    showToast('Image downloaded', 'info', { forCopy: false })
  } catch (err) {
    console.error(err)
    showToast('Unable to download image', 'error', { forCopy: false })
    shareAnalytics({
      stage: 'error',
      method: 'download',
      success: false,
      message: String(err?.message || err).slice(0, 200),
    })
  } finally {
    isDownloading.value = false
  }
}

// ---- Click handlers ----
async function onShareClick() {
  // Mobile share button
  dispatchUsage('score_share_button_click', {
    date: props.marganaResult?.meta?.date || null,
    words: items.value.length,
    total_score: Number(props.marganaResult?.total_score),
    ts: Date.now(),
    entry: 'mobile_share_button',
  })

  await shareOnMobile()
}

async function onCopyClick() {
  // Desktop copy
  dispatchUsage('score_share_button_click', {
    date: props.marganaResult?.meta?.date || null,
    words: items.value.length,
    total_score: Number(props.marganaResult?.total_score),
    ts: Date.now(),
    entry: 'desktop_copy_button',
  })

  await copyImageDesktop()
}

async function onDownloadClick() {
  // Desktop download
  dispatchUsage('score_share_button_click', {
    date: props.marganaResult?.meta?.date || null,
    words: items.value.length,
    total_score: Number(props.marganaResult?.total_score),
    ts: Date.now(),
    entry: 'desktop_download_button',
  })

  await downloadImageDesktop()
}
</script>

<template>
  <div class="relative flex-1 flex flex-col items-center p-4">
    <!-- Breadcrumb -->
    <div v-if="props.showControls" class="w-70 mx-auto px-3 sm:px-4">
      <div class="mb-4 flex items-center justify-between gap-3">
        <nav
          aria-label="Breadcrumb"
          class="flex items-center text-xs sm:text-sm text-indigo-200/80"
        >
          <a
            href="#"
            @click.prevent="emit('back-to-play')"
            class="inline-flex items-center gap-1 hover:text-white"
            role="button"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M8 12l-3 3m0 0l3 3m-3-3h14"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>Play</span>
          </a>
          <svg
            class="mx-2 w-4 h-4 opacity-70"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M9 18l6-6-6-6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="text-white truncate max-w-[8rem] sm:max-w-[12rem]">
            Share score
          </span>
        </nav>
      </div>
    </div>

    <div class="w-70 max-w-5xl mx-auto px-3 sm:px-4">
      <!-- External toolbar -->
      <div v-if="props.showControls" class="share-toolbar w-full flex items-center justify-between mb-2 px-1 gap-2">
        <!-- Left side: Desktop download button placed to the left of the card -->
        <div class="flex items-center gap-2">
          <template v-if="isDesktop">
            <button
              type="button"
              :disabled="isCopying || isDownloading || isMobileSharing"
              @click="onDownloadClick"
              title="Download image"
              aria-label="Download image"
              class="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm shadow ring-1 ring-white/20 transition"
            >
              {{ isDownloading ? 'Preparing…' : 'Download' }}
            </button>
          </template>
        </div>

        <!-- Right side: Mobile share or Desktop copy/toast -->
        <div class="flex items-center gap-2">
          <!-- Mobile: Share button + inline toast -->
          <template v-if="!isDesktop">
            <button
              type="button"
              :disabled="isCopying || isDownloading || isMobileSharing"
              @click="onShareClick"
              title="Share"
              aria-label="Share"
              class="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm shadow ring-1 ring-white/20 transition"
            >
              {{ isMobileSharing ? 'Preparing…' : 'Share' }}
            </button>
            <transition name="fade-slide" mode="out-in">
              <div
                v-if="toast.visible"
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-600/90 to-purple-600/90 text-xs text-indigo-50 shadow border border-white/10"
              >
                <span
                  class="inline-flex h-2 w-2 rounded-full"
                  :class="toast.type === 'error' ? 'bg-rose-300' : 'bg-emerald-300'"
                />
                <span class="whitespace-nowrap">{{ toast.message }}</span>
              </div>
            </transition>
          </template>

          <!-- Desktop: Copy on the right (or inline toast when forCopy) -->
          <template v-else>
            <transition name="fade-slide" mode="out-in">
              <div
                v-if="toast.visible && toast.forCopy"
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-600/90 to-purple-600/90 text-xs text-indigo-50 shadow border border-white/10 justify-center w-[164px]"
              >
                <span
                  class="inline-flex h-2 w-2 rounded-full"
                  :class="toast.type === 'error' ? 'bg-rose-300' : 'bg-emerald-300'"
                />
                <span class="whitespace-nowrap">{{ toast.message }}</span>
              </div>
             <button
               v-else
               type="button"
               :disabled="isCopying || isDownloading || isMobileSharing"
               @click="onCopyClick"
               title="Copy image"
               aria-label="Copy image"
               class="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm shadow ring-1 ring-white/20 transition w-[100px] text-center"
             >
               {{ isCopying ? 'Preparing…' : 'Copy' }}
             </button>
           </transition>
         </template>
       </div>
     </div>

      <!-- Center the card, capture only the card area -->
      <div class="flex justify-center">
        <!-- Capture root -->
        <div
          ref="shareRoot"
          class="inline-block w-100 margana-proportions"
          :style="{ '--margana-logo-h-xlarge': 'calc(var(--margana-tile-w-sm) * 2.5)' }"
        >
          <AppCard :title="null">
            <div class="relative">
              <!-- Branding -->
              <h1
                class="text-2xl font-bold text-white text-center drop-shadow -mt-1 mb-2 leading-none"
                aria-label="Margana"
              >
              <span class="inline-flex flex-col items-center">
                <!-- First line: logo + argana -->
                <div class="inline-flex items-center justify-center">
                  <img
                    :src="logoSrc"
                    alt=""
                    aria-hidden="true"
                    role="presentation"
                    class="logo-img align-middle select-none"
                    style="height: var(--margana-logo-h-medium); margin-left: calc(var(--margana-navbar-logo-x) * 1.9)"
                    draggable="false"
                    loading="eager"
                    crossorigin="anonymous"
                    decoding="sync"
                  />
                </div>
              </span>
              </h1>

              <div v-if="currentRank" class="absolute -top-3 right-1">
                <div class="inline-flex items-end gap-0.5 text-center">
                  <span class="relative text-sm -top-3 font-extrabold bg-clip-text text-transparent bg-gradient-to-tr from-purple-500 to-orange-500 tracking-tight">#</span>
                  <span class="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-tr from-purple-500 to-orange-500 tabular-nums tracking-tight">{{ currentRank }}</span>
                </div>
              </div>

              <!-- Header -->
              <div
                class="w-full flex flex-col items-center justify-center mt-1 mb-4">

                <div
                  class="mt-2 text-5xl sm:text-6xl md:text-7xl font-extrabold bg-clip-text text-transparent bg-gradient-to-tr from-purple-500 to-orange-500 select-none"
                >
                  {{ finalScore }}
                </div>
              </div>

              <!-- Stats -->
              <div
                class="w-full mt-1 mb-4 flex items-center justify-center self-center"
              >
                <div
                  class="w-44 max-w-[520px] flex flex-col gap-1 self-center min-w-0"
                >
                  <div
                    v-if="anagramTarget > 0"
                    class="score-row w-full px-3 py-2 rounded-xl bg-gradient-to-tr from-purple-600 to-orange-600 text-white text-xs sm:text-sm md:text-sm shadow flex items-center justify-between"
                  >
                    <span class="font-semibold">Anagram</span>
                    <span class="font-semibold tabular-nums">
                      {{ anagramScoreTotal }}
                    </span>
                  </div>

                  <div
                    class="score-row w-full px-3 py-2 rounded-xl bg-gradient-to-tr text-white text-xs sm:text-sm md:text-sm shadow flex items-center justify-between from-purple-500 to-fuchsia-600"
                  >
                    <span class="font-semibold">Diagonals</span>
                    <span class="font-semibold tabular-nums">
                      {{ diagTotalScore }}
                    </span>
                  </div>

                  <div
                    class="score-row w-full px-3 py-2 rounded-xl bg-gradient-to-tr text-white text-xs sm:text-sm md:text-sm shadow flex items-center justify-between from-indigo-500 to-violet-600"
                  >
                    <span class="font-semibold">Horizontal</span>
                    <span class="font-semibold tabular-nums">
                      {{ rowTotalScore }}
                    </span>
                  </div>

                  <div
                    class="score-row w-full px-3 py-2 rounded-xl bg-gradient-to-tr text-white text-xs sm:text-sm md:text-sm shadow flex items-center justify-between from-fuchsia-600 via-pink-600 to-violet-700 shadow-lg shadow-fuchsia-500/30"
                  >
                    <span class="font-semibold">Palindrome</span>
                    <span class="font-semibold tabular-nums">
                      {{ palTotalScore }}
                    </span>
                  </div>

                  <div
                    class="score-row w-full px-3 py-2 rounded-xl bg-gradient-to-tr text-white text-xs sm:text-sm md:text-sm shadow flex items-center justify-between from-amber-500 via-orange-500 to-rose-500 shadow-lg shadow-amber-500/30"
                  >
                    <span class="font-semibold">Semordnilap</span>
                    <span class="font-semibold tabular-nums">
                      {{ semTotalScore }}
                    </span>
                  </div>

                  <div v-if="madnessItem"
                    class="score-row w-full px-3 py-2 rounded-xl text-white text-xs sm:text-sm md:text-sm shadow flex items-center justify-between
                    bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)]">
                    <span class="font-semibold">Madness</span>
                    <span class="font-semibold">
                      {{ madnessScore }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="w-full mt-4 text-sm text-indigo-100/90">
                <div
                  class="mt-1 text-center text-sm text-indigo-200/80 select-none font-semibold"
                >
                  www.margana.co.uk
                </div>
                <div
                    class="mt-1 text-center text-[10px] text-indigo-200/80 select-none font-semibold"
                    v-if="dateLabel">
                  {{ dateLabel }}
                </div>
              </div>
            </div>
          </AppCard>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.logo-img {
  image-rendering: -webkit-crisp-edges;
  image-rendering: crisp-edges;
  image-rendering: high-quality;
}

/* Capture appearance */
:deep(.share-capture .app-card) {
  background-color: #111827 !important;
  background-image: linear-gradient(
    to bottom right,
    #111827 0%,
    #581c87 35%,
    #581c87 80%,
    #1e3a8a 100%
  ) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border-color: rgba(255, 255, 255, 0.1) !important;

  border-radius: 0.5rem !important;
  overflow: hidden !important;

  -webkit-font-smoothing: antialiased !important;
  -moz-osx-font-smoothing: grayscale !important;
}

/* Freeze animations during capture */
:deep(.share-capture),
:deep(.share-capture *) {
  animation: none !important;
  transition: none !important;
}

/* Hide toolbar while capturing */
:deep(.share-capture .share-toolbar) {
  display: none !important;
}

/* Gradient text reliability */
:deep(.share-capture .bg-clip-text) {
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
}

/* During capture, remove glow shadows from score rows to avoid color bleeding */
:deep(.share-capture .score-row) {
  box-shadow: none !important;
}

/* Toast transition */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(2px);
}

.inline-block {
}
</style>
