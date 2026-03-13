<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const props = defineProps<{
  email: string
  step: number
  loading?: boolean
  error?: string
}>()

const emit = defineEmits<{
  (e: 'start', email: string): void
  (e: 'confirm', data: any): void
  (e: 'back'): void
}>()

const code = ref('')
const newPassword = ref('')
const showPwd = ref(false)

const codeInput = ref<HTMLInputElement | null>(null)

function focusCorrectField() {
  if (props.step === 2) {
    codeInput.value?.focus()
  }
}

onMounted(focusCorrectField)
watch(() => props.step, focusCorrectField)

function handleStart() {
  emit('start', props.email)
}

function handleConfirm() {
  emit('confirm', {
    code: code.value,
    newPassword: newPassword.value
  })
}
</script>

<template>
  <div class="space-y-4">
    <div class="text-center mt-4 mb-3">
      <p class="text-indigo-100/90 font-bold">Reset your password</p>
    </div>

    <form @submit.prevent="step === 1 ? handleStart() : handleConfirm()" class="space-y-4">
      <div v-if="step === 1">
        <label class="block text-sm font-medium mb-1 text-indigo-100" for="forgot-email">Email</label>
        <input
          id="forgot-email"
          :value="email"
          type="email"
          disabled
          class="w-full rounded-lg bg-white/5 text-white/50 border border-white/10 px-3 py-2 cursor-not-allowed"
        />
      </div>

      <div v-else class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1 text-indigo-100" for="forgot-code">Verification code</label>
        <input
          id="forgot-code"
          ref="codeInput"
          v-model.trim="code"
          type="text"
          class="form-input"
          placeholder="123456"
          required
          autofocus
        />
        </div>

        <div class="relative">
          <label class="block text-sm font-medium mb-1 text-indigo-100" for="forgot-new-password">New password</label>
        <input
          id="forgot-new-password"
          v-model="newPassword"
          :type="showPwd ? 'text' : 'password'"
          class="form-input"
          autocomplete="new-password"
          placeholder="••••••••"
          minlength="8"
          required
        />
          <div class="absolute inset-y-0 right-3 flex items-center">
            <button
              type="button"
              class="inline-flex h-5 w-5 items-center justify-center
                 text-slate-300 hover:text-white
                 bg-transparent border-0 outline-none
                 focus:outline-none focus:ring-0 focus-visible:outline-none
                 translate-y-[10px]
                 [-webkit-tap-highlight-color:transparent]"
              @click="showPwd = !showPwd"
              :aria-label="showPwd ? 'Hide password' : 'Show password'"
              :aria-pressed="showPwd ? 'true' : 'false'"
            >
              <svg v-if="!showPwd" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                   class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M3 3l18 18M10.6 10.6A3.5 3.5 0 0012 15.5M7.4 7.9C4.9 9.3 3.4 11.6 3.1 12c0 0 3.4 7 8.9 7 2 0 3.7-.6 5.2-1.6M15.5 8.4A6.6 6.6 0 0012 8c-6.5 0-9.9 7-9.9 7 .2.3 1.1 1.9 2.9 3.4"/>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                   class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M2.1 12S5.5 5 12 5s9.9 7 9.9 7-3.4 7-9.9 7S2.1 12 2.1 12Z"/>
                <circle cx="12" cy="12" r="3.5"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <p v-if="error" class="text-sm text-rose-300 bg-rose-900/40 border border-rose-700/40 rounded-lg px-3 py-2 animate-shake">
        {{ error }}
      </p>

      <div class="flex gap-2">
        <div v-if="loading" class="flex-1 flex items-center justify-center">
          <span class="dots-loader" role="img" aria-label="Submitting">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </span>
        </div>
        <button
          v-else
          type="submit"
          class="btn-account-management flex-1"
          :disabled="loading"
        >
          {{ step === 1 ? 'Send reset code' : 'Update password' }}
        </button>
        <button type="button" @click="emit('back')" class="btn-navigation">
          Back
        </button>
      </div>
    </form>
  </div>
</template>
