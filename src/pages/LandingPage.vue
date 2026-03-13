<script setup>
import {onMounted, onBeforeUnmount, ref, computed, watch} from 'vue'
import {useRouter, useRoute} from 'vue-router'
import marganaLogoFull from '@/assets/margana_full_logo.svg'
import GameAttractMode from '@/components/margana/GameAttractMode.vue'
import GuestTermsModal from '@/components/margana/GuestTermsModal.vue'
import {ActivityTracker} from '@/usage/ActivityTracker'
import {useMarganaAuth} from '@/composables/useMarganaAuth'

const router = useRouter()
const route = useRoute()
const {isAuthenticated, needsTermsAcceptance} = useMarganaAuth()

const hasPlayedToday = ref(false)
const attractModeSize = ref('tiny')
const showTerms = ref(false)

const cardStyle = computed(() => {
  // We align the entire card with the 'tiny' (proportion) to keep it consistent.
  // We use the '-global' tokens to avoid circular dependency loops with --margana-tile-w-lg.
  if (attractModeSize.value === 'medium') return {'--margana-tile-w-lg': 'var(--margana-tile-w-md-global)'}
  if (attractModeSize.value === 'small') return {'--margana-tile-w-lg': 'var(--margana-tile-w-sm-global)'}
  if (attractModeSize.value === 'tiny') return {'--margana-tile-w-lg': 'var(--margana-landing-tile-w-xs, var(--margana-tile-w-xs-global))'}
  return {}
})

function getCurrentDateKey() {
  return new Date().toISOString().split('T')[0]
}

const updateSize = () => {
  // Use 'tiny' for the landing page attract mode to keep it compact and proportional.
  attractModeSize.value = 'tiny'
}

onMounted(() => {
  updateSize()
  window.addEventListener('resize', updateSize)

  if (!isAuthenticated.value) {
    const today = getCurrentDateKey()
    const hasResult = !!localStorage.getItem(`margana.result.${today}`)
    if (hasResult) {
      hasPlayedToday.value = true
    }
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateSize)
})

watch(needsTermsAcceptance, (val) => {
  if (showTerms.value && !val) {
    showTerms.value = false
    router.push({name: 'margana'})
  }
})

function play() {
  ActivityTracker.record('landing_play_guest')
  if (needsTermsAcceptance.value) {
    showTerms.value = true
  } else {
    router.push({name: 'margana'})
  }
}

function seeResults() {
  ActivityTracker.record('landing_see_results_guest')
  router.push({name: 'margana'})
}

function login() {
  ActivityTracker.record('landing_login')
  router.push({name: 'login', query: route.query})
}

function signup() {
  ActivityTracker.record('landing_signup_guest_played')
  router.push({name: 'login', query: {...route.query, signup: 'true'}})
}
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center p-4 mt-10">
    <div class="w-full max-w-xs sm:max-w-md md:max-w-md relative">

      <div
          class="w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-xl p-4 sm:p-6 md:p-8 relative z-0 margana-proportions"
          :style="cardStyle">

        <!-- Floating Logo (half in / half out, top-left) -->
        <img
            :src="marganaLogoFull"
            alt="Margana"
            class="absolute top-0 left-0 select-none pointer-events-none z-20"
            style="height: var(--margana-logo-h-nav); transform: translate(calc(var(--margana-navbar-logo-x) * -4), -40%)"
            draggable="false"
        />

        <h1 class="font-bold text-white text-center mt-8 sm:mt-10 text-xl sm:text-2xl">The tactical word game</h1>

        <p v-if="!hasPlayedToday" class="mt-3 sm:mt-4 text-white text-sm sm:text-sm text-center">
          Complete the horizontal word grid.<br>
          Release letters and find the longest anagram and earn bonus points for special words
        </p>

        <!-- Row 1: Text -->
        <p v-else class="text-indigo-100 text-sm text-center max-w-md mt-2">
          You've already played today!<br>Create an account to save your progress
          and unlock more features
        </p>

        <!-- Attract Mode Demo -->
        <div
            class="mt-5 sm:mt-6 mb-2 w-fit mx-auto overflow-hidden rounded-xl border-white/5 bg-black/20 shadow-inner flex justify-center">
          <GameAttractMode size="smaller"/>
        </div>

        <!-- Action Buttons (always one row) -->
        <div v-if="!hasPlayedToday" class="mt-5 sm:mt-6 flex flex-nowrap items-center justify-center gap-3 sm:gap-5">
          <button
              @click="login"
              class="btn-common-button"
          >
            Log in
          </button>

          <button
              @click="play"
              class="btn-teal-yellow"
          >
            Play as guest
          </button>
        </div>


        <div
            v-else
            class="mt-5 sm:mt-6 flex flex-col items-center justify-center gap-4 sm:gap-5"
        >


          <!-- Row 2: Two buttons -->
          <div class="flex flex-row gap-3">
            <button
                @click="seeResults"
                class="w-30 sm:w-30 min-w-0 h-9 sm:h-10 px-2.5 sm:px-3 text-xs sm:text-sm rounded-lg font-semibold text-white
             inline-flex items-center justify-center
             bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)]
             hover:opacity-90 shadow transition-all active:scale-[0.98]"
            >
              See results
            </button>

            <button
                @click="signup"
                class="w-30 sm:w-35 min-w-0 h-9 sm:h-10 px-2.5 sm:px-3 text-xs sm:text-sm rounded-lg font-semibold text-white
           inline-flex items-center justify-center
           bg-gradient-to-tr from-indigo-500 via-purple-600 to-violet-700 hover:from-indigo-400 hover:via-purple-500 hover:to-violet-600
           shadow transition-all active:scale-[0.98]"
            >
              Create account
            </button>
          </div>

          <!-- Row 3: Single button -->
          <button
              @click="login"
              class="text-indigo-200 hover:text-white text-sm font-medium transition-colors"
          >
            Already have an account? Log in
          </button>
        </div>

      </div>
    </div>
    <GuestTermsModal v-if="showTerms" />
  </div>
</template>

<style scoped>
/* Any specific landing page styles */
</style>
