<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavBar from './components/NavBar.vue'
import ActivityBeacon from './components/ActivityBeacon.vue'
import marganaMLogo from '@/assets/margana_m_logo.svg'
import { useMarganaAuth, UserTier } from './composables/useMarganaAuth'
import { useTutorial } from './composables/useTutorial'
import { useOrientation } from './composables/useOrientation'

const route = useRoute()
const router = useRouter()
const { canAccess, userLabel, userTier, fetchUser, initialized } = useMarganaAuth()
const { isTutorialActive } = useTutorial()
const { landscapeMobileMode } = useOrientation()

// Eagerly fetch user identity to minimize splash screen time
if (!initialized.value) {
  fetchUser()
}

watch(isTutorialActive, (val) => {
  if (val && route.name === 'margana') {
    document.body.classList.add('tutorial-active')
  } else {
    document.body.classList.remove('tutorial-active')
  }
}, { immediate: true })

const showNav = computed(() => {
  if (!initialized.value) return false
  if (isTutorialActive.value && route.name === 'margana') return false
  const metaAllow = !route.matched.some(r => r.meta?.hideNav)
  // We want the new header/nav to be visible more broadly if it contains guest controls
  return metaAllow && (canAccess(UserTier.GUEST) || canAccess(UserTier.REGISTERED))
})

function handleShowTutorial() {
  router.push('/tutorial')
}

// Minimal hard block for older iPadOS/iOS Safari (visual issues on 15.x)
const blockUnsupported = ref(false)

function isUnsupportedMobileSafari() {
  try {
    const ua = navigator.userAgent || ''
    // iOS/iPadOS detection, including iPadOS desktop-mode where UA looks like macOS
    const isIOSLike = /(iPad|iPhone|iPod)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    // Mobile Safari (exclude Chromium-based UA tokens)
    const isSafari = /Safari\//.test(ua) && !/Chrome|CriOS|Edg\//.test(ua)
    // Safari version token (e.g., Version/15.6)
    const m = ua.match(/Version\/(\d+)/)
    const safariMajor = m ? parseInt(m[1], 10) : NaN
    if (isIOSLike && isSafari && Number.isFinite(safariMajor) && safariMajor < 16) return true
  } catch (_) { /* ignore */ }
  return false
}

onMounted(() => {
  try {
    blockUnsupported.value = isUnsupportedMobileSafari()
  } catch (_) { /* ignore */ }
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 flex flex-col">
    <!-- Global usage tracker (invisible) -->
    <ActivityBeacon />

    <NavBar v-if="showNav" @show-tutorial="handleShowTutorial" />

    <main class="flex-1 flex flex-col">
      <template v-if="initialized">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </template>
      <div v-else class="flex-1 flex flex-col items-center justify-center">
        <div class="flex flex-col items-center gap-4 animate-pulse">
          <img :src="marganaMLogo" class="h-16 w-auto opacity-50" alt="Margana" />
          <span class="text-indigo-200 font-medium tracking-wide">Initializing Margana...</span>
        </div>
      </div>
    </main>

    <footer v-if="initialized" class="w-full border-t border-white/10 bg-white/5 backdrop-blur margana-footer-text text-indigo-100/80">
      <div class="max-w-5xl mx-auto px-4 margana-footer-inner flex flex-col items-center gap-1">
        <p>
          © 2026 Karoo Software Ltd. All rights reserved
        </p>
        <p>
          MARGANA® is a trademark of Karoo Software Ltd
        </p>
        <p>
          Contact: <a href="mailto:support@margana.co.uk" class="underline hover:text-white">support@margana.co.uk</a>
        </p>
        <p>
          <a href="/terms.html" class="underline hover:text-white">Terms</a>
          <span class="mx-2 text-white/40"> </span>
          <a href="/privacy.html" class="underline hover:text-white">Privacy</a>
          <span class="mx-2 text-white/40"> </span>
          <a href="/licences.html" class="underline hover:text-white">Licences</a>
          <span class="mx-2 text-white/40"> </span>
          <a href="/how-to-play.html" class="underline hover:text-white">How to play</a>
        </p>
      </div>
    </footer>

    <!-- Hard block overlay for unsupported iPadOS/iOS Safari versions -->
    <div v-if="blockUnsupported" class="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70"></div>
      <div role="dialog" aria-modal="true" aria-labelledby="unsupported-title"
           class="relative max-w-md w-full rounded-xl bg-white/10 backdrop-blur border border-white/10 text-white shadow-xl p-5">
        <h2 id="unsupported-title" class="text-lg font-semibold">Limited browser support</h2>
        <p class="mt-2 text-white/90">
          You are using an older version of Safari on iPadOS. Visual features in Margana may not render correctly here.
          Please update iPadOS to continue.
        </p>
        <p class="mt-3 text-sm text-white/70">Supported: iPadOS/iOS Safari 16 or later.</p>
      </div>
    </div>
  </div>
</template>

<style>
/* Hide the global footer during Margana's mobile landscape immersive mode */
body.landscape-immersive footer {
  display: none !important;
}

body.tutorial-active {
  overflow: hidden;
  overscroll-behavior: none;
}
</style>
