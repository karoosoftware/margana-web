<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fetchAuthSession } from 'aws-amplify/auth'
import { API } from '@/config/api'
import AppCard from '@/components/AppCard.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import { useUserSettings } from '@/composables/useUserSettings'
import { useMarganaAuth, UserTier } from '@/composables/useMarganaAuth'
import { ActivityTracker } from '@/usage/ActivityTracker'
import AccountDeletedOverlay from '@/components/overlays/AccountDeletedOverlay.vue'
import UsernameForm from '@/components/auth/UsernameForm.vue'
import { cache, CacheType } from '@/utils/cache'

const router = useRouter()
const { logout, deleteAccount, userLabel, userEmail, userTier, initialized, username: globalUsername } = useMarganaAuth()

const isConfirmingDelete = ref(false)
const deleteConfirmationEmail = ref('')
const showDeletedOverlay = ref(false)
const error = ref('')

// User settings store (persists to backend + localStorage)
const {
  enableWildcardBypass,
  enableLiveScoring,
  showPulseLabels,
  showAnagramPopup,
  showTutorialButton,
  loading,
  updateBusy,
  updateBusyKey,
  loadSettings,
} = useUserSettings()

onMounted(() => {
  // Initialize non-auth UI state if any
})

const originalUsername = ref(globalUsername.value || '')
const isEditingUsername = ref(!globalUsername.value)

function onUsernameSuccess(newUsername) {
  originalUsername.value = newUsername
  isEditingUsername.value = false
}

async function loadProfile() {
  if (userTier.value < UserTier.REGISTERED) return

  const cached = cache.get('user_profile', CacheType.Persisted)
  if (cached) {
    const username = cached.username || ''
    originalUsername.value = username
    if (username) {
      isEditingUsername.value = false
    }
    return
  }

  try {
    const session = await fetchAuthSession()
    const idToken = session?.tokens?.idToken?.toString()
    if (!idToken) return

    const res = await fetch(API.PROFILE, {
      headers: { Authorization: `Bearer ${idToken}` }
    })
    if (res.ok) {
      const data = await res.json()
      const profile = data.profile || {}
      const username = profile.username || ''
      originalUsername.value = username
      if (username) {
        isEditingUsername.value = false
      }
      cache.set('user_profile', profile, 1800, CacheType.Persisted) // 30 mins
    }
  } catch (err) {
    error.value = 'Failed to load profile'
    console.error('Failed to load profile', err)
  }
}

// SOP: Wait for initialization and react to tier changes
watch(initialized, (isInit) => {
  if (isInit) {
    if (globalUsername.value) {
      originalUsername.value = globalUsername.value
      isEditingUsername.value = false
    }
    loadSettings()
    loadProfile()
  }
}, { immediate: true })

watch(globalUsername, (newVal) => {
  if (newVal && !originalUsername.value) {
    originalUsername.value = newVal
    isEditingUsername.value = false
  }
})

watch(userTier, (newTier, oldTier) => {
  if (initialized.value && newTier !== oldTier) {
    loadSettings()
    if (newTier >= UserTier.REGISTERED) loadProfile()
  }
})

// Granular disabled states so toggling one switch doesn't visually disable the other
const isGuest = computed(() => userTier.value === UserTier.GUEST)
const authReady = computed(() => initialized.value && (userTier.value === UserTier.GUEST || !!userEmail.value))
const isBusy = computed(() => !!loading.value || !!updateBusy.value)
const disableWildcard = computed(() => !!loading.value || isGuest.value || (!!updateBusy.value && updateBusyKey.value === 'enable_wildcard_bypass'))
const disableLiveScoring = computed(() => !!loading.value || isGuest.value || (!!updateBusy.value && updateBusyKey.value === 'enable_live_scoring'))
const disablePulseLabels = computed(() => !!loading.value || isGuest.value || (!!updateBusy.value && updateBusyKey.value === 'show_pulse_labels'))
const disableAnagramPopup = computed(() => !!loading.value || isGuest.value || (!!updateBusy.value && updateBusyKey.value === 'show_anagram_popup'))
const disableTutorialButton = computed(() => !!loading.value || isGuest.value || (!!updateBusy.value && updateBusyKey.value === 'show_tutorial_button'))

function goBack() {
  try { router.back() } catch (_) { router.push({ name: 'margana' }) }
}

// Local state for inline info rows (accordion style)
const showWildcardInfo = ref(false)
const showLiveScoring = ref(false)
const showCelebrations = ref(false)
const showAnaCelebration = ref(false)
const showTutorialInfo = ref(false)

function toggleWildcardInfo() {
  showWildcardInfo.value = !showWildcardInfo.value
  if (showWildcardInfo.value) {
    showLiveScoring.value = false
    showCelebrations.value = false
    showTutorialInfo.value = false
  }
}

function toggleLiveScoring() {
  showLiveScoring.value = !showLiveScoring.value
  if (showLiveScoring.value) {
    showWildcardInfo.value = false
    showCelebrations.value = false
    showTutorialInfo.value = false
  }
}

function toggleShowCelebrations() {
  showCelebrations.value = !showCelebrations.value
  if (showCelebrations.value) {
    showWildcardInfo.value = false
    showLiveScoring.value = false
    showTutorialInfo.value = false
  }
}

function toggleShowAnaCelebration() {
  showAnaCelebration.value = !showAnaCelebration.value
  if (showAnaCelebration.value) {
    showWildcardInfo.value = false
    showLiveScoring.value = false
    showCelebrations.value = false
    showTutorialInfo.value = false
  }
}

function toggleTutorialInfo() {
  showTutorialInfo.value = !showTutorialInfo.value
  if (showTutorialInfo.value) {
    showWildcardInfo.value = false
    showLiveScoring.value = false
    showCelebrations.value = false
    showAnaCelebration.value = false
  }
}

const loggingOut = ref(false)
const deletingAccount = ref(false)
async function handleLogout() {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    ActivityTracker.record('logout', { reason: 'user_settings_action' })
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

async function handleDeleteAccount() {
  if (deleteConfirmationEmail.value !== userEmail.value) return
  if (deletingAccount.value) return
  deletingAccount.value = true

  try {
    ActivityTracker.record('delete_account_confirm')
    await deleteAccount()
    ActivityTracker.setUser(undefined)
    showDeletedOverlay.value = true
  } catch (err) {
    console.error('Delete account failed', err)
  } finally {
    deletingAccount.value = false
  }
}

function handleOverlayClose() {
  showDeletedOverlay.value = false
  router.replace({ name: 'landing' })
}

function signup() {
  ActivityTracker.record('landing_signup_guest_played')
  router.push({name: 'login', query: {signup: 'true'}})
}

function login() {
  ActivityTracker.record('landing_login')
  router.push({name: 'login'})
}
</script>

<template>
  <div class="relative flex-1 flex flex-col items-center p-3 sm:p-4">
    <div class="w-auto sm:min-w-xl max-w-xl mx-auto px-0 sm:px-4">
      <div v-if="error" class="text-red-300 text-sm">{{ error }}</div>

      <div v-else-if="loading || !authReady" class="flex flex-col items-center mt-12 space-y-6">
        <div class="dots-loader" role="img" aria-label="Loading">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>

      <div v-else>
        <h1 class="text-2xl sm:text-3xl font-bold text-white mb-6 drop-shadow text-center">Settings</h1>
        <AppCard :title="'Profile'">
          <div class="text-white/90 space-y-4">

          <!-- Settings toggles -->
          <div class="mt-3">

            <!-- Enable wildcard bypass ('*' to skip a row) -->
            <div class="flex items-center justify-between gap-3 p-3">
              <div class="min-w-0 flex items-center gap-2">
                <div 
                  class="font-semibold text-sm sm:text-sm text-white truncate transition-opacity duration-200"
                  :class="{ 'opacity-30': !enableWildcardBypass }"
                >
                  Allow wildcard bypass (*)
                </div>
                <!-- Info button -->
                <button
                  type="button"
                  class="flex-none h-6 w-6 rounded-full hover:bg-white/20 text-indigo-100 text-base sm:text-sm md:text-base font-bold grid place-items-center border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  aria-label="More information about wildcard bypass"
                  :aria-expanded="showWildcardInfo ? 'true' : 'false'"
                  :aria-controls="'wild-desc'"
                  @click.stop="toggleWildcardInfo"
                >?
                </button>
              </div>
              <div class="self-center">
                <ToggleSwitch
                  v-model="enableWildcardBypass"
                  aria-label="Enable wildcard bypass"
                  size="sm"
                  off-label="Off"
                  on-label="On"
                  :disabled="disableWildcard"
                />
              </div>

            </div>
            <!-- Inline description row: Wildcard bypass -->
            <div v-show="showWildcardInfo" id="wild-desc" class="p-3 text-base sm:text-sm md:text-base text-indigo-100/90">
              If you cannot think of a word, enable this feature to be able to press * so that you can submit the game
            </div>

            <!-- Enable live scoring -->
            <div class="flex items-center justify-between gap-3 p-3">
              <div class="min-w-0 flex items-center gap-2">
                <div 
                  class="font-semibold text-sm sm:text-sm text-white truncate transition-opacity duration-200"
                  :class="{ 'opacity-50': !enableLiveScoring }"
                >
                  Enable live scoring
                </div>
                <!-- Info button -->
                <button
                  type="button"
                  class="flex-none h-6 w-6 rounded-full hover:bg-white/20 text-indigo-100 text-base sm:text-sm md:text-base font-bold grid place-items-center border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  aria-label="More information about wildcard bypass"
                  :aria-expanded="showLiveScoring ? 'true' : 'false'"
                  :aria-controls="'wild-desc'"
                  @click.stop="toggleLiveScoring"
                >?
                </button>
              </div>
              <div class="self-center">
                <ToggleSwitch
                  v-model="enableLiveScoring"
                  aria-label="Enable Live scoring"
                  size="sm"
                  off-label="Off"
                  on-label="On"
                  :disabled="disableLiveScoring"
                />
              </div>
            </div>
            <!-- Inline description row: Live scoring-->
            <div v-show="showLiveScoring" id="wild-desc" class="p-3 text-base sm:text-sm md:text-base text-indigo-100/90">
              Watch your live score change by enabling this feature
            </div>

            <!-- Show pulse labels on grid -->
            <div class="flex items-center justify-between gap-3 p-3">
              <div class="min-w-0 flex items-center gap-2">
                <div 
                  class="font-semibold text-sm sm:text-sm text-white truncate transition-opacity duration-200"
                  :class="{ 'opacity-50': !showPulseLabels }"
                >
                  Show celebration pop-up
                </div>
                <!-- Info button -->
                <button
                  type="button"
                  class="flex-none h-6 w-6 rounded-full hover:bg-white/20 text-indigo-100 text-base sm:text-sm md:text-base font-bold grid place-items-center border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  aria-label="More information about wildcard bypass"
                  :aria-expanded="showCelebrations ? 'true' : 'false'"
                  :aria-controls="'wild-desc'"
                  @click.stop="toggleShowCelebrations"
                >?
                </button>
              </div>
              <div class="self-center">
                <ToggleSwitch
                  v-model="showPulseLabels"
                  aria-label="Show pulse labels on the grid"
                  size="sm"
                  off-label="Off"
                  on-label="On"
                  :disabled="disablePulseLabels"
                />
              </div>
            </div>
            <!-- Inline description row: Live scoring-->
            <div v-show="showCelebrations" id="wild-desc" class="p-3 text-base sm:text-sm md:text-base text-indigo-100/90">
              See celebration scores for palindromes, semordnilaps, diagonal words and Margana madness by enabling this feature
            </div>

            <!-- Show anagram popup/banner -->
            <div class="flex items-center justify-between gap-3 p-3">
              <div class="min-w-0 flex items-center gap-2">
                <div 
                  class="font-semibold text-sm sm:text-sm text-white truncate transition-opacity duration-200"
                  :class="{ 'opacity-50': !showAnagramPopup }"
                >
                  Show anagram pop-up
                </div>
                <!-- Info button -->
                 <button
                   type="button"
                   class="flex-none h-6 w-6 rounded-full hover:bg-white/20 text-indigo-100 text-base sm:text-sm md:text-base font-bold grid place-items-center border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                   aria-label="More information about anagram popup"
                   :aria-expanded="showAnaCelebration ? 'true' : 'false'"
                   :aria-controls="'ana-desc'"
                   @click.stop="toggleShowAnaCelebration"
                 >?
                 </button>
              </div>
              <div class="self-center">
                <ToggleSwitch
                  v-model="showAnagramPopup"
                  aria-label="Show anagram popup/banner"
                  size="sm"
                  off-label="Off"
                  on-label="On"
                  :disabled="disableAnagramPopup"
                />
              </div>
            </div>
            <!-- Inline description row: Anagram popup -->
            <div v-show="showAnaCelebration" id="ana-desc" class="p-3 text-base sm:text-sm md:text-base text-indigo-100/90">
              See celebration score for your anagram when you press verify by enabling this feature
            </div>
          </div>

          <!-- Account Section -->
          <div v-if="userTier >= UserTier.REGISTERED" class="mt-6 pt-2 border-t border-white/10">
            <!-- Preferred Username -->
            <div class="mt-4 space-y-3">
              <!-- Display Mode -->
              <div v-if="!isEditingUsername && originalUsername" class="flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <div class="text-white font-medium truncate">Username</div>
                  <div class="text-indigo-200/60 text-sm truncate">{{ originalUsername }}</div>
                </div>
                <button
                  @click="isEditingUsername = true"
                  class="btn-common-button btn-common-button-icon self-center w-23"
                >
                  Change
                </button>
              </div>

              <!-- Edit Mode -->
              <div v-else class="space-y-3">
                <UsernameForm 
                  :initial-username="originalUsername" 
                  :is-edit="true"
                  @success="onUsernameSuccess"
                  @cancel="isEditingUsername = false"
                />
              </div>
            </div>

            <div class="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div class="min-w-0">
                <div class="text-white font-medium truncate">{{ userLabel }}</div>
                <div class="text-indigo-200/60 text-sm truncate">{{ userEmail }}</div>
              </div>
              <div v-if="loggingOut" class="flex items-center justify-center self-center">
                <span class="dots-loader" role="img" aria-label="Logging out">
                  <span class="dot"></span>
                  <span class="dot"></span>
                  <span class="dot"></span>
                </span>
              </div>
              <button
                v-else
                @click="handleLogout"
                :disabled="loggingOut"
                class="btn-common-button btn-common-button-icon self-center w-auto"
              >
                <span>Log out</span>
              </button>
            </div>

            <div class="mt-8 border-t border-white/10"></div>

            <div class="mt-6 pt-2">
              <div class="p-2">
                <div v-if="!isConfirmingDelete" class="space-y-4">
                  <div class="text-white text-sm">
                    <span class="block">If you no longer wish to play,</span>
                    <button
                      @click="isConfirmingDelete = true"
                      class="mt-1 text-sm font-semibold text-white/90 hover:text-white hover:font-bold transition"
                    >
                      click here to delete your account
                    </button>
                  </div>
                </div>

                <!-- Inline Confirmation Flow -->
                <div v-else class="space-y-4">
                  <div class="flex items-center justify-center gap-4 py-1">
                    <div class="w-[2.625rem] h-[2.625rem] shrink-0 flex items-center justify-center bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] [clip-path:polygon(50%_6.699%,100%_93.301%,0%_93.301%)]" aria-hidden="true">
                      <span class="text-white font-black text-2xl mt-2.5">!</span>
                    </div>
                    <div class="text-white font-semibold text-sm text-center max-w-[350px]">
                      <p>This action is permanent</p><br>
                      <p class="text-white/70 text-xs text-center max-w-[350px]">
                        Once you delete your account, all your performance statistics and settings will be permanently removed
                      </p><br>
                      <p class="text-xs text-white/70">Please type your email address to confirm deletion</p>
                    </div>
                    <div class="w-[2.625rem] h-[2.625rem] shrink-0 flex items-center justify-center bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] [clip-path:polygon(50%_6.699%,100%_93.301%,0%_93.301%)]" aria-hidden="true">
                      <span class="text-white font-black text-2xl mt-2.5">!</span>
                    </div>
                  </div>
                  <input
                    v-model="deleteConfirmationEmail"
                    type="email"
                    placeholder="Enter your email"
                    class="form-input"
                  />
                  <div class="flex items-center gap-3 flex-nowrap justify-between">
                    <div v-if="deletingAccount" class="flex items-center" role="img" aria-label="Deleting account">
                      <span class="dots-loader">
                        <span class="dot"></span>
                        <span class="dot"></span>
                        <span class="dot"></span>
                      </span>
                    </div>
                    <button
                      v-else
                      @click="handleDeleteAccount"
                      :disabled="deleteConfirmationEmail !== userEmail"
                      class="btn-common-button shrink-0"
                    >
                      Confirm
                    </button>
                    <button
                      @click="isConfirmingDelete = false; deleteConfirmationEmail = ''"
                      class="btn-common-button shrink-0 ml-auto"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Guest Call to Action -->
          <div v-else class="mt-8 pt-6 border-t border-white/10">
            <h3 class="text-sm font-semibold text-white mb-4">Account</h3>
            <div class="bg-gradient-to-br from-purple-600/20 to-indigo-600/20 rounded-xl p-5 border border-white/10">
              <p class="text-indigo-100/90 text-sm mb-4 leading-relaxed">
                Create a free account to unlock more performance statistics - including streak history, your scoring trends and how you rank
                against other players
              </p>
              <div class="flex flex-col gap-3 items-center justify-center ">
                <button
                  @click="signup"
                  class="btn-common-button"
                >
                  Create account
                </button>
                <button
                  @click="login"
                  class="text-indigo-200 hover:text-white text-sm font-medium transition-colors"
                >
                  Already have an account? Log in
                </button>
              </div>
            </div>
            </div>
          </div>
        </AppCard>
      </div>
    </div>

    <!-- Account Deleted Overlay -->
    <AccountDeletedOverlay 
      :show="showDeletedOverlay" 
      @close="handleOverlayClose" 
    />
  </div>
</template>

<style scoped>
</style>
