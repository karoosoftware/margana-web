<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  initialEmail?: string
  loading?: boolean
  error?: string
}>()

const emit = defineEmits<{
  (e: 'continue', email: string): void
  (e: 'back'): void
}>()

const email = ref(props.initialEmail || '')
const emailInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  emailInput.value?.focus()
})

function handleSubmit() {
  if (email.value.trim()) {
    emit('continue', email.value.trim())
  }
}
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-white text-lg font-bold text-center mt-4 mb-3">Log in or create an account</h1>
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1 text-white" for="email">Email</label>
        <input
          id="email"
          ref="emailInput"
          v-model.trim="email"
          type="email"
          inputmode="email"
          class="form-input"
          autocomplete="email"
          autocapitalize="none"
          placeholder="you@example.com"
          required
          autofocus
        />
      </div>

      <p v-if="error" class="text-sm text-rose-300 bg-rose-900/40 border border-rose-700/40 rounded-lg px-3 py-2 animate-shake">
        {{ error }}
      </p>

      <div class="grid w-full grid-cols-3 items-center gap-6">
        <!-- left spacer (keeps the middle button truly centered) -->
        <div></div>

        <!-- centered primary button -->
        <div v-if="loading" class="flex items-center justify-center">
          <span class="dots-loader" role="img" aria-label="Checking">
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
          Continue
        </button>

        <!-- far right back button -->
        <button
          type="button"
          @click="emit('back')"
          class="btn-navigation justify-self-end"
        >
          Back
        </button>
      </div>
    </form>
  </div>
</template>
