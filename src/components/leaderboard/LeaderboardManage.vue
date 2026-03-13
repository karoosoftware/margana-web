<script setup>
import {computed, ref} from 'vue'
import {useRouter} from 'vue-router'
import {useMarganaAuth} from '@/composables/useMarganaAuth'
import {useLeaderboardManage} from '@/composables/useLeaderboardManage'
import {
  XMarkIcon,
  PlusIcon,
  LockClosedIcon,
  UserGroupIcon,
  CheckIcon
} from '@heroicons/vue/20/solid'

defineOptions({name: 'LeaderboardManage'})

const router = useRouter()
const {username, userEmail} = useMarganaAuth()
const {
  currentStep,
  leaderboardName,
  isPublic,
  members,
  admins,
  nameError,
  memberError,
  verifyingName,
  submitting,
  success,
  verifyName,
  addMember,
  removeMember,
  addAdmin,
  removeAdmin,
  buildCreatePayload,
  createLeaderboard
} = useLeaderboardManage()

const newMemberInput = ref('')
const newAdminInput = ref('')
const ownerEmail = computed(() => userEmail.value || username.value || '')
const leaderboardSummary = computed(() => buildCreatePayload(ownerEmail.value))

const handleAddMember = () => {
  memberError.value = null
  if (addMember(newMemberInput.value, username.value)) {
    newMemberInput.value = ''
  }
}

const handleAddAdmin = () => {
  memberError.value = null
  if (addAdmin(newAdminInput.value, username.value)) {
    newAdminInput.value = ''
  }
}

const createdId = ref(null)

const handleCreate = async () => {
  try {
    const result = await createLeaderboard(leaderboardSummary.value)
    if (result && result.id) {
      createdId.value = result.id
    }
  } catch (err) {
    // Error is handled by the composable (submitting flag and potential error display if we add it)
    console.error('Failed to create leaderboard:', err)
  }
}
</script>

<template>
  <div class="p-6 max-w-lg mx-auto">
    <!-- Progress Indicator -->
    <div class="flex justify-start gap-1.5 mb-8">
      <div
          v-for="s in [1, 2, 3, 4]"
          :key="s"
          class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 select-none"
          :class="[
          currentStep === s
            ? 'bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] text-white shadow-lg scale-110'
            : currentStep > s
              ? 'bg-purple-500/40 text-white/70'
              : 'bg-purple-500/20 text-white/40'
        ]"
      >
        {{ s }}
      </div>
    </div>

    <!-- Configuration Summary -->
    <div v-if="currentStep > 1 && currentStep < 4" class="mb-6 space-y-1">
      <p class="text-sm">
        <span class="font-semibold text-white">{{ leaderboardSummary.name }}</span>
      </p>
      <p v-if="currentStep > 2" class="text-sm text-white/40">
        <span class="font-semibold text-white/40">{{ leaderboardSummary.is_public ? 'Public' : 'Private' }}</span>
      </p>
    </div>
    <div v-if="currentStep > 1 && currentStep < 4" class="h-px bg-white/10 mb-6"></div>

    <!-- Step 1: Name -->
    <div v-if="currentStep === 1" class="space-y-6 animate-fade-in">
      <div>
        <h3 class="text-white font-bold text-lg mb-2">Leaderboard name</h3>

        <div class="space-y-2">
          <input
              v-model="leaderboardName"
              type="text"
              placeholder=""
              class="form-input text-sm"
              @keyup.enter="verifyName"
          />
          <p class="text-xs text-white/60 px-1">
            Maximum 30 characters. Single or multiple words are allowed
          </p>
        </div>

        <div v-if="nameError" class="mt-2 text-xs text-red-400 px-1">
          {{ nameError }}
        </div>

        <div v-if="!verifyingName" class="w-full flex justify-center mt-2">
          <button
              @click="verifyName"
              :disabled="!leaderboardName"
              class="btn-common-button"
          >
            Verify
          </button>
        </div>
        <div v-else class="w-full py-4 flex items-center justify-center">
          <span class="dots-loader" role="img" aria-label="Checking">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </span>
        </div>
      </div>
    </div>

    <!-- Step 2: Visibility -->
    <div v-if="currentStep === 2" class="space-y-6 animate-fade-in">

      <div class="grid grid-cols-1 gap-4">
        <button
            @click="isPublic = false; currentStep = 3"
            class="flex items-start gap-4 p-4 rounded-xl border transition-all text-left bg-white/5 border-white/10 hover:bg-white/10"

        >
          <div class="p-3 rounded-2xl bg-gradient-to-tr from-purple-600 to-orange-600 text-white">
            <LockClosedIcon class="w-6 h-6"/>
          </div>
          <div>
            <div class="text-white font-bold">Private leaderboard</div>
            <p class="text-indigo-200/60 text-xs mt-1">Only people you invite can join</p>
          </div>
        </button>

        <button
            @click="isPublic = true; currentStep = 3"
            class="flex items-start gap-4 p-4 rounded-xl border transition-all text-left bg-white/5 border-white/10 hover:bg-white/10"
        >
          <div class="p-3 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 text-white">
            <UserGroupIcon class="w-6 h-6"/>
          </div>
          <div>
            <div class="text-white font-bold">Public leaderboard</div>
            <p class="text-indigo-200/60 text-xs mt-1">Anyone can find and join your board</p>
          </div>
        </button>
      </div>

      <div class="mt-8 flex justify-end">
        <button
            @click="currentStep = 1"
            class="btn-common-button"
        >
          Back
        </button>
      </div>

    </div>

    <!-- Step 3: Members & Admins -->
    <div v-if="currentStep === 3" class="space-y-6 animate-fade-in pb-10">

      <!-- Admins -->
      <div class="mb-8">
        <label class="block text-sm font-bold text-indigo-100 mb-3 flex items-center gap-2">
          Owners
        </label>

        <div class="space-y-2 mb-4">
          <!-- Me (current user) -->
          <div class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
            <div class="flex items-center gap-3">
              <span class="text-indigo-300/40 text-sm ml-1">{{ ownerEmail }}</span>
            </div>
          </div>

          <div v-for="(admin, idx) in admins" :key="idx"
               class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 animate-fade-in">
            <span class="text-white">{{ admin }}</span>
            <button @click="removeAdmin(idx)" class="text-white/20 hover:text-red-400 transition-colors">
              <XMarkIcon class="w-5 h-5"/>
            </button>
          </div>
        </div>

        <div class="relative">
          <input
              v-model="newAdminInput"
              type="email"
              placeholder="Add another owner’s email"
              class="form-input py-3 pl-4 pr-12"
              @keyup.enter="handleAddAdmin"
              @input="memberError = null"
          />
          <button @click="handleAddAdmin"
                  class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-200/80 hover:text-white transition-colors">
            <PlusIcon class="w-5 h-5"/>
          </button>
        </div>

        <div v-if="memberError && newAdminInput" class="mt-2 text-xs text-red-400 px-1">
          {{ memberError }}
        </div>
      </div>

      <!-- Members -->
      <div>
        <label class="block text-sm font-bold text-indigo-100 mb-3">Members</label>

        <div v-if="members.length > 0" class="space-y-2 mb-4">
          <div v-for="(member, idx) in members" :key="idx"
               class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 animate-fade-in">
            <span class="text-white">{{ member }}</span>
            <button @click="removeMember(idx)" class="text-white/20 hover:text-red-400 transition-colors">
              <XMarkIcon class="w-5 h-5"/>
            </button>
          </div>
        </div>

        <div class="relative">
          <input
              v-model="newMemberInput"
              type="email"
              placeholder="Add another members’s email"
              class="form-input py-3 pl-4 pr-12"
              @keyup.enter="handleAddMember"
              @input="memberError = null"
          />
          <button @click="handleAddMember"
                  class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-200/80 hover:text-white transition-colors">
            <PlusIcon class="w-5 h-5"/>
          </button>
        </div>

        <div v-if="memberError && newMemberInput" class="mt-2 text-xs text-red-400 px-1">
          {{ memberError }}
        </div>
      </div>

      <div class="mt-10 grid grid-cols-[1fr_auto_1fr] items-center">
        <div></div>
        <button
            @click="currentStep = 4"
            class="btn-common-button justify-self-center"
        >
          Next
        </button>
        <button
            @click="currentStep = 2"
            class="btn-common-button justify-self-end"
        >
          Back
        </button>
      </div>
    </div>

    <!-- Step 4: Summary / Success -->
    <div v-if="currentStep === 4" class="space-y-6 animate-fade-in pb-10">
      <div v-if="success" class="w-full max-w-md text-center mx-auto space-y-8 py-4">
        <div class="p-8">
          <div class="flex justify-center mb-6">
          </div>
          <h3 class="text-xl font-bold text-white mb-3 tracking-tight">Leaderboard created</h3>
          <p class="text-indigo-200/70 text-sm leading-relaxed">
            Your new leaderboard <span class="text-white font-semibold">"{{ leaderboardSummary.name }}"</span> has been created successfully
          </p>
        </div>
        <router-link
            v-if="createdId"
            :to="{ name: 'leaderboard-detail', params: { id: createdId }, query: { from: 'manage' } }"
            class="btn-common-button inline-flex items-center justify-center min-w-[200px]"
        >
          View leaderboard
        </router-link>
      </div>

      <div v-else class="space-y-6">
        <div class="w-full max-w-xl mx-auto p-5 sm:p-6">
          <div class="space-y-4 text-sm text-white/90">
            <div class="flex items-center justify-between gap-3">
              <span class="text-white">Name</span>
              <span class="font-semibold text-white/50 text-right break-words">{{ leaderboardSummary.name }}</span>
            </div>
            <div class="h-px bg-white/10"></div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-white">Type</span>
              <span class="font-semibold text-white/50">{{ leaderboardSummary.is_public ? 'Public' : 'Private' }}</span>
            </div>
            <div class="h-px bg-white/10"></div>
            <div class="space-y-2">
              <p class="text-white">Owners</p>
              <div v-if="leaderboardSummary.owners.length" class="space-y-1">
                <p v-for="(owner, index) in leaderboardSummary.owners" :key="`owner-${index}`" class="font-semibold text-white/50 break-words">
                  {{ owner }}
                </p>
              </div>
              <p v-else class="font-semibold text-white/70">None</p>
            </div>
            <div class="h-px bg-white/10"></div>
            <div class="space-y-2">
              <p class="text-white">Members</p>
              <div v-if="leaderboardSummary.members.length" class="space-y-1">
                <p v-for="(member, index) in leaderboardSummary.members" :key="`member-${index}`" class="font-semibold text-white/50 break-words">
                  {{ member }}
                </p>
              </div>
              <p v-else class="font-semibold text-white/70">None</p>
            </div>
          </div>
        </div>

        <div v-if="submitting" class="w-full py-6 flex items-center justify-center">
          <span class="dots-loader" role="img" aria-label="Submitting">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </span>
        </div>
        <div v-else class="w-full max-w-xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center">
          <div></div>
          <button
            @click="handleCreate"
            class="btn-common-button justify-self-center"
          >
            Create
          </button>
          <button
            @click="currentStep = 3"
            class="btn-common-button justify-self-end"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
