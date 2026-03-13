<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import marganaLogo from '@/assets/margana_m_logo.svg'
import { useLeaderboard } from '@/composables/useLeaderboard'
import { 
  UserIcon, 
  ClockIcon, 
  FunnelIcon, 
  ChevronDownIcon, 
  XMarkIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CheckIcon
} from '@heroicons/vue/20/solid'

defineOptions({ name: 'LeaderboardMy' })

const router = useRouter()
const { 
  myLeaderboards,
  loadingMy, 
  myError, 
  fetchMyLeaderboards,
  selectedMyFilters,
  filteredMyLeaderboards,
  setMyFilters,
  resolveInvitation
} = useLeaderboard()

const filterMenuOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const resolvingId = ref<string | null>(null)
const resolvingAction = ref<'accept' | 'deny' | null>(null)
const searchQuery = ref('')

const visibleMyLeaderboards = computed(() => {
  const q = searchQuery.value.toLowerCase()
  let filtered = filteredMyLeaderboards.value
  
  if (q) {
    filtered = filtered.filter(board => 
      board.name.toLowerCase().includes(q)
    )
  }

  // Priority ordering:
  // 1. Invited boards (outstanding requests)
  // 2. Play Margana (system board)
  const invited = filtered.filter(b => b.status === 'invited')
  const nonInvited = filtered.filter(b => b.status !== 'invited')

  const officialIndex = nonInvited.findIndex(b => 
    b.name === 'Play Margana' || b.id === 'play-margana'
  )
  
  if (officialIndex > -1) {
    const official = nonInvited[officialIndex]
    const remaining = nonInvited.filter((_, i) => i !== officialIndex)
    return [...invited, official, ...remaining]
  }

  return [...invited, ...nonInvited]
})

const handleResolve = async (id: string, action: 'accept' | 'deny') => {
  resolvingId.value = id
  resolvingAction.value = action
  try {
    await resolveInvitation(id, action)
    if (action === 'accept') {
      router.push({ name: 'leaderboard-detail', params: { id }, query: { from: 'my' } })
    } else {
      await fetchMyLeaderboards({ force: true })
    }
  } catch (err: any) {
    // Basic error reporting for now
    console.error(`Failed to ${action} invitation:`, err)
  } finally {
    resolvingId.value = null
    resolvingAction.value = null
  }
}

const filterOptions = [
  { id: 'admin', label: 'Owner', color: 'bg-gradient-to-tr from-indigo-500 to-violet-600' },
  { id: 'member', label: 'Member', color: 'bg-gradient-to-br from-indigo-600 to-fuchsia-600' },
  { id: 'public', label: 'Public', color: 'bg-gradient-to-tr from-indigo-500 to-violet-600 shadow-sm ring-1 ring-indigo-400/20' },
  { id: 'private', label: 'Private', color: 'bg-gradient-to-tr from-purple-600 to-orange-600' }
]

const getFilterColor = (id: 'admin' | 'member' | 'public' | 'private') =>
  filterOptions.find(option => option.id === id)?.color ?? 'bg-white/10'

const availableOptions = computed(() => {
  return filterOptions.filter(opt => !selectedMyFilters.value.includes(opt.id))
})

const activeFilters = computed(() => {
  return filterOptions.filter(opt => selectedMyFilters.value.includes(opt.id))
})

const addFilter = (id: string) => {
  setMyFilters([...selectedMyFilters.value, id])
  filterMenuOpen.value = false
}

const removeFilter = (id: string) => {
  setMyFilters(selectedMyFilters.value.filter(f => f !== id))
}

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    filterMenuOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('mousedown', handleClickOutside)
  fetchMyLeaderboards()
})

onUnmounted(() => {
  window.removeEventListener('mousedown', handleClickOutside)
})

const goToLeaderboard = (id: string) => {
  router.push({ name: 'leaderboard-detail', params: { id }, query: { from: 'my' } })
}

const refresh = () => {
  fetchMyLeaderboards({ force: true })
}
</script>

<template>
  <div class="leaderboard-my h-full flex flex-col">
    <!-- Search and Filter Bar -->
    <div v-if="!loadingMy && !myError && (myLeaderboards.length > 0 || selectedMyFilters.length > 0)" 
         class="px-4 py-3 flex flex-col gap-3 border-b border-white/5">
      
      <div class="flex items-center gap-2">
        <!-- Search -->
        <div class="relative flex-1">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon class="h-4 w-4 text-indigo-300/50" />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search my leaderboards..."
            class="w-full bg-white/5 border border-white/10 rounded-xl py-1.5 pl-9 pr-4 text-sm text-white placeholder-indigo-300/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
          />
        </div>

        <!-- Refresh -->
        <button 
          @click="refresh"
          class="p-1.5 text-indigo-200/80 hover:text-white transition-all flex-shrink-0"
          :class="{ 'animate-spin': loadingMy }"
          title="Refresh"
        >
          <ArrowPathIcon class="w-6 h-6" />
        </button>

        <!-- Filter Menu Trigger -->
        <div class="relative" ref="dropdownRef">
          <button 
            v-if="availableOptions.length > 0 || selectedMyFilters.length > 0"
            @click="filterMenuOpen = !filterMenuOpen"
            class="flex items-center gap-2 px-3 py-1.5 text-indigo-200/80 hover:text-white transition-all text-xs font-bold tracking-wider"
          >
            <FunnelIcon class="w-5 h-5 sm:w-4 sm:h-4" />
            <ChevronDownIcon class="w-5 h-5 sm:w-4 sm:h-4 transition-transform" :class="{ 'rotate-180': filterMenuOpen }" />
          </button>

          <!-- Dropdown Menu -->
          <div v-if="filterMenuOpen" 
               class="absolute right-0 mt-2 w-48 rounded-xl bg-gradient-to-br from-gray-700 via-purple-900 to-indigo-900 shadow-2xl ring-1 ring-white/10 z-50 py-2 overflow-hidden animate-fade-in">
            <div 
              v-for="opt in availableOptions" 
              :key="opt.id"
              @click="addFilter(opt.id)"
              class="px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 cursor-pointer transition-colors group"
            >
              <span class="text-xs tracking-widest text-white group-hover:text-white">
                {{ opt.label }}
              </span>
            </div>
            <div v-if="selectedMyFilters.length > 0" class="border-t border-white/5 mt-1 pt-1">
              <div 
                @click="setMyFilters([]); filterMenuOpen = false"
                class="px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 cursor-pointer transition-colors group text-white"
              >
                <XMarkIcon class="w-5 h-5 sm:w-4 sm:h-4" />
                <span class="text-xs tracking-wides">
                  Clear All
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Active Filter Tags -->
      <div v-if="activeFilters.length > 0" class="flex flex-wrap items-center gap-2">
        <div v-for="filter in activeFilters" :key="filter.id"
             class="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] tracking-wider text-white"
             :class="filter.color">
          <span>{{ filter.label }}</span>
          <button @click="removeFilter(filter.id)" class="hover:text-white/80 transition-colors cursor-pointer">
            <XMarkIcon class="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loadingMy && filteredMyLeaderboards.length === 0" class="flex-1 flex flex-col items-center justify-center p-8 text-white/60">
      <div class="dots-loader mb-4">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="myError" class="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div class="bg-red-500/10 border border-red-500/20 rounded-xl p-6 max-w-xs">
        <p class="text-red-400 mb-4">{{ myError }}</p>
        <button 
          @click="fetchMyLeaderboards"
          class="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg transition-colors text-sm font-semibold"
        >
          Try Again
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="visibleMyLeaderboards.length === 0" class="flex-1 flex flex-col items-center justify-center p-8 text-center text-white/40">
      <div class="flex items-center justify-center">
        <img :src="marganaLogo" alt="" class="w-34 h-34" />
      </div>
      <p class="text-lg font-medium text-white/60 mb-2">
        {{ (selectedMyFilters.length > 0 || searchQuery) ? 'No matching leaderboards' : 'No leaderboards yet' }}
      </p>
      <p class="text-sm max-w-xs mb-6">
        {{ (selectedMyFilters.length > 0 || searchQuery) ? 'Try adjusting your search or filters' : "You haven't joined any leaderboards. Go to the Public tab to discover some or create your own!" }}
      </p>
      <button 
        v-if="selectedMyFilters.length > 0 || searchQuery"
        @click="setMyFilters([]); searchQuery = ''"
        class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-semibold"
      >
        Clear all
      </button>
    </div>

    <!-- List -->
    <div v-else class="flex-1 overflow-y-auto">
      <div v-for="(board, index) in visibleMyLeaderboards" :key="board.id">
        <div 
          class="flex items-center gap-4 py-2 px-2 hover:bg-white/5 transition-colors group"
          :class="{ 'cursor-pointer': board.status !== 'invited' }"
          @click="board.status !== 'invited' ? goToLeaderboard(board.id) : null"
        >
          <div class="relative flex-shrink-0">
            <img :src="marganaLogo" alt="" class="w-16 h-16 drop-shadow-sm group-hover:scale-110 transition-transform" />
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            </div>
          </div>
          
          <div class="flex-1 min-w-0">
            <div class="grid grid-cols-[minmax(0,16ch)_auto_1fr] sm:grid-cols-[minmax(0,24ch)_auto_1fr] items-center gap-2 mb-0.5 min-w-0">
              <span class="text-white font-semibold text-base sm:text-sm drop-shadow-sm min-w-0 block">
                {{ board.name }}
              </span>
              <span
                v-if="board.is_public"
                class="text-white text-[10px] px-1.5 py-0.5 rounded-lg tracking-wider shrink-0 justify-self-center"
                :class="getFilterColor('public')"
              >
                Public
              </span>
              <span
                v-else-if="board.is_public === false"
                class="text-white text-[10px] px-1.5 py-0.5 rounded-lg tracking-wider shrink-0 justify-self-center"
                :class="getFilterColor('private')"
              >
                Private
              </span>
            </div>
            
            <div class="text-white/40 text-xs space-y-1">
              <div>
                <span
                    v-if="board.role === 'admin'"
                    class="text-white/60 text-sm"
                >
                  Owner
                </span>
                <span
                    v-else-if="board.role === 'member'"
                    class="text-white/60 text-sm"
                >
                  Member
                </span>
              </div>
              <div class="flex items-center gap-1">
                <UserIcon class="w-5 h-5 sm:w-4 sm:h-4" />
                {{ board.member_count || 0 }}
              </div>
            </div>
          </div>

          <div v-if="board.status === 'invited'" class="flex flex-col items-center gap-1 mr-2" @click.stop>
            <span class="text-white text-[10px] px-2 py-1 rounded-lg tracking-wider bg-gradient-to-tr from-indigo-500 to-purple-600 leading-none">New invite</span>
            <div class="flex items-center gap-1.5">
              <button
                  @click="handleResolve(board.id, 'accept')"
                  :disabled="!!resolvingId"
                  class="p-1 rounded text-white/40 hover:text-white transition-all flex items-center justify-center"
                  title="Accept invitation"
              >
                <ArrowPathIcon v-if="resolvingId === board.id && resolvingAction === 'accept'" class="w-4 h-4 animate-spin" />
                <CheckIcon v-else class="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
              <div class="w-px h-3 bg-white/10 mx-0.5"></div>
              <button
                  @click="handleResolve(board.id, 'deny')"
                  :disabled="!!resolvingId"
                  class="p-1 rounded text-white/40 hover:text-white transition-all flex items-center justify-center"
                  title="Deny invitation"
              >
                <ArrowPathIcon v-if="resolvingId === board.id && resolvingAction === 'deny'" class="w-4 h-4 animate-spin" />
                <XMarkIcon v-else class="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          <div v-if="board.status !== 'invited'" class="flex-shrink-0 text-white/70 hover:text-white transition-colors">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        <div v-if="index < visibleMyLeaderboards.length - 1" class="h-px bg-white/5 mx-4"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.leaderboard-my {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}
.leaderboard-my::-webkit-scrollbar {
  width: 4px;
}
.leaderboard-my::-webkit-scrollbar-track {
  background: transparent;
}
.leaderboard-my::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
</style>
