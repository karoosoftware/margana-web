<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  email: string
  loading?: boolean
  error?: string
}>()

const emit = defineEmits<{
  (e: 'submit', password: string): void
  (e: 'forgot-password'): void
  (e: 'back'): void
}>()

const password = ref('')
const showPwd = ref(false)
const passwordInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  passwordInput.value?.focus()
})

function handleSubmit() {
  if (password.value) {
    emit('submit', password.value)
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="text-center mt-4 mb-3">
      <h1 class="text-white font-bold text-lg">Welcome back</h1>
      <p class="text-white  text-sm">Enter your password to log in</p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1 text-white" for="login-email">Email</label>
        <input
          id="login-email"
          :value="email"
          type="email"
          disabled
          class="w-full rounded-lg bg-white/5 text-white/50 border border-white/10 px-3 py-2 cursor-not-allowed"
        />
      </div>

      <div class="relative">
        <label class="block text-sm font-medium mb-1 text-white" for="password">Password</label>
        <input
          :type="showPwd ? 'text' : 'password'"
          id="password"
          ref="passwordInput"
          v-model="password"
          class="form-input"
          autocomplete="current-password"
          required
          autofocus
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

      <p v-if="error" class="text-sm text-rose-300 bg-rose-900/40 border border-rose-700/40 rounded-lg px-3 py-2 animate-shake">
        {{ error }}
      </p>

      <div class="grid w-full grid-cols-3 items-center gap-6">
        <div></div> <!-- left spacer -->

        <div v-if="loading" class="flex items-center justify-center">
          <span class="dots-loader" role="img" aria-label="Signing in">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </span>
        </div>
        <button
            v-else
            type="submit"
            class="btn-account-management justify-self-center"
            :disabled="loading"
        >
          Sign in
        </button>

        <button
            type="button"
            @click="emit('back')"
            class="btn-navigation justify-self-end"
        >
          Back
        </button>
      </div>



    </form>

    <div class="mt-4 text-sm text-center">
      <button
        type="button"
        @click="emit('forgot-password')"
        class="text-white hover:text-indigo-200 underline-offset-4"
      >
        Forgot password?
      </button>
    </div>
  </div>
</template>
