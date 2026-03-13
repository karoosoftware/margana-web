<script setup>
import BaseModal from '../BaseModal.vue'
import marganaLogoFull from '@/assets/margana_full_logo.svg'
import { useRouter } from 'vue-router'
import { ActivityTracker } from '@/usage/ActivityTracker'

defineProps({
  show: { type: Boolean, default: false },
  landscapeMobileMode: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])
const router = useRouter()

function signup() {
  emit('close')
  ActivityTracker.record('landing_signup_guest_played')
  router.push({name: 'login', query: {signup: 'true'}})
}
</script>

<template>
  <BaseModal 
    :show="show" 
    title="" 
    :landscapeMobileMode="landscapeMobileMode"
    @close="emit('close')"
  >
    <div class="flex flex-col items-center text-center space-y-6 py-1 margana-proportions">
      <img
        :src="marganaLogoFull"
        alt="Margana"
        class="select-none"
        style="height: var(--margana-logo-h-medium); margin-left: calc(var(--margana-navbar-logo-x) * 2.5)"
        draggable="false"
      />
      
      <div class="space-y-4">
        <p class="text-white/90 text-sm sm:text-base">
          Create a free account to unlock more performance statistics &ndash; including streak history, your scoring trends and how you rank
          against other players
        </p>
      </div>

      <button
          type="button"
          @click="signup"
          class="w-30 sm:w-35 min-w-0 h-9 sm:h-10 px-2.5 sm:px-3 text-xs sm:text-sm rounded-lg font-semibold text-white
           inline-flex items-center justify-center
           bg-gradient-to-tr from-indigo-500 via-purple-600 to-violet-700 hover:from-indigo-400 hover:via-purple-500 hover:to-violet-600
           shadow transition-all active:scale-[0.98]"
      >
        Create account
      </button>
    </div>
  </BaseModal>
</template>

<style scoped>
</style>
