<script setup>
import BaseModal from '../BaseModal.vue'
import { useMarganaAuth } from '@/composables/useMarganaAuth'
import { ref } from 'vue'

const { acceptTerms, needsTermsAcceptance } = useMarganaAuth()
const isBusy = ref(false)

async function handleAccept() {
  isBusy.value = true
  try {
    await acceptTerms()
  } finally {
    isBusy.value = false
  }
}
</script>

<template>
  <BaseModal 
    :show="needsTermsAcceptance" 
    title="Terms & Conditions"
    :hideClose="true"
    @close="() => {}"
  >
    <div class="space-y-4">
      <p class="text-white/90">
        To play Margana, please accept our Terms & Conditions. You must be at least 13 years old to play
      </p>
      
      <p class="text-sm text-indigo-100/80">
        By clicking "Accept & Play", you agree to our 
        <a href="/terms.html" target="_blank" rel="noopener" class="underline hover:text-white">Terms & Conditions</a>
        and acknowledge our
        <a href="/privacy.html" target="_blank" rel="noopener" class="underline hover:text-white">Privacy Notice</a>.
      </p>

      <div class="pt-4 flex justify-center">
        <button
          @click="handleAccept"
          :disabled="isBusy"
          class="btn-common-button"
        >
          {{ isBusy ? 'Submitting' : 'Accept & play' }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
/* Modal content styles */
</style>
