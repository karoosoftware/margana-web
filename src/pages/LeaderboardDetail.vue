<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import LeaderboardView from '@/components/leaderboard/LeaderboardView.vue'
import { ChevronLeftIcon } from '@heroicons/vue/20/solid'

defineOptions({ name: 'LeaderboardDetailPage' })

const route = useRoute()
const leaderboardId = computed(() => String(route.params.id || ''))

const backRoute = computed(() => {
  const from = route.query.from
  if (from === 'public') {
    return { name: 'leaderboards', query: { tab: 'public' } }
  } else if (from === 'manage') {
    return { name: 'leaderboards', query: { tab: 'manage' } }
  }
  return { name: 'leaderboards', query: { tab: 'my' } }
})

const backLabel = computed(() => {
  const from = route.query.from
  if (from === 'public') return 'Join leaderboard'
  if (from === 'manage') return 'Create leaderboard'
  return 'My leaderboards'
})
</script>

<template>
  <div class="flex flex-col items-center justify-start min-h-full p-4 sm:p-8">
    <div class="w-full max-w-2xl mb-6">
      <router-link 
        :to="backRoute" 
        class="inline-flex items-center gap-2 text-white hover:font-semibold transition-all text-base tracking-tight group"
      >
        <div class="p-1 rounded transition-colors">
          <ChevronLeftIcon class="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
        </div>
        {{ backLabel }}
      </router-link>
    </div>
    
    <LeaderboardView :id="leaderboardId" />
  </div>
</template>

<style scoped>
/* Any page specific styles */
</style>
