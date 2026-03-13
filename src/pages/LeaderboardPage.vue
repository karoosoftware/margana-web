<script setup>
import { computed, onMounted, watch, ref } from 'vue'
import { useRoute } from 'vue-router'
import { fetchAuthSession } from 'aws-amplify/auth'
import { API } from '@/config/api'
import AppBrand from '@/components/AppBrand.vue'
import AppCard from '@/components/AppCard.vue'
import { useLeaderboard, LeaderboardTab } from '@/composables/useLeaderboard'
import { useMarganaAuth } from '@/composables/useMarganaAuth'
import LeaderboardMy from '@/components/leaderboard/LeaderboardMy.vue'
import LeaderboardPublic from '@/components/leaderboard/LeaderboardPublic.vue'
import LeaderboardManage from '@/components/leaderboard/LeaderboardManage.vue'
import UsernameForm from '@/components/auth/UsernameForm.vue'
import { cache, CacheType } from '@/utils/cache'

const route = useRoute()
const { activeTab, setActiveTab } = useLeaderboard()
const { username } = useMarganaAuth()

const usernameSet = ref(false)
const checkingUsername = ref(true)

async function checkProfile(force = false) {
  if (!force) {
    const cached = cache.get('user_profile', CacheType.Persisted)
    if (cached) {
      username.value = cached.username || ''
      usernameSet.value = !!username.value
      checkingUsername.value = false
      return
    }
  }

  checkingUsername.value = true
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
      const uname = profile.username || ''
      username.value = uname
      usernameSet.value = !!uname
      cache.set('user_profile', profile, 1800, CacheType.Persisted) // 30 mins
    }
  } catch (err) {
    console.error('Failed to check profile', err)
  } finally {
    checkingUsername.value = false
  }
}

onMounted(async () => {
  await checkProfile()
  const tab = route.query.tab
  if (tab && Object.values(LeaderboardTab).includes(tab)) {
    setActiveTab(tab)
  }
})

watch(() => route.query.tab, (newTab) => {
  const tab = newTab
  if (tab && Object.values(LeaderboardTab).includes(tab)) {
    setActiveTab(tab)
  }
})

const currentComponent = computed(() => {
  switch (activeTab.value) {
    case LeaderboardTab.My: return LeaderboardMy
    case LeaderboardTab.Public: return LeaderboardPublic
    case LeaderboardTab.Manage: return LeaderboardManage
    default: return LeaderboardMy
  }
})

const tabs = [
  { id: LeaderboardTab.My, label: 'My' },
  { id: LeaderboardTab.Public, label: 'Join' },
  { id: LeaderboardTab.Manage, label: 'Create' }
]

function onUsernameSuccess() {
  usernameSet.value = true
  setActiveTab(LeaderboardTab.My)
}
</script>

<template>
  <div class="flex flex-col items-center justify-start min-h-full p-4">
    
    <h1 class="text-3xl font-bold text-white mb-8 tracking-tight drop-shadow-md">Leaderboards</h1>

    <div v-if="checkingUsername" class="flex flex-col items-center justify-center p-12 text-white/60">
      <div class="dots-loader mb-4">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    </div>

    <div v-else-if="!usernameSet" class="w-full max-w-lg">
      <AppCard title="Username required">
        <div class="text-white/90 space-y-4 p-2">
          <p class="text-sm leading-relaxed">
            To participate in the leaderboards, please set a unique username in your profile settings
          </p>
          <p class="text-sm leading-relaxed">
            This username will be visible to all other members of the leaderboards you join or create
          </p>
          
          <div class="pt-2">
            <UsernameForm @success="onUsernameSuccess" />
          </div>
        </div>
      </AppCard>
    </div>

    <div v-else class="w-full max-w-lg">
      <!-- Tabs Container -->
      <div class="grid grid-cols-3 items-end gap-1 w-full">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="setActiveTab(tab.id)"
          class="w-full min-w-0 px-2 sm:px-4 py-3 rounded-t-2xl font-bold transition-all duration-200 text-base sm:text-base relative text-center"
          :class="[
            activeTab === tab.id 
              ? 'bg-white/10 backdrop-blur text-white z-10 border-t border-x border-white/10' 
              : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
          ]"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Card Body -->
      <div class="app-card-body bg-white/10 backdrop-blur rounded-b-2xl rounded-t-none shadow-2xl border border-white/10 border-t-0 min-h-[500px] overflow-hidden -mt-[1px]">
        <transition name="tab-fade" mode="out-in">
          <component :is="currentComponent" />
        </transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-card-body {
  box-sizing: border-box;
}

.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
