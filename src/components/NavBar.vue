<script setup>
import marganaLogoFull from '@/assets/margana_full_logo.svg'
import {
  ChartBarIcon,
  TrophyIcon,
  Cog6ToothIcon,
  CalendarIcon,
  PlayIcon,
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  UserPlusIcon
} from '@heroicons/vue/20/solid'
import { useRouter, useRoute } from 'vue-router'
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useMarganaAuth, UserTier } from '@/composables/useMarganaAuth'
import { ActivityTracker } from '@/usage/ActivityTracker'


const props = defineProps({
  showHelpControls: { type: Boolean, default: true }
})

const emit = defineEmits(['show-tutorial', 'show-letter-scores'])

const router = useRouter()
const route = useRoute()
const { userLabel, userEmail, userTier, logout } = useMarganaAuth()

const mobileMenuOpen = ref(false)
const profileMenuOpen = ref(false)
const menuRef = ref(null)
const profileMenuRef = ref(null)

let navReadyTimeout = null

function handleClickOutside(event) {
  if (menuRef.value && !menuRef.value.contains(event.target)) {
    mobileMenuOpen.value = false
  }
  if (profileMenuRef.value && !profileMenuRef.value.contains(event.target)) {
    profileMenuOpen.value = false
  }
}

// Watch for route changes to temporarily disable transitions.
// This prevents "flying" elements when navigating between pages with different header layouts.
// We use a 2s delay to ensure async puzzle data (which triggers Madness mode) has settled.
watch(() => route.fullPath, () => {
  if (navReadyTimeout) clearTimeout(navReadyTimeout)
  document.body.classList.remove('nav-ready')
  navReadyTimeout = setTimeout(() => {
    document.body.classList.add('nav-ready')
    navReadyTimeout = null
  }, 2000)
}, { immediate: true })

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  if (navReadyTimeout) clearTimeout(navReadyTimeout)
  document.removeEventListener('click', handleClickOutside)
  document.body.classList.remove('nav-ready')
})

// function goToYesterday() {
//   router.push({ name: 'yesterday' })
// }

function goToYesterdayFromMenu() {
  mobileMenuOpen.value = false
  goToYesterday()
}

function goToMargana() {
  if (route.name === 'margana') {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('margana-nav-play'))
      }
    } catch (_) {}
    return
  }
  router.push({ name: 'margana' })
}

function goToMarganaFromMenu() {
  mobileMenuOpen.value = false
  goToMargana()
}

function goToSettings() {
  router.push({ name: 'settings' })
}

function goToSettingsFromMenu() {
  mobileMenuOpen.value = false
  goToSettings()
}

// Stats and Leaderboards placeholders for now as routes aren't explicitly clear
function goToStats() {
  router.push({ name: 'metric' })
}
function goToStatsFromMenu() {
  mobileMenuOpen.value = false
  goToStats()
}
function goToLeaderboards() {
  router.push({ name: 'leaderboards' })
}
function goToLeaderboardsFromMenu() {
  mobileMenuOpen.value = false
  goToLeaderboards()
}

function goToLoginFromMenu() {
  mobileMenuOpen.value = false
  router.push({ name: 'login' })
}

function goToSignupFromMenu() {
  mobileMenuOpen.value = false
  router.push({ name: 'login', query: { signup: '1' } })
}

const loggingOut = ref(false)
async function handleLogout() {
  if (loggingOut.value) return
  loggingOut.value = true
  profileMenuOpen.value = false
  mobileMenuOpen.value = false
  try {
    ActivityTracker.record('logout', { reason: 'user_action' })
    await ActivityTracker.flush('logout')
  } catch (_) {}
  try {
    await logout()
    ActivityTracker.setUser(undefined)
  } catch (_) {}
  finally {
    loggingOut.value = false
    router.replace({ name: 'landing' })
  }
}
</script>

<template>
  <nav class="margana-navbar w-full flex flex-col items-center pt-2 px-2 relative z-40 pointer-events-none margana-proportions">
    <div class="w-full max-w-5xl flex flex-col items-center pointer-events-none">
      <!-- Header row: [spacer | logo | controls] -->
      <div class="margana-navbar-row w-full grid grid-cols-[1fr_auto_1fr] items-start min-h-[4rem] sm:min-h-[5rem] relative pointer-events-none">
        <!-- Left spacer -->
        <div />

        <!-- Center: Logo area with Portal -->
        <div class="navbar-logo-area flex items-center justify-center pointer-events-none">
          <!-- Portal for Special Banners (Madness, Christmas, etc.) -->
          <div id="navbar-special-area" class="pointer-events-none"></div>

          <img
              :src="marganaLogoFull"
              alt="Margana"
              class="navbar-logo-img w-auto max-w-none object-contain select-none pointer-events-none"
          />
        </div>


        <!-- Right: Controls -->
        <div ref="menuRef" class="hamburger-container relative flex justify-start overflow-visible pointer-events-none">
        <template v-if="showHelpControls">
            <!-- Hamburger menu (Mobile & Desktop) -->
            <div class="hamburger-menu relative translate-y-2 sm:translate-y-4 pointer-events-auto">
              <button
                  @click.stop="mobileMenuOpen = !mobileMenuOpen"
                  class="hamburger-trigger flex items-center justify-center
                       rounded-full
                       bg-white/10 ring-1 ring-white/20 shadow-sm
                       text-white/80 hover:text-white hover:bg-white/20
                       active:scale-95 transition"
              >
                <Bars3Icon v-if="!mobileMenuOpen" />
                <XMarkIcon v-else />
              </button>

              <div
                  v-if="mobileMenuOpen"
                  class="absolute right-0 sm:right-0 top-12 z-50
                 w-48 py-2 rounded-xl
                 bg-gradient-to-br from-gray-700 via-purple-900 to-indigo-900
                 shadow-2xl ring-1 ring-white/10 pointer-events-auto"
              >
                <button
                    v-if="userTier >= UserTier.GUEST"
                    @click="goToMarganaFromMenu"
                    class="w-full px-4 py-2.5 flex items-center gap-3 text-indigo-100 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <PlayIcon class="w-5 h-5" />
                  <span class="font-medium">Play</span>
                </button>

                <button
                    v-if="userTier >= UserTier.GUEST"
                    @click="goToStatsFromMenu"
                    class="w-full px-4 py-2.5 flex items-center gap-3 text-indigo-100 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ChartBarIcon class="w-5 h-5" />
                  <span class="font-medium">Performance</span>
                </button>

                <button
                    v-if="userTier >= UserTier.REGISTERED"
                    @click="goToLeaderboardsFromMenu"
                    class="w-full px-4 py-2.5 flex items-center gap-3 text-indigo-100 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <TrophyIcon class="w-5 h-5" />
                  <span class="font-medium">Leaderboards</span>
                </button>

                <button
                    v-if="userTier >= UserTier.GUEST"
                    @click="goToSettingsFromMenu"
                    class="w-full px-4 py-2.5 flex items-center gap-3 text-indigo-100 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Cog6ToothIcon class="w-5 h-5" />
                  <span class="font-medium">Settings</span>
                </button>

                <!-- Logged in as -->
                <div class="mt-2 pt-2 border-t border-white/10 px-4">
                  <div class="text-[10px] tracking-wider text-indigo-300/60 font-bold mb-0.5">Logged in as</div>
                  <div class="text-sm text-white font-medium truncate">
                    {{ userTier >= UserTier.REGISTERED ? userLabel : 'Guest' }}
                  </div>
                </div>

                <!-- Account Actions -->
                <div class="mt-2 pt-2 border-t border-white/5 pb-1">
                  <template v-if="userTier < UserTier.REGISTERED">
                    <button
                        @click="goToLoginFromMenu"
                        class="w-full px-4 py-2.5 flex items-center gap-3 text-indigo-100 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <ArrowLeftOnRectangleIcon class="w-5 h-5" />
                      <span class="font-medium">Login</span>
                    </button>
                    <button
                        @click="goToSignupFromMenu"
                        class="w-full px-4 py-2.5 flex items-center gap-3 text-indigo-100 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <UserPlusIcon class="w-5 h-5" />
                      <span class="font-medium">Create account</span>
                    </button>
                  </template>
                  <template v-else>
                    <button
                        @click="handleLogout"
                        class="w-full px-4 py-2.5 flex items-center gap-3 text-indigo-100 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <ArrowRightOnRectangleIcon class="w-5 h-5" />
                      <span class="font-medium">Log out</span>
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </nav>
</template>
<style>
/* Hide the navbar when Margana page activates mobile landscape immersive mode */
body.landscape-immersive .margana-navbar {
  display: none !important;
}

/* Disable transitions for these elements during the initial mounting phase to prevent "flying" elements */
.margana-navbar .navbar-logo-img,
.margana-navbar .hamburger-container,
.margana-navbar .hamburger-menu {
  transition: none !important;
}

/* Re-enable transitions once the page has settled (MadnessBanner has had time to add its class) */
body.nav-ready .margana-navbar .navbar-logo-img {
  transition: opacity 0.4s ease-in-out !important;
}

body.nav-ready .margana-navbar .hamburger-container,
body.nav-ready .margana-navbar .hamburger-menu {
  transition: all 0.4s ease-in-out !important;
}

/* 
   State: Special Banner Active 
   --------------------------
   When a special banner (like Madness Day) is active, we:
   1. Hide the standard logo.
   2. Remove the asymmetrical offset from the logo area to center the banner perfectly.
   3. Reposition the hamburger to overlap the top-right corner of the banner.
*/

body.has-special-banner .margana-navbar .navbar-logo-img {
  display: none !important;
  opacity: 0;
}

/* 1. Shift the banner to the left by removing the default logo offset */
body.has-special-banner .margana-navbar .navbar-logo-area {
  translate: 0 !important; /* Overrides Tailwind v4 translate-x-5 utilities */
  transform: none !important;
}

body.has-special-banner .margana-navbar .hamburger-container {
  padding-left: 0 !important;
}

/* 2. Shift the hamburger to the left and down to match the banner center */
body.has-special-banner .margana-navbar .hamburger-menu {
  translate: 0 !important; /* Overrides Tailwind v4 translate-y-2 utilities */
  /* Align with the banner box's top-right corner */
  transform: translateY(-50%) !important;
  /* Match banner's vertical center in the row */
  top: 2.2rem;
  left: 0.5rem;
}

@media (min-width: 640px) {
  body.has-special-banner .margana-navbar .hamburger-menu {
    top: 2.2rem;
    left: 0.75rem;
  }
}

@media (min-width: 1024px) {
  body.has-special-banner .margana-navbar .hamburger-menu {
    top: 2.2rem;
    left: 1rem;
  }
}

</style>
