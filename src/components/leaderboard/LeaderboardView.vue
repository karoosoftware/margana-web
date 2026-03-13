<script setup lang="ts">
import {onMounted, ref, computed, watch} from 'vue'
import {useRouter, useRoute} from 'vue-router'
import {useMarganaAuth} from '@/composables/useMarganaAuth'
import AppCard from '@/components/AppCard.vue'
import ConfirmationModal from '@/components/overlays/ConfirmationModal.vue'
import LeaderboardScoreTable from '@/components/leaderboard/LeaderboardScoreTable.vue'
import {useLeaderboard} from '@/composables/useLeaderboard'
import {
  UserIcon,
  GlobeAltIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  CheckIcon,
  XMarkIcon,
  ArrowLeftOnRectangleIcon,
  ArrowUturnLeftIcon,
  TrashIcon,
  ClockIcon,
  TrophyIcon,
  PlusIcon,
  EnvelopeIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  UserPlusIcon
} from '@heroicons/vue/20/solid'

const props = defineProps<{
  id: string
}>()

const router = useRouter()
const route = useRoute()
const {userSub} = useMarganaAuth()
const {
  currentLeaderboard,
  loadingDetail,
  detailError,
  detailErrorCode,
  fetchLeaderboardDetail,
  joinRequests,
  loadingRequests,
  requestsError,
  fetchJoinRequests,
  resolveJoinRequest,
  leaderboardScores,
  resolveInvitation,
  leaveLeaderboard,
  deleteLeaderboard,
  updateLeaderboardSettings,
  checkLeaderboardName,
  kickMember,
  promoteMember,
  inviteMember,
  fetchLeaderboardScores,
  loadingScores,
  resetLeaderboardDetail,
  historicalStandings,
  loadingHistory,
  fetchLeaderboardHistory,
  historyError
} = useLeaderboard()

const showHistory = ref(false)
const newName = ref('')
const verifyingName = ref(false)
const updatingName = ref(false)
const nameError = ref<string | null>(null)
const nameSuccess = ref(false)
const isEditingName = ref(false)
const isInvitingMember = ref(false)

const inviteEmail = ref('')
const inviting = ref(false)
const inviteError = ref<string | null>(null)
const inviteSuccess = ref(false)

const kickingId = ref<string | null>(null)
const promotingId = ref<string | null>(null)

const resolvingId = ref<string | null>(null)
const processingRequest = ref<string | null>(null)
const leaving = ref(false)
const deleting = ref(false)
const showDeleteConfirm = ref(false)
const showLeaveConfirm = ref(false)
const showKickConfirm = ref(false)
const showPromoteConfirm = ref(false)
const memberToKick = ref<{ sub: string; label: string } | null>(null)
const memberToPromote = ref<{ sub: string; label: string } | null>(null)

const isSystemBoard = computed(() => props.id === 'play-margana')
const canManage = computed(() => !isSystemBoard.value && currentLeaderboard.value?.role === 'admin')
const isInvited = computed(() => currentLeaderboard.value?.status === 'invited')
const isPending = computed(() => currentLeaderboard.value?.status === 'pending')
const isLastAdmin = computed(() => {
  if (isSystemBoard.value || !currentLeaderboard.value) return false
  return currentLeaderboard.value.role === 'admin' && currentLeaderboard.value.admin_count === 1
})

const isDataLoading = computed(() => {
  // We only show the global loading dots if we have NO data to display yet.
  // This prevents the entire view from "jumping" during background updates
  // (like after kicking/promoting a member or resolving a request).
  if (!currentLeaderboard.value) return true
  
  const isMember = currentLeaderboard.value.role !== 'none' && 
                   currentLeaderboard.value.status !== 'invited' && 
                   currentLeaderboard.value.status !== 'pending'
  
  // If we are a member but haven't fetched any scores yet, show the loader
  if (isMember && loadingScores.value && Object.keys(leaderboardScores.value).length === 0) {
    return true
  }
  
  return false
})

const filterOptions = [
  { id: 'admin', label: 'Owner', color: 'bg-gradient-to-tr from-indigo-500 to-violet-600' },
  { id: 'member', label: 'Member', color: 'bg-gradient-to-tr from-indigo-600 to-fuchsia-600' },
  { id: 'public', label: 'Public', color: 'bg-gradient-to-tr from-purple-500 to-fuchsia-600' },
  { id: 'private', label: 'Private', color: 'bg-gradient-to-tr from-purple-600 to-orange-600' }
]

const getFilterColor = (id: 'admin' | 'member' | 'public' | 'private') =>
  filterOptions.find(option => option.id === id)?.color ?? 'bg-white/10'

const canLeaveLeaderboard = computed(() =>
    currentLeaderboard.value?.role !== 'none' &&
    !isInvited.value &&
    !isPending.value &&
    !isSystemBoard.value &&
    !isLastAdmin.value
)

const backRoute = computed(() => {
  const from = route.query.from
  if (from === 'public') return { name: 'leaderboards', query: { tab: 'public' } }
  if (from === 'manage') return { name: 'leaderboards', query: { tab: 'manage' } }
  return { name: 'leaderboards', query: { tab: 'my' } }
})

const toggleHistory = async () => {
  showHistory.value = !showHistory.value
  if (showHistory.value) {
    await fetchLeaderboardHistory(props.id)
  }
}

const loadData = async (force = false) => {
  // If not a forced refresh (initial mount or ID change), reset to Live view
  if (!force) {
    resetLeaderboardDetail()
    showHistory.value = false
  }
  
  await fetchLeaderboardDetail(props.id, force)

  // If we are currently showing history, refresh history data instead of live scores
  if (showHistory.value) {
    await fetchLeaderboardHistory(props.id, undefined, force)
    return
  }
  
  const isMember = currentLeaderboard.value && 
                   currentLeaderboard.value.role !== 'none' && 
                   currentLeaderboard.value.status !== 'invited' && 
                   currentLeaderboard.value.status !== 'pending'
  
  const promises = []
  if (isMember) {
    promises.push(fetchLeaderboardScores(props.id, force))
  }

  // Disabled this for now as we are not managing join requests yet
  // if (canManage.value) {
  //   promises.push(fetchJoinRequests(props.id, force))
  // }
  
  if (promises.length > 0) {
    await Promise.all(promises)
  }
}

onMounted(() => {
  loadData()
})

watch(() => props.id, () => {
  loadData()
})

const handleResolveInvitation = async (action: 'accept' | 'deny') => {
  resolvingId.value = props.id
  try {
    await resolveInvitation(props.id, action)
    if (action === 'deny') {
      router.push({name: 'leaderboards', query: {tab: 'my'}})
    } else {
      await loadData()
    }
  } catch (err) {
    console.error('Failed to resolve invitation:', err)
  } finally {
    resolvingId.value = null
  }
}

const handleResolveRequest = async (userSub: string, action: 'approve' | 'deny') => {
  processingRequest.value = userSub
  try {
    await resolveJoinRequest(props.id, userSub, action)
    await fetchLeaderboardDetail(props.id) // Refresh counts
  } catch (err) {
    console.error('Failed to resolve request:', err)
  } finally {
    processingRequest.value = null
  }
}

const handleLeave = async () => {
  if (isLastAdmin.value) return
  leaving.value = true
  try {
    await leaveLeaderboard(props.id)
    showLeaveConfirm.value = false
    router.push({name: 'leaderboards', query: {tab: 'my'}})
  } catch (err) {
    console.error('Failed to leave:', err)
  } finally {
    leaving.value = false
  }
}

const handleDelete = async () => {
  deleting.value = true
  try {
    await deleteLeaderboard(props.id)
    router.push({name: 'leaderboards', query: {tab: 'my'}})
  } catch (err) {
    console.error('Failed to delete:', err)
  } finally {
    deleting.value = false
  }
}

const handleRename = async () => {
  nameError.value = null
  nameSuccess.value = false
  const name = newName.value.trim()

  if (!name) {
    nameError.value = 'Please enter a name'
    return
  }

  if (name === currentLeaderboard.value?.name) {
    isEditingName.value = false
    return
  }

  verifyingName.value = true
  try {
    const check = await checkLeaderboardName(name)
    if (!check.available) {
      nameError.value = check.error || 'Name is already taken'
      return
    }

    updatingName.value = true
    await updateLeaderboardSettings(props.id, {name})
    nameSuccess.value = true
    isEditingName.value = false
    setTimeout(() => {
      nameSuccess.value = false
    }, 3000)
  } catch (err: any) {
    nameError.value = err.message || 'Failed to rename'
  } finally {
    verifyingName.value = false
    updatingName.value = false
  }
}

const startEditingName = () => {
  newName.value = currentLeaderboard.value?.name || ''
  isEditingName.value = true
  nameError.value = null
}

const startInviting = () => {
  inviteEmail.value = ''
  isInvitingMember.value = true
  inviteError.value = null
}

const handleInvite = async () => {
  inviteError.value = null
  inviteSuccess.value = false
  const email = inviteEmail.value.trim().toLowerCase()
  if (!email) return

  inviting.value = true
  try {
    await inviteMember(props.id, email)
    inviteSuccess.value = true
    inviteEmail.value = ''
    isInvitingMember.value = false
    setTimeout(() => {
      inviteSuccess.value = false
    }, 3000)
  } catch (err: any) {
    inviteError.value = err.message || 'Failed to send invite'
  } finally {
    inviting.value = false
  }
}

const handleKick = (userSub: string) => {
  memberToKick.value = {
    sub: userSub,
    label: currentLeaderboard.value?.user_labels[userSub] || 'this member'
  }
  showKickConfirm.value = true
}

const confirmKick = async () => {
  if (!memberToKick.value) return
  const sub = memberToKick.value.sub
  kickingId.value = sub
  try {
    await kickMember(props.id, sub)
    showKickConfirm.value = false
    memberToKick.value = null
  } catch (err) {
    console.error('Failed to kick member:', err)
  } finally {
    kickingId.value = null
  }
}

const handlePromote = (userSub: string) => {
  memberToPromote.value = {
    sub: userSub,
    label: currentLeaderboard.value?.user_labels[userSub] || 'this member'
  }
  showPromoteConfirm.value = true
}

const confirmPromote = async () => {
  if (!memberToPromote.value) return
  const sub = memberToPromote.value.sub
  promotingId.value = sub
  try {
    await promoteMember(props.id, sub)
    showPromoteConfirm.value = false
    memberToPromote.value = null
  } catch (err) {
    console.error('Failed to promote member:', err)
  } finally {
    promotingId.value = null
  }
}

const formatRole = (role?: string) =>
    role ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : ''
</script>

<template>
  <div class="leaderboard-view w-full max-w-2xl mx-auto">
    <!-- Loading State -->
    <div v-if="isDataLoading && !detailError"
         class="flex flex-col items-center justify-center p-12 text-white/60">
      <div class="dots-loader mb-4">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="detailError" class="px-3 sm:px-4">
      <AppCard title="Leaderboard unavailable">
        <div class="text-center space-y-4 p-2 text-white">
          <template v-if="detailErrorCode === 403">
            <p>You do not have permission or your permission has been removed from this leaderboard</p>
          </template>
          <template v-else-if="detailErrorCode === 404">
            <p>This leaderboard no longer exists</p>
          </template>
          <template v-else>
            <p>{{ detailError }}</p>
            <button
                @click="fetchLeaderboardDetail(props.id)"
                class="btn-common-button"
            >
              Try Again
            </button>
          </template>

          <div class="pt-2">
            <router-link
                :to="backRoute"
                class="btn-common-button inline-flex items-center justify-center"
            >
              Back to leaderboards
            </router-link>
          </div>
        </div>
      </AppCard>
    </div>

    <!-- Content -->
    <AppCard v-else-if="currentLeaderboard">
      <template #title>
        <div class="flex flex-col items-start gap-1 sm:gap-1 group/title w-full">
          <template v-if="!isEditingName && !isInvitingMember">
            <!-- Row 1: Name + quick edit (always visible) -->
            <div class="flex items-center justify-between gap-2 w-full min-[1101px]:w-auto">
              <span class="min-w-0 truncate text-base sm:text-xl">{{ currentLeaderboard.name }}</span>
              <button
                  v-if="canManage && !showHistory"
                  @click="startEditingName"
                  class="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  title="Rename leaderboard"
              >
                <PencilIcon class="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <!-- Other actions: visible inline on sm+ only -->
              <button
                  v-if="canManage && !showHistory"
                  @click="startInviting"
                  class="hidden min-[1101px]:inline-flex p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  title="Invite member"
              >
                <UserPlusIcon class="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                  v-if="isLastAdmin && !showHistory"
                  @click="showDeleteConfirm = true"
                  class="hidden min-[1101px]:inline-flex p-1 rounded text-white/40 hover:text-white transition-all"
                  title="Delete leaderboard"
              >
                <TrashIcon class="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                  v-else-if="canLeaveLeaderboard && !showHistory"
                  @click="showLeaveConfirm = true"
                  class="hidden min-[1101px]:inline-flex p-1 rounded text-white hover:scale-130 transition-transform duration-200 flex-shrink-0"
                  title="Leave leaderboard"
              >
                <TrashIcon class="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <div class="min-[1101px]:hidden ml-auto flex items-center gap-1.5">
                <span
                    class="text-white text-xs px-2.5 py-1.5 rounded-full tracking-wider"
                    :class="getFilterColor(currentLeaderboard.is_public ? 'public' : 'private')"
                >
                  {{ currentLeaderboard.role === 'admin' ? 'Owner' : formatRole(currentLeaderboard.role) }}/{{ currentLeaderboard.is_public ? 'Public' : 'Private' }}
                </span>
              </div>
            </div>

            <!-- Row 2 (mobile only): other actions + tags -->
            <div class="mt-1 min-[1101px]:hidden flex items-center justify-between w-full">
              <button
                v-if="currentLeaderboard.role !== 'none' && !isInvited && !isPending && (currentLeaderboard.has_history || showHistory)"
                @click="toggleHistory"
                :title="showHistory ? 'Show current leaderboard' : 'Show last week leaderboard'"
                :aria-label="showHistory ? 'Show current leaderboard' : 'Show last week leaderboard'"
                class="h-8 pl-0 pr-1 -ml-5 rounded transition-all inline-flex items-center justify-center text-white/80 hover:text-white"
              >
                <span v-if="showHistory" class="inline-flex items-center gap-1 text-sm font-semibold">
                  <ChevronRightIcon class="w-5 h-5" />
                  <span>This week's score</span>
                </span>
                <span v-else class="inline-flex items-center gap-1 text-sm font-semibold">
                  <ChevronLeftIcon class="w-5 h-5" />
                  <span>Last week's score</span>
                </span>
              </button>
              <span v-else class="h-8"></span>
              <div class="flex items-center gap-3">
                <button
                    v-if="canManage && !showHistory"
                    @click="startInviting"
                    class="p-1 rounded text-white/70 hover:text-white hover:bg-white/10 transition-all"
                    title="Invite member"
                >
                  <UserPlusIcon class="w-6 h-6" />
                </button>
                <button 
                  @click="loadData(true)"
                  class="p-1 rounded text-white/70 hover:text-white transition-all flex items-center justify-center"
                  :class="{ 'animate-spin': loadingDetail || loadingScores || loadingRequests || loadingHistory }"
                  title="Refresh"
                >
                  <ArrowPathIcon class="w-6 h-6" />
                </button>
                <button
                    v-if="isLastAdmin && !showHistory"
                    @click="showDeleteConfirm = true"
                    class="p-1 rounded text-white/70 hover:text-white transition-all"
                    title="Delete leaderboard"
                >
                  <TrashIcon class="w-6 h-6" />
                </button>
                <button
                    v-else-if="canLeaveLeaderboard && !showHistory"
                    @click="showLeaveConfirm = true"
                    class="p-1 rounded text-white hover:scale-130 transition-transform duration-200 flex-shrink-0"
                    title="Leave leaderboard"
                >
                  <TrashIcon class="w-6 h-6" />
                </button>
              </div>
            </div>
            <div class="hidden min-[1101px]:flex mt-1 w-full">
              <button
                v-if="currentLeaderboard.role !== 'none' && !isInvited && !isPending && (currentLeaderboard.has_history || showHistory)"
                @click="toggleHistory"
                :title="showHistory ? 'Show live results' : 'Show last week results'"
                :aria-label="showHistory ? 'Show live results' : 'Show last week results'"
                class="pl-0 pr-1 -ml-5 rounded transition-all inline-flex items-center justify-start text-white/80 hover:text-white"
              >
                <span v-if="showHistory" class="inline-flex items-center gap-1 text-sm font-semibold">
                  <ChevronRightIcon class="w-5 h-5" />
                  <span>This week's score</span>
                </span>
                <span v-else class="inline-flex items-center gap-1 text-sm font-semibold">
                  <ChevronLeftIcon class="w-5 h-5" />
                  <span>Last week's score</span>
                </span>
              </button>
            </div>
          </template>
          <div v-else-if="isEditingName" class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 flex-1 w-full">
            <input
                v-model="newName"
                type="text"
                class="form-input py-0.5 px-2 text-sm bg-white/5 border-white/10 w-full min-w-0 sm:min-w-[24rem]"
                placeholder="Enter new name"
                @keyup.enter="handleRename"
                @keyup.esc="isEditingName = false"
                autofocus
            />
            <button
                @click="handleRename"
                :disabled="verifyingName || updatingName"
                class="p-1 rounded text-white hover:scale-130 transition-transform duration-200 flex-shrink-0"
                title="Save"
            >
              <CheckIcon v-if="!verifyingName && !updatingName" class="w-5 h-5" />
              <ArrowPathIcon v-else class="w-5 h-5 animate-spin" />
            </button>
            <button
                @click="isEditingName = false"
                :disabled="verifyingName || updatingName"
                class="p-1 rounded text-white hover:scale-130 transition-transform duration-200 flex-shrink-0"
                title="Cancel"
            >
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>
          <div v-else-if="isInvitingMember" class="flex items-center gap-2 flex-1">
            <input
                v-model="inviteEmail"
                type="email"
                class="form-input py-0.5 px-2 text-sm bg-white/5 border-white/10 w-full min-w-0 sm:min-w-[24rem]"
                placeholder="Enter email to invite"
                @keyup.enter="handleInvite"
                @keyup.esc="isInvitingMember = false"
                autofocus
            />
            <button
                @click="handleInvite"
                :disabled="inviting"
                class="p-1 rounded text-white hover:scale-130 transition-transform duration-200 flex-shrink-0"
                title="Send invite"
            >
              <CheckIcon v-if="!inviting" class="w-5 h-5" />
              <ArrowPathIcon v-else class="w-5 h-5 animate-spin" />
            </button>
            <button
                @click="isInvitingMember = false"
                :disabled="inviting"
                class="p-1 rounded text-white hover:scale-130 transition-transform duration-200 flex-shrink-0"
                title="Cancel"
            >
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>
        </div>
        <div v-if="isEditingName && nameError" class="text-red-400 text-[10px] font-bold mt-1">
          {{ nameError }}
        </div>
        <div v-if="isInvitingMember && inviteError" class="text-red-400 text-[10px] font-bold mt-1">
          {{ inviteError }}
        </div>
        <div v-if="inviteSuccess" class="text-white text-[10px] font-bold mt-1">
          ✓ Invitation sent!
        </div>
      </template>
      <template #header-right>
        <div class="hidden min-[1101px]:flex items-center gap-2">
          <!-- Refresh -->
          <button 
            @click="loadData(true)"
            class="p-1 rounded text-white/40 hover:text-white  transition-all flex items-center justify-center"
            :class="{ 'animate-spin': loadingDetail || loadingScores || loadingRequests || loadingHistory }"
            title="Refresh"
          >
            <ArrowPathIcon class="w-5 h-5" />
          </button>

          <span
              class="text-white text-xs px-1.5 py-0.5 rounded-lg tracking-wider"
              :class="getFilterColor(currentLeaderboard.is_public ? 'public' : 'private')"
          >
            {{ currentLeaderboard.role === 'admin' ? 'Owner' : formatRole(currentLeaderboard.role) }}/{{ currentLeaderboard.is_public ? 'Public' : 'Private' }}
          </span>
        </div>
      </template>

      <div class="space-y-6">
        <!-- Invitation Banner -->
<!--        <div v-if="isInvited"-->
<!--             class="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">-->
<!--          <div class="flex items-center gap-3">-->
<!--            <div class="p-2 rounded-full bg-purple-500/20 text-purple-300">-->
<!--              <ClockIcon class="w-5 h-5"/>-->
<!--            </div>-->
<!--            <div>-->
<!--              <p class="text-white font-bold text-sm">You've been invited!</p>-->
<!--              <p class="text-white/60 text-xs">Would you like to join this leaderboard?</p>-->
<!--            </div>-->
<!--          </div>-->
<!--          <div class="flex items-center gap-2 w-full sm:w-auto">-->
<!--            <button-->
<!--                @click="handleResolveInvitation('accept')"-->
<!--                :disabled="!!resolvingId"-->
<!--                class="btn-common-button-small"-->
<!--            >-->
<!--              {{ resolvingId ? '...' : 'Accept' }}-->
<!--            </button>-->
<!--            <button-->
<!--                @click="handleResolveInvitation('deny')"-->
<!--                :disabled="!!resolvingId"-->
<!--                class="btn-common-button-small"-->
<!--            >-->
<!--              Deny-->
<!--            </button>-->
<!--          </div>-->
<!--        </div>-->

        <!-- Pending Approval Banner -->
<!--        <div v-if="isPending"-->
<!--             class="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex items-center gap-3">-->
<!--          <div class="p-2 rounded-full bg-orange-500/20 text-orange-300">-->
<!--            <ClockIcon class="w-5 h-5"/>-->
<!--          </div>-->
<!--          <div>-->
<!--            <p class="text-white font-bold text-sm">Membership Pending</p>-->
<!--            <p class="text-white/60 text-xs">An owner needs to approve your request before you can see all scores.</p>-->
<!--          </div>-->
<!--        </div>-->


        <!-- Join Requests (Admin Only) -->
<!--        <div v-if="canManage && (joinRequests.length > 0 || loadingRequests)" class="space-y-3">-->
<!--          <h4 class="text-white/60 text-[10px] font-bold tracking-widest px-1">Join Requests</h4>-->
<!--          <div v-if="loadingRequests" class="p-4 text-center text-white/40 text-xs">Loading requests...</div>-->
<!--          <div v-else class="space-y-2">-->
<!--            <div v-for="req in joinRequests" :key="req.user_sub"-->
<!--                 class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">-->
<!--              <div class="min-w-0">-->
<!--                <p class="text-white font-semibold text-sm truncate">{{-->
<!--                    req.user_label || req.user_sub.slice(0, 8)-->
<!--                  }}</p>-->
<!--                <p class="text-white/40 text-[10px] tracking-wider">Requested-->
<!--                  {{ new Date(req.created_at).toLocaleDateString() }}</p>-->
<!--              </div>-->
<!--              <div class="flex items-center gap-2">-->
<!--                <button-->
<!--                    @click="handleResolveRequest(req.user_sub, 'approve')"-->
<!--                    :disabled="!!processingRequest"-->
<!--                    class="btn-common-button-small"-->
<!--                >-->
<!--                  <CheckIcon class="w-4 h-4"/>-->
<!--                </button>-->
<!--                <button-->
<!--                    @click="handleResolveRequest(req.user_sub, 'deny')"-->
<!--                    :disabled="!!processingRequest"-->
<!--                    class="btn-common-button-small"-->
<!--                >-->
<!--                  <XMarkIcon class="w-4 h-4"/>-->
<!--                </button>-->
<!--              </div>-->
<!--            </div>-->
<!--          </div>-->
<!--        </div>-->

        <!-- Weekly Score Comparison (Visible to members only) -->
        <div v-if="currentLeaderboard.role !== 'none' && !isInvited && !isPending" class="pt-6">
          <LeaderboardScoreTable :id="props.id" :is-history="showHistory" @kick="handleKick"/>
        </div>
      </div>
    </AppCard>

    <!-- Delete Leaderboard Confirmation -->
    <ConfirmationModal
        :show="showDeleteConfirm"
        title="Delete leaderboard?"
        confirm-label="Delete"
        :loading="deleting"
        loading-label="Deleting"
        @confirm="handleDelete"
        @cancel="showDeleteConfirm = false"
    >
      <p>This will permanently remove the leaderboard and all its data. This action cannot be undone</p>
    </ConfirmationModal>

    <!-- Leave Leaderboard Confirmation -->
    <ConfirmationModal
        :show="showLeaveConfirm"
        title="Leaving leaderboard"
        confirm-label="Leave"
        :loading="leaving"
        loading-label="Leaving..."
        @confirm="handleLeave"
        @cancel="showLeaveConfirm = false"
    >
      <p>Are you sure you want to leave <span class="text-white font-semibold">{{ currentLeaderboard?.name }}</span>?</p>
    </ConfirmationModal>

    <!-- Kick Member Confirmation -->
    <ConfirmationModal
        :show="showKickConfirm"
        title="Removing member"
        confirm-label="Remove"
        :loading="!!kickingId"
        loading-label="Deleting..."
        @confirm="confirmKick"
        @cancel="showKickConfirm = false; memberToKick = null"
    >
      <p>Are you sure you want to remove <span class="text-white font-semibold">{{ memberToKick?.label }}</span> from this leaderboard?</p>
    </ConfirmationModal>

    <!-- Promote Member Confirmation -->
    <ConfirmationModal
        :show="showPromoteConfirm"
        title="Promote member?"
        confirm-label="Promote"
        :loading="!!promotingId"
        loading-label="Promoting..."
        @confirm="confirmPromote"
        @cancel="showPromoteConfirm = false; memberToPromote = null"
    >
      <p>Are you sure you want to promote <span class="text-white font-semibold">{{ memberToPromote?.label }}</span> to Owner?</p>
    </ConfirmationModal>
  </div>
</template>

<style scoped>
.leaderboard-view {
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
