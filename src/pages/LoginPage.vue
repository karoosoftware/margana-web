<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { signIn, confirmSignIn, resetPassword, confirmResetPassword, signUp, confirmSignUp, resendSignUpCode, fetchAuthSession } from 'aws-amplify/auth'
import { post } from 'aws-amplify/api'
import marganaLogo from '@/assets/margana_full_logo.svg'
import { API, ENDPOINTS } from '@/config/api'
import { ActivityTracker } from '@/usage/ActivityTracker'
import { useMarganaAuth } from '@/composables/useMarganaAuth'

// Auth Components
import AuthEmailEntry from '@/components/auth/AuthEmailEntry.vue'
import LoginForm from '@/components/auth/LoginForm.vue'
import SignUpForm from '@/components/auth/SignUpForm.vue'
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm.vue'
import NewPasswordForm from '@/components/auth/NewPasswordForm.vue'

const route = useRoute()
const router = useRouter()
const { fetchUser, userSub } = useMarganaAuth()

const error = ref('')
const email = ref('')
const loading = ref(false)
const isEmailLocked = ref(false)

// Flow state
type AuthFlow = 'EMAIL' | 'LOGIN' | 'SIGNUP' | 'FORGOT' | 'NEW_PASSWORD'
const flow = ref<AuthFlow>('EMAIL')

// Sub-states
const signUpStep = ref(1)
const forgotStep = ref(1)
const requiredAttrs = ref<string[]>([])

// For handling session logic
const loggedTerms = new Set<string>();

function normalizeEmail(v: string): string {
  try { return (v || '').trim().toLowerCase() } catch { return '' }
}

async function handleEmailContinue(enteredEmail: string) {
  error.value = ''
  email.value = enteredEmail
  loading.value = true

  try {
    // Attempt sign-in with a dummy password to check if user exists.
    // If user exists, it should throw NotAuthorizedException (incorrect password).
    // If user doesn't exist, it should throw UserNotFoundException.
    await signIn({
      username: normalizeEmail(email.value),
      password: 'CheckingUserExistenceDummy123!'
    })
    // In the highly unlikely event that it succeeds (wrong dummy), treat as exists
    flow.value = 'LOGIN'
  } catch (e: any) {
    const name = e?.name
    if (name === 'UserNotFoundException') {
      flow.value = 'SIGNUP'
      signUpStep.value = 1
      isEmailLocked.value = false
    } else if (name === 'NotAuthorizedException' || name === 'PasswordResetRequiredException' || name === 'UserNotConfirmedException' || name === 'UserLambdaValidationException') {
      // User exists
      flow.value = 'LOGIN'
    } else {
      error.value = e?.message || 'An error occurred. Please try again.'
    }
  } finally {
    loading.value = false
  }
}

async function handleLogin(password: string) {
  error.value = ''
  loading.value = true

  try {
    const { isSignedIn, nextStep } = await signIn({
      username: normalizeEmail(email.value),
      password
    })

    if (isSignedIn) {
      await finalizeLogin('login', 'user_action')
      return
    }

    const step = nextStep?.signInStep
    if (step === 'CONFIRM_SIGN_UP') {
      try {
        await resendSignUpCode({ username: normalizeEmail(email.value) })
      } catch (_) {}
      flow.value = 'SIGNUP'
      signUpStep.value = 2
      error.value = 'Your account isn’t confirmed yet. We’ve sent you a new verification code.'
      return
    }

    if (step === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      const attrs = nextStep?.missingAttributes || nextStep?.additionalInfo?.requiredAttributes || nextStep?.requiredAttributes || []
      requiredAttrs.value = Array.isArray(attrs) ? attrs : []
      flow.value = 'NEW_PASSWORD'
      return
    }

    if (step) {
      error.value = `Additional step required: ${step.replaceAll('_', ' ').toLowerCase()}`
      return
    }

    error.value = 'Sign in incomplete. Please try again.'
  } catch (e: any) {
    const name = e?.name
    const msg = e?.message || 'Sign-in failed.'
    if (name === 'NotAuthorizedException' || name === 'UserNotFoundException') {
      error.value = 'Incorrect email or password.'
    } else if (name === 'UserNotConfirmedException') {
      error.value = 'Please confirm your email to continue.'
    } else {
      error.value = msg
    }
  } finally {
    loading.value = false
  }
}

async function handleSignUpStart(data: any) {
  error.value = ''
  loading.value = true
  try {
    if (data.email) email.value = data.email
    const emailLower = normalizeEmail(email.value)
    await signUp({
      username: emailLower,
      password: data.password,
      options: {
        userAttributes: {
          email: emailLower,
          given_name: data.givenName,
          family_name: data.familyName,
        },
        autoSignIn: true,
      },
    })
    signUpStep.value = 2
  } catch (e: any) {
    error.value = e?.message || 'Sign up failed'
  } finally {
    loading.value = false
  }
}

async function handleSignUpConfirm(code: string) {
  error.value = ''
  loading.value = true
  try {
    await confirmSignUp({
      username: normalizeEmail(email.value),
      confirmationCode: code.trim(),
    })
    logTermsAsync(normalizeEmail(email.value))
    flow.value = 'LOGIN'
    signUpStep.value = 1
    error.value = ''
  } catch (e: any) {
    error.value = e?.message || 'Confirmation failed'
  } finally {
    loading.value = false
  }
}

async function handleResendSignUp() {
  error.value = ''
  try {
    await resendSignUpCode({ username: normalizeEmail(email.value) })
  } catch (e: any) {
    error.value = e?.message || 'Failed to resend code'
  }
}

async function handleForgotStart() {
  error.value = ''
  loading.value = true
  try {
    await resetPassword({ username: normalizeEmail(email.value) })
    forgotStep.value = 2
  } catch (e: any) {
    error.value = e?.message || 'Failed to start password reset'
  } finally {
    loading.value = false
  }
}

async function handleForgotConfirm(data: any) {
  error.value = ''
  loading.value = true
  try {
    await confirmResetPassword({
      username: normalizeEmail(email.value),
      confirmationCode: data.code.trim(),
      newPassword: data.newPassword,
    })
    flow.value = 'LOGIN'
    forgotStep.value = 1
    error.value = ''
  } catch (e: any) {
    error.value = e?.message || 'Failed to update password'
  } finally {
    loading.value = false
  }
}

async function handleNewPasswordSubmit(data: any) {
  error.value = ''
  loading.value = true
  try {
    const attrsToSend: any = {}
    if (requiredAttrs.value.includes('given_name')) attrsToSend.given_name = data.givenName.trim()
    if (requiredAttrs.value.includes('family_name')) attrsToSend.family_name = data.familyName.trim()

    await confirmSignIn({
      challengeResponse: data.newPassword,
      options: Object.keys(attrsToSend).length ? { userAttributes: attrsToSend } : undefined,
    })

    await finalizeLogin('login', 'new_password')
  } catch (e: any) {
    error.value = e?.message || 'Failed to set new password'
  } finally {
    loading.value = false
  }
}

async function finalizeLogin(eventName: string, reason: string) {
  try {
    await fetchUser()
    const sub = userSub.value
    if (sub) {
      ActivityTracker.setUser(sub)
    }
    ActivityTracker.record(eventName, { reason })
    ActivityTracker.flush(eventName).catch(() => {})
  } catch (_) {}

  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
  router.replace(redirect || { name: 'margana' })
}

async function logTermsAsync(email: string) {
  if (loggedTerms.has(email)) return
  loggedTerms.add(email)
  try {
    await post({
      apiName: 'MarganaApi',
      path: ENDPOINTS.MARGANA_TERMS_AUDIT,
      options: {
        body: {
          email,
          terms_version: '1.0',
          accepted_at: new Date().toISOString(),
          userAgent: navigator.userAgent
        }
      }
    }).response
  } catch (_) {}
}

function applyModeFromRoute() {
  const q = route.query as Record<string, unknown>
  const hash = (route.hash || '').toLowerCase()
  const isTrue = (v: unknown) => v === '1' || v === 'true' || v === true

  if (isTrue(q.signup) || isTrue(q.create) || hash === '#signup' || hash === '#create' || hash === '#create-account') {
    flow.value = 'SIGNUP'
    signUpStep.value = 1
    const qEmail = typeof q.email === 'string' ? q.email : ''
    if (qEmail) {
      email.value = qEmail
      isEmailLocked.value = true
    } else {
      isEmailLocked.value = false
    }
  }
}

onMounted(applyModeFromRoute)
watch(() => route.fullPath, applyModeFromRoute)
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center p-4">
    <div class="w-full max-w-sm sm:max-w-md">
      <div class="w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-xl p-6 sm:p-8 margana-proportions">
        <div class="flex items-center justify-center">
          <img
            :src="marganaLogo"
            alt=""
            aria-hidden="true"
            role="presentation"
            class="align-middle select-none"
            style="height: var(--margana-logo-h-header); margin-right: calc(var(--margana-navbar-logo-x) * -2.5)"
            draggable="false"
          />
        </div>

        <AuthEmailEntry
          v-if="flow === 'EMAIL'"
          :initial-email="email"
          :loading="loading"
          :error="error"
          @continue="handleEmailContinue"
          @back="router.back()"
        />

        <LoginForm
          v-else-if="flow === 'LOGIN'"
          :email="email"
          :loading="loading"
          :error="error"
          @submit="handleLogin"
          @forgot-password="flow = 'FORGOT'; forgotStep = 1; error = ''"
          @back="flow = 'EMAIL'; error = ''"
        />

        <SignUpForm
          v-else-if="flow === 'SIGNUP'"
          :email="email"
          :email-locked="isEmailLocked"
          :step="signUpStep"
          :loading="loading"
          :error="error"
          @start="handleSignUpStart"
          @confirm="handleSignUpConfirm"
          @resend="handleResendSignUp"
          @change-email="flow = 'EMAIL'; signUpStep = 1; error = ''"
          @back="signUpStep === 1 ? flow = 'EMAIL' : signUpStep = 1; error = ''"
        />

        <ForgotPasswordForm
          v-else-if="flow === 'FORGOT'"
          :email="email"
          :step="forgotStep"
          :loading="loading"
          :error="error"
          @start="handleForgotStart"
          @confirm="handleForgotConfirm"
          @back="forgotStep === 1 ? flow = 'LOGIN' : forgotStep = 1; error = ''"
        />

        <NewPasswordForm
          v-else-if="flow === 'NEW_PASSWORD'"
          :required-attrs="requiredAttrs"
          :loading="loading"
          :error="error"
          @submit="handleNewPasswordSubmit"
          @back="flow = 'LOGIN'; error = ''"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}
:deep(.animate-shake) { animation: shake 0.6s both; }
</style>
