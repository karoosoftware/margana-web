<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import marganaLogo from '@/assets/margana_m_logo.svg'
import { useLeaderboard, type PublicLeaderboard } from '@/composables/useLeaderboard'
import { useMarganaAuth } from '@/composables/useMarganaAuth'
import { MagnifyingGlassIcon, ArrowDownIcon, UserIcon, TrophyIcon, ArrowPathIcon, ChevronRightIcon } from '@heroicons/vue/20/solid'

defineOptions({ name: 'LeaderboardPublic' })

const { 
  publicLeaderboards, 
  loadingPublic, 
  publicError, 
  sortBy, 
  hasMorePublic, 
  fetchPublicLeaderboards,
  joinLeaderboard 
} = useLeaderboard()

const router = useRouter()

// Username may be needed in future flows; keep hook available
const { username } = useMarganaAuth()

const searchQuery = ref('')
const joinLoading = ref<Record<string, boolean>>({})
const joinSuccess = ref<Record<string, string>>({})
const joinError = ref<Record<string, string>>({})
const joinSuccessTimeouts = ref<Record<string, ReturnType<typeof setTimeout>>>({})

onMounted(() => {
  fetchPublicLeaderboards({ reset: true })
})

onBeforeUnmount(() => {
  Object.values(joinSuccessTimeouts.value).forEach(clearTimeout)
})

// Debounced search (frontend-only for now as backend doesn't support it yet, 
// but prepared for future backend support)
let debounceTimeout: any = null
watch(searchQuery, () => {
  clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    // If backend supported search, we would call fetchPublicLeaderboards({ reset: true }) here
    // For now, we'll just let the computed filter handle it or just keep it as is
  }, 500)
})

const handleSortToggle = () => {
  sortBy.value = sortBy.value === 'highest' ? 'entry' : 'highest'
}

const handleJoin = async (board: PublicLeaderboard) => {
  const id = board.id
  joinLoading.value[id] = true
  joinError.value[id] = ''
  
  try {
    const res = await joinLeaderboard(id)
    joinSuccess.value[id] = res.message || (board.auto_approve ? 'Joined!' : 'Request sent!')
    if (joinSuccessTimeouts.value[id]) {
      clearTimeout(joinSuccessTimeouts.value[id])
    }
    joinSuccessTimeouts.value[id] = setTimeout(() => {
      delete joinSuccess.value[id]
      delete joinSuccessTimeouts.value[id]
    }, 5000)
    // Update local role so UI switches to the disabled button state
    board.user_role = board.auto_approve ? 'member' : 'pending'
  } catch (err: any) {
    joinError.value[id] = err.message || 'Failed to join'
  } finally {
    joinLoading.value[id] = false
  }
}

// Frontend filtering for search
const visibleBoards = computed(() => {
  const q = searchQuery.value.toLowerCase()
  const filtered = !searchQuery.value
    ? publicLeaderboards.value
    : publicLeaderboards.value.filter(b => b.name.toLowerCase().includes(q))
  const sorted = [...filtered].sort((a, b) => {
    const aScore = Number(a.average_weekly_score || 0)
    const bScore = Number(b.average_weekly_score || 0)
    return sortBy.value === 'highest' ? bScore - aScore : aScore - bScore
  })
  return sorted
})

const refresh = () => {
  fetchPublicLeaderboards({ reset: true, force: true })
}

const goToLeaderboard = (id: string) => {
  router.push({ name: 'leaderboard-detail', params: { id }, query: { from: 'public' } })
}
</script>

<template>
  <div class="leaderboard-public-container flex flex-col gap-4">
    <!-- Controls: Search and Sort -->
    <div class="flex flex-col sm:flex-row gap-3 items-center px-2 mt-4">
      <div class="relative w-full sm:flex-1">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon class="w-5 h-5 sm:w-4 sm:h-4 text-indigo-300/50" />
        </div>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search leaderboards..."
          class="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white placeholder-indigo-300/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
        />
      </div>
      <div class="flex p-1 rounded self-stretch sm:self-auto gap-1">
        <button 
          @click="refresh"
          class="p-1.5 rounded text-indigo-200/80 hover:text-white transition-all flex items-center justify-center"
          :class="{ 'animate-spin': loadingPublic }"
          title="Refresh"
        >
          <ArrowPathIcon class="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
        <div class="w-px bg-white/10 my-1"></div>
        <button
          @click="handleSortToggle"
          class="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 text-indigo-200/80 hover:text-white"
          :aria-pressed="sortBy === 'entry' ? 'true' : 'false'"
        >
          <ArrowDownIcon class="w-5 h-5 sm:w-4 sm:h-4 transition-transform" :class="{ 'rotate-180': sortBy === 'highest' }" />
          <span>Average weekly score</span>
        </button>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="publicError" class="mx-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex items-center gap-2">
      <span class="flex-1">{{ publicError }}</span>
      <button @click="fetchPublicLeaderboards({ reset: true })" class="underline hover:text-white">Retry</button>
    </div>

    <!-- Leaderboard List -->
    <div class="leaderboard-list">
      <div v-if="loadingPublic && publicLeaderboards.length === 0" 
           class="flex flex-col items-center justify-center p-12 text-white/60">
        <div class="dots-loader mb-4">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>

      <div v-else-if="visibleBoards.length === 0" class="py-12 text-center">
        <div class="text-white/60">No leaderboards found matching your search</div>
      </div>

      <div v-else>
        <div v-for="(board, index) in visibleBoards" :key="board.id">
          <div 
            class="flex items-center gap-4 py-4 px-2 hover:bg-white/5 transition-colors group"
            :class="{ 'cursor-pointer': board.user_role === 'admin' || board.user_role === 'member' }"
            @click="board.user_role === 'admin' || board.user_role === 'member' ? goToLeaderboard(board.id) : null"
          >
            <!-- Icon -->
            <div class="relative flex-shrink-0">
              <img :src="marganaLogo" alt="" class="w-12 h-12 drop-shadow-sm group-hover:scale-105 transition-transform" />
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="mb-0.5">
                <div class="text-white font-semibold text-base sm:text-sm drop-shadow-sm">{{ board.name }}</div>
              </div>
              <div v-if="board.average_weekly_score > 0" class="text-white/60 text-sm mb-0.5">
                <span class="text-white/60 text-base font-extrabold">{{ board.average_weekly_score }}</span>
                average weekly score
              </div>
              <div
                v-if="board.user_role === 'admin' || board.user_role === 'member'"
                class="text-white/60 text-sm"
              >
                {{ board.user_role === 'admin' ? 'Owner' : 'Member' }}
              </div>
              <div class="flex items-center gap-3 text-white/60 text-sm">
                <span class="flex items-center gap-1">
                  <UserIcon class="w-5 h-5 sm:w-4 sm:h-4" />
                  {{ board.member_count }} {{ board.member_count === 1 ? 'member' : 'members' }}
                </span>
              </div>
            </div>

            <!-- Action -->
            <div class="flex items-center gap-2">
              <div v-if="board.user_role === 'pending' || !board.user_role" class="flex flex-col items-end gap-1">
                <template v-if="board.user_role === 'pending'">
                  <div 
                    class="relative text-center text-[12px] font-bold px-4 py-1.5 w-20 rounded-full border border-white/10 bg-white/5 text-white/40 cursor-default"
                  >
                    Requested
                    
                    <!-- Success tick -->
                    <div
                      v-if="joinSuccess[board.id]"
                      class="pointer-events-none absolute right-0 bottom-0 translate-x-1/2 translate-y-1/2 h-6 w-6 rounded-full shadow-md flex items-center justify-center font-bold text-white text-sm bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)]"
                      aria-hidden="true"
                    >
                      ✓
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div v-if="joinLoading[board.id]" class="w-20 flex justify-center">
                    <div class="dots-loader">
                      <span class="dot"></span>
                      <span class="dot"></span>
                      <span class="dot"></span>
                    </div>
                  </div>
                  <button 
                    v-else
                    @click="handleJoin(board)"
                    class="btn-common-button text-[12px] relative w-20 rounded-full"
                  >
                    {{ board.auto_approve ? 'Join' : 'Request' }}
                  </button>
                </template>
                <div v-if="joinError[board.id]" class="text-red-400 text-[10px] max-w-[120px] text-right">
                  {{ joinError[board.id] }}
                </div>
              </div>

              <!-- Chevron spacer/icon -->
              <div class="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                <ChevronRightIcon 
                  v-if="board.user_role === 'admin' || board.user_role === 'member'" 
                  class="w-6 h-6 sm:w-4 sm:h-4 text-indigo-200/30 group-hover:text-white group-hover:translate-x-1 transition-all"
                />
              </div>
            </div>
          </div>
          <div v-if="index < visibleBoards.length - 1" class="h-px bg-white/5 mx-2"></div>
        </div>

        <!-- Load More / Footer -->
        <div class="mt-4 flex justify-center pb-6">
          <button 
            v-if="hasMorePublic" 
            @click="fetchPublicLeaderboards()"
            :disabled="loadingPublic"
            class="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-indigo-200 hover:text-white hover:bg-white/10 transition-all text-sm font-semibold disabled:opacity-50"
          >
            {{ loadingPublic ? 'Loading more...' : 'Load More leaderboards' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.leaderboard-list {
  @apply w-full;
}

/* Custom scrollbar if needed, but using standard tailwind for now */
</style>
