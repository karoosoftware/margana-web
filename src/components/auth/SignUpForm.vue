<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps<{
  email: string
  step: number
  loading?: boolean
  error?: string
  emailLocked?: boolean
}>()

const emit = defineEmits<{
  (e: 'start', data: any): void
  (e: 'confirm', code: string): void
  (e: 'resend'): void
  (e: 'back'): void
  (e: 'change-email'): void
}>()

const givenName = ref('')
const familyName = ref('')
const password = ref('')
const email = ref(props.email)
const code = ref('')
const termsAccepted = ref(false)
const showPwd = ref(false)

const resending = ref(false)
const resendSent = ref(false)

function handleResendClick() {
  if (resending.value) return
  resending.value = true
  resendSent.value = false
  emit('resend')
  // Provide immediate feedback then show success message if no error occurs
  setTimeout(() => {
    resending.value = false
    if (!props.error) {
      resendSent.value = true
    }
  }, 1000)
}

watch(() => props.error, (newErr) => {
  if (newErr) {
    resending.value = false
    resendSent.value = false
  }
})

watch(code, () => {
  if (resendSent.value) resendSent.value = false
})

const isFormValid = computed(() => {
  if (props.step === 1) {
    return (
      email.value.trim() !== '' &&
      givenName.value.trim() !== '' &&
      familyName.value.trim() !== '' &&
      password.value.length >= 8 &&
      termsAccepted.value
    )
  }
  return code.value.trim() !== ''
})

const route = useRoute()
const router = useRouter()

const givenNameInput = ref<HTMLInputElement | null>(null)
const emailInput = ref<HTMLInputElement | null>(null)
const codeInput = ref<HTMLInputElement | null>(null)

watch(() => props.email, (newEmail) => {
  email.value = newEmail
})

function focusCorrectField() {
  if (props.step === 1) {
    if (!email.value) {
      emailInput.value?.focus()
    } else {
      givenNameInput.value?.focus()
    }
  } else if (props.step === 2) {
    codeInput.value?.focus()
  }
}

onMounted(focusCorrectField)
watch(() => props.step, focusCorrectField)

function handleStart() {
  emit('start', {
    email: email.value,
    givenName: givenName.value,
    familyName: familyName.value,
    password: password.value,
    termsAccepted: termsAccepted.value,
    termsVersion: '1.0'
  })
}

function handleConfirm() {
  emit('confirm', code.value)
}

function handleBack() {
  if (props.step > 1) {
    // If we are on the verification step, just go back to the first step of the form
    emit('back')
  } else {
    // If we are on the first step, check if we arrived here directly via a link or button
    const q = route.query
    const hash = (route.hash || '').toLowerCase()
    const isDirectSignup = q.signup || q.create || hash.includes('signup') || hash.includes('create')

    if (isDirectSignup) {
      // Direct access (e.g., from Settings) -> go back to the previous page
      router.back()
    } else {
      // Normal flow (e.g., from Email entry) -> go back to the email entry screen
      emit('back')
    }
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="text-center mt-4 mb-3" v-if="step === 1">
      <h1 class="text-white text-lg font-bold">Create your free account</h1>
    </div>

    <form @submit.prevent="step === 1 ? handleStart() : handleConfirm()" class="space-y-4">
      <template v-if="step === 1">
        <div>
          <label class="block text-sm font-medium mb-1 text-white" for="signup-email">Email</label>
        <input
          id="signup-email"
          ref="emailInput"
          v-model.trim="email"
          type="email"
          class="form-input"
          :class="{ 'opacity-60': emailLocked }"
          :readonly="emailLocked"
          placeholder=""
          required
        />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1 text-white" for="signup-given">First name</label>
            <input
              id="signup-given"
              ref="givenNameInput"
              v-model.trim="givenName"
              type="text"
              class="form-input"
              autocomplete="given-name"
              placeholder=""
              required
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 text-white" for="signup-family">Last name</label>
            <input
              id="signup-family"
              v-model.trim="familyName"
              type="text"
              class="form-input"
              autocomplete="family-name"
              placeholder=""
              required
            />
          </div>
        </div>

        <div class="relative">
          <label class="block text-sm font-medium mb-1 text-white" for="signup-password">Password</label>
          <input
            id="signup-password"
            v-model="password"
            :type="showPwd ? 'text' : 'password'"
            class="form-input"
            autocomplete="new-password"
            placeholder=""
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

        <div class="mt-2 text-sm text-indigo-100/90">
          <label class="inline-flex items-start gap-2">
            <input
                type="checkbox"
                v-model="termsAccepted"
                required
                class="mt-0.5 h-4 w-4 rounded border-white/30 bg-white/10 accent-purple-500 focus:ring-2 focus:ring-purple-400"
            />


            <span>
              I agree to the
              <a href="/terms.html" target="_blank" rel="noopener noreferrer" class="underline underline-offset-4 hover:text-white">Terms & Conditions</a>
              and
              <a href="/privacy.html" target="_blank" rel="noopener noreferrer" class="underline underline-offset-4 hover:text-white">Privacy Notice</a>
              <span class="block text-indigo-200/80 text-xs mt-1">
                Terms v1.0 – 18 Jan 2026
              </span>
            </span>
          </label>
        </div>
      </template>

      <template v-else>
        <div class="text-indigo-100/90">
          We sent a verification code to <span class="font-semibold">{{ email }}</span>
        </div>
        <label class="block text-sm font-medium mb-1 text-indigo-100" for="signup-code">Verification code</label>
        <input
          id="signup-code"
          ref="codeInput"
          v-model.trim="code"
          type="text"
          class="form-input"
          placeholder="123456"
          required
        />
        <div class="space-y-2">
          <div class="flex justify-between items-center text-sm">
            <div v-if="resending" class="flex items-center">
              <span class="dots-loader" role="img" aria-label="Sending code">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </span>
            </div>
            <button
              v-else
              type="button"
              @click="handleResendClick"
              :disabled="resending"
              class="text-indigo-200 hover:text-white underline-offset-4 hover:underline disabled:opacity-50 disabled:no-underline transition-opacity active:opacity-70"
            >
              Resend code
            </button>
          </div>
          <p v-if="resendSent" class="text-[11px] sm:text-xs text-green-300 font-medium bg-green-900/20 border border-green-700/30 rounded-lg px-2.5 py-1.5 animate-fade-in">
            Code sent! Please check your email for the new code.
          </p>
        </div>
      </template>

      <p v-if="error" class="text-sm text-rose-300 bg-rose-900/40 border border-rose-700/40 rounded-lg px-3 py-2 animate-shake">
        {{ error }}
      </p>

      <div class="grid w-full grid-cols-3 items-center gap-6">
        <!-- left spacer (keeps the middle button truly centered) -->
        <div></div>

        <!-- centered primary button -->
        <div v-if="loading" class="flex-1 flex items-center justify-center">
          <span class="dots-loader" role="img" aria-label="Updating">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </span>
        </div>
        <button
            v-else
            type="submit"
            class="btn-account-management justify-self-center"
            :disabled="!isFormValid"
        >
          {{ step === 1 ? 'Create' : 'Verify' }}
        </button>

        <!-- far right back button -->
        <button
            v-if="step > 1 || !emailLocked"
            type="button"
            @click="handleBack"
            class="btn-navigation justify-self-end"
        >
          Back
        </button>
      </div>


    </form>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}
</style>
