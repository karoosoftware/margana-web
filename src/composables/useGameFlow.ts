import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed, type Ref } from 'vue'
import { fetchAuthSession } from 'aws-amplify/auth'
import { post } from 'aws-amplify/api'
import { getUrl } from 'aws-amplify/storage'
import { API, Bucket } from '@/config/api'
import * as ML from '@/utils/marganaLogic'
import { composeRowWordFromGrids, sanitizeLetter } from '@/utils/highlightUtils'
import { clearPuzzleState } from '@/utils/persist'
import { precheckRowsAndAnagram } from "@/services/wordValidation/liveScoringPrecheck"
import { liveScoringDecisionAndFetch } from '@/services/liveScoring/liveScoringClient'
import { type MarganaGameSession } from './useMarganaGame'
import { useRegisteredMetrics } from './useRegisteredMetrics'
import { useMarganaAuth } from './useMarganaAuth'
import { getMadnessCelebrationEffect } from '@/services/celebration/celebrationLogic'

export function useGameFlow(session: MarganaGameSession, options: {
    puzzleDateStr: Ref<string>,
    isAuthenticated: Ref<boolean>,
    userSub: Ref<string>,
    guestId: Ref<string>,
    activeAnagramBuilder: Ref<any>,
    loadPuzzle: () => Promise<void>,
    loadLetterScores: () => Promise<void>,
    buildEditableGrid: () => void,
    dispatchUsage: (name: string, data: any) => void,
    hasSeenTutorial: () => boolean,
    triggerTutorial: () => void,
    cleanupOldDrafts: (days: number) => void,
    showAccountBenefits: Ref<boolean>,
    needsTermsAcceptance: Ref<boolean>,
    authInitialized: Ref<boolean>,
    landscapeMobileMode: Ref<boolean>,
    settingsEnableLiveScoring: Ref<boolean>,
    settingsEnableWildcardBypass: Ref<boolean>,
    typingAgg: any,
    highlightAgg: any,
    shuffleAgg: any,
    loadPuzzleState: (dateStr: string) => any
}) {
    const error = ref(null)
    const newAchievements = ref([])
    const submitUsageSent = ref(false)

    const { saveToCache, invalidateCache } = useRegisteredMetrics()

    function buildMarganaPayload(overrideOpts: any = {}) {
        return ML.buildMarganaPayload({
            baseGrid: session.baseGrid.value,
            editableGrid: session.gm.editableGrid.value,
            puzzle: session.puzzle.value,
            settingsEnableWildcardBypass: options.settingsEnableWildcardBypass,
            rowHasWildcardFn: session.gm.rowHasWildcard,
            isVerticalTargetCellFn: session.am.isVerticalTargetCell,
            isDiagonalCellFn: session.am.isDiagonalCell,
            guestId: options.guestId,
            colIndex: session.am.colIndex,
            latestBuilderSnapshot: overrideOpts.latestBuilderSnapshot || session.am.latestBuilderSnapshot.value,
            builderWord: overrideOpts.anagramWord || session.am.builderWord.value
        })
    }

    async function callLiveScoring(opts: any = {}) {
        const payload = buildMarganaPayload(opts)
        const result = await liveScoringDecisionAndFetch(
            payload,
            opts,
            {
                precheckRowsAndAnagram,
                fetchAuthSession,
                fetch: window.fetch.bind(window),
                post,
                apiUrls: API,
                rowValid: session.gm.rowValid.value
            },
            session.score.value ?? 0
        )

        const data = result.data
        if (data && typeof data.total_score === 'number') {
            session.score.value = data.total_score
            session.schedulePersist()
        }
        if (data && data.anagram_result && typeof data.anagram_result.score === 'number') {
            session.am.anagramVerifiedPoints.value = data.anagram_result.score
        }
        if (result.mode === 'api' && data) {
            if (!!(session.puzzle.value?.madnessAvailable) && data.meta && !data.meta.madnessFound) {
                session.madnessSig.value = ''
            }
        }
        return data
    }

    async function submit() {
        if (session.posting.value) return

        error.value = null
        session.result.value = null
        session.posting.value = true

        let wordToVerify = ''
        try {
            wordToVerify = (options.activeAnagramBuilder.value?.getBuilderWord?.() || '').trim()
            if (!wordToVerify || wordToVerify.length < 1) {
                options.activeAnagramBuilder.value?.indicateError?.()
                session.posting.value = false
                return
            }
        } catch (e) {
            options.activeAnagramBuilder.value?.indicateError?.()
            session.posting.value = false
            return
        }

        try {
            const liveSnap = options.activeAnagramBuilder.value?.getBuilderSnapshot?.()
            const payload = buildMarganaPayload({
                anagramWord: wordToVerify,
                latestBuilderSnapshot: liveSnap
            })

            const result = await liveScoringDecisionAndFetch(
                payload,
                { useCommitEndpoint: true },
                {
                    precheckRowsAndAnagram,
                    fetchAuthSession,
                    fetch: window.fetch.bind(window),
                    post,
                    apiUrls: API,
                    rowValid: session.gm.rowValid.value
                },
                session.score.value ?? 0
            )

            const body = result.data

            if (result.mode === 'api' && result.reason === 'api_error') {
                throw new Error(result.meta.error || 'API Error')
            }

            if (body) {
                const accepted = !!(body && (body.commit_result?.accepted || (!options.isAuthenticated.value && body.anagram_result?.accepted)))
                if (!accepted) {
                    const summaries = Array.isArray(body?.row_summaries) ? body.row_summaries : []
                    if (summaries.length) {
                        for (let r = 0; r < summaries.length; r++) {
                            const rs = summaries[r]
                            const v = !!rs?.valid
                            if (Array.isArray(session.gm.rowValid.value)) session.gm.rowValid.value[r] = v
                            if (!v) {
                                session.errorRow.value = r
                                session.shakeRow.value = r
                                setTimeout(() => {
                                    if (session.shakeRow.value === r) session.shakeRow.value = null
                                }, 600)
                            }
                        }
                    }
                    const ar = body?.anagram_result
                    if (ar && ar.accepted === false) {
                        options.activeAnagramBuilder.value?.indicateError?.()
                    }
                    if (typeof body?.total_score === 'number') {
                        session.score.value = body.total_score
                        session.schedulePersist()
                    }
                    if (!!(session.puzzle.value?.madnessAvailable) && body && body.meta && !body.meta.madnessFound) {
                        session.madnessSig.value = ''
                    }
                    session.posting.value = false
                    return
                }

                session.result.value = body
                applySolvedFromSavedDoc(body)

                if (options.isAuthenticated.value) {
                    try {
                        if (body && body.metrics) {
                            newAchievements.value = body.metrics.new_achievements || []
                            await saveToCache(body.metrics)
                        } else {
                            newAchievements.value = []
                            await invalidateCache()
                        }
                    } catch (e) {
                        console.error('Failed to update metrics cache:', e)
                    }
                }

                session.showStatistics.value = true

                if (!options.isAuthenticated.value) {
                    try {
                        const dateStr = body?.meta?.date || getCurrentDateKey()
                        localStorage.setItem(`margana.result.${dateStr}`, JSON.stringify(body))
                    } catch (_) {}
                }

                try {
                    const dateStrFromPayload = String(body?.meta?.date || '')
                    const dateStr = (/^\d{4}-\d{2}-\d{2}$/.test(dateStrFromPayload) ? dateStrFromPayload : getCurrentDateKey())
                    if (dateStr) {
                        localStorage.removeItem(`margana.buys.${dateStr}`)
                    }
                } catch (_) {}

                if (!submitUsageSent.value) {
                    options.dispatchUsage('submit_puzzle', {
                        rows: payload?.meta?.rows,
                        cols: payload?.meta?.cols,
                        anagramLen: (payload?.meta?.userAnagram || '').length || null,
                    })
                    submitUsageSent.value = true
                    try {
                        // @ts-ignore
                        await window.marganaUsage?.forceFlush?.('critical')
                    } catch {}
                }

                try {
                    const today = new Date()
                    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                    window.dispatchEvent(new CustomEvent('margana-played-status', {
                        detail: {
                            date: dateStr,
                            hasPlayed: true,
                            result: body
                        }
                    }))
                } catch (_) {}

                await nextTick()
            }
        } catch (e) {
            console.error('Margana submit error', e)
            error.value = e?.message || String(e)
        } finally {
            session.posting.value = false
            if (session.result.value) {
                clearPuzzleState(options.puzzleDateStr.value)
            }
        }
    }

    function applySolvedFromSavedDoc(saved: any) {
        try {
            let rows = null
            if (Array.isArray(saved?.row_summaries)) {
                try {
                    const byIndex: any = {}
                    for (const s of saved.row_summaries) {
                        if (s && typeof s.row === 'number' && typeof s.word === 'string') {
                            byIndex[s.row] = s.word
                        }
                    }
                    const rCount = Number(saved?.meta?.rows) || session.baseGrid.value.length
                    rows = []
                    for (let r = 0; r < rCount; r++) {
                        const w = (byIndex[r] || '').toString()
                        rows[r] = w
                    }
                } catch (_) {}
            }
            if (rows && rows.length) {
                const rCount = rows.length
                const cCount = Number(saved?.meta?.cols) || (session.baseGrid.value?.[0]?.length || 0)

                if (!session.puzzle.value && saved?.meta) {
                    session.puzzle.value = {
                        date: saved.meta.date,
                        grid_rows: rows,
                        column_index: saved.meta.columnIndex,
                        diagonal_direction: saved.meta.diagonalDirection,
                        madnessAvailable: !!saved.meta.madnessAvailable,
                        longestAnagramCount: saved.meta.longestAnagramCount
                    }
                }

                for (let r = 0; r < rCount; r++) {
                    for (let c = 0; c < cCount; c++) {
                        if (!session.am.isTargetCell(r, c)) {
                            const ch = (rows[r]?.[c] || '').toString().toUpperCase().slice(0, 1)
                            if (ch) {
                                if (!session.gm.editableGrid.value?.[r]) session.gm.editableGrid.value[r] = []
                                session.gm.editableGrid.value[r][c] = ch
                            }
                        }
                    }
                }
            }
            let ua = saved?.meta?.userAnagram
            if ((!ua || typeof ua !== 'string') && Array.isArray(saved?.valid_words_metadata)) {
                const anaItem = saved.valid_words_metadata.find((it: any) => (it && (it.type === 'anagram'))) || null
                if (anaItem && anaItem.word) ua = String(anaItem.word)
            }
            if (ua && typeof ua === 'string') {
                session.am.builderWord.value = ua.toUpperCase()
                try {
                    options.activeAnagramBuilder.value?.setBuilderWord?.(session.am.builderWord.value)
                } catch (_) {}
            }

            // Populate score from result if available
            const totalScore = Number(saved?.total_score ?? saved?.totalScore)
            if (Number.isFinite(totalScore)) {
                session.score.value = totalScore
            }
        } catch (_) {}
    }

    function getCurrentDateKey() {
        return new Date().toISOString().split('T')[0]
    }

    async function hydrate() {
        try {
            error.value = null
            try {
                options.cleanupOldDrafts(7)
            } catch (_) {}

            await options.loadLetterScores()

            if (!options.isAuthenticated.value) {
                try {
                    const dateStr = options.puzzleDateStr.value || getCurrentDateKey()
                    const saved = localStorage.getItem(`margana.result.${dateStr}`)
                    if (saved) {
                        session.result.value = JSON.parse(saved)
                    }
                } catch (_) {}
            }

            if (options.isAuthenticated.value && !session.result.value) {
                try {
                    const sub = options.userSub.value
                    if (sub) {
                        const dateStr = getCurrentDateKey()
                        const [y, m, d] = dateStr.split('-')
                        const resultKey = `public/users/${sub}/${y}/${m}/${d}/margana-user-results.json`
                        const { url: resultUrl } = await getUrl({
                            path: resultKey,
                            options: {
                                bucket: { bucketName: Bucket.MARGANA_GAME_RESULTS, region: 'eu-west-2' },
                            }
                        })
                        const r = await fetch(resultUrl, { method: 'GET' })
                        if (r.ok) {
                            session.result.value = await r.json()
                        }
                    }
                } catch (_) {}
            }

            if (!session.result.value) {
                await options.loadPuzzle()
            }

            if (!session.result.value) {
                options.buildEditableGrid()
            }

            if (session.result.value) {
                const saved = session.result.value
                try {
                    const dateStr = getCurrentDateKey()
                    window.dispatchEvent(new CustomEvent('margana-played-status', {
                        detail: {
                            date: dateStr,
                            hasPlayed: true,
                            result: saved
                        }
                    }))
                } catch (_) {}
                clearPuzzleState(options.puzzleDateStr.value)
                applySolvedFromSavedDoc(saved)
            }

            try {
                const draft = options.loadPuzzleState(options.puzzleDateStr.value)
                if (draft && !session.result.value) {
                    const rows = Array.isArray(draft.rows) ? draft.rows : []
                    const rCount = session.baseGrid.value.length
                    const cCount = session.baseGrid.value[0]?.length || 0
                    for (let r = 0; r < rCount; r++) {
                        for (let c = 0; c < cCount; c++) {
                            if (!session.am.isTargetCell(r, c)) {
                                const raw = (rows?.[r]?.[c] || '')
                                const isWildcard = raw === '*'
                                const ch = isWildcard ? '*' : sanitizeLetter(raw)
                                if (isWildcard || ch) {
                                    session.gm.editableGrid.value[r][c] = ch
                                }
                            }
                        }
                    }
                    const hasV3 = Array.isArray(draft.builderSlots) || Array.isArray(draft.builderBank) || Array.isArray(draft.topOrder)
                    if (hasV3) {
                        const snap = {
                            slots: Array.isArray(draft.builderSlots) ? draft.builderSlots : [],
                            bank: Array.isArray(draft.builderBank) ? draft.builderBank : [],
                            topOrder: Array.isArray(draft.topOrder) ? draft.topOrder : [],
                        }
                        if (!options.activeAnagramBuilder.value || !options.activeAnagramBuilder.value.restoreBuilderSnapshot) {
                            await nextTick()
                        }
                        session.am.initialBuilderSnapshot.value = snap
                        options.activeAnagramBuilder.value?.restoreBuilderSnapshot?.(snap)
                        await nextTick()
                        session.am.builderWord.value = (options.activeAnagramBuilder.value?.getBuilderWord?.() || draft.builderWord || '').toString().toUpperCase()
                    } else if (draft.builderWord && typeof draft.builderWord === 'string') {
                        session.am.builderWord.value = draft.builderWord.toUpperCase()
                        options.activeAnagramBuilder.value?.setBuilderWord?.(session.am.builderWord.value)
                    }
                    if (Array.isArray(draft.rowStates)) {
                        for (let r = 0; r < Math.min(draft.rowStates.length, rCount); r++) {
                            const snap = draft.rowStates[r] || {}
                            if (snap.valid === true) {
                                session.gm.rowValid.value[r] = true
                            }
                        }
                    }
                    if (typeof draft.totalScore === 'number') {
                        session.score.value = draft.totalScore
                    }
                    if (typeof draft.anagramVerifiedPoints === 'number') {
                        session.am.anagramVerifiedPoints.value = draft.anagramVerifiedPoints
                    }
                }
            } catch (e) {}

            try {
                await nextTick()
                let needRevalidate = false
                try {
                    const draft = options.loadPuzzleState(options.puzzleDateStr.value)
                    const rows = session.baseGrid.value.length || 0
                    for (let r = 0; r < rows; r++) {
                        if (!session.gm.hasAnyEditableInRow(r)) continue
                        if (session.gm.areAllEditableFilledInRow(r)) {
                            const snap = (draft && Array.isArray(draft.rowStates)) ? draft.rowStates[r] : undefined
                            const wordNow = composeRowWordFromGrids(r, session.baseGrid.value, session.gm.editableGrid.value, session.am.isTargetCell)
                            const hasValidFlag = typeof snap?.valid === 'boolean'
                            const wordMatches = typeof snap?.word === 'string' && snap.word === wordNow
                            if (!(hasValidFlag && wordMatches)) {
                                needRevalidate = true
                                break
                            }
                        }
                    }
                } catch (_) {
                    needRevalidate = true
                }
                if (needRevalidate && !session.result.value) {
                    await revalidateCompletedRowsSilently()
                }
            } catch (_) {}

            await nextTick()
            if (!session.result.value) {
                session.im.focusFirstEditable(0)
            }
        } catch (e: any) {
            console.error('[useGameFlow] Hydrate error:', e)
            error.value = e.message || String(e)
        } finally {
            session.am.hydrationInProgress.value = false
            setTimeout(() => {
                session.am.ignoreEmptySnapshots.value = false
            }, 400)
        }
    }

    async function revalidateCompletedRowsSilently() {
        if (session.endOfGame.value) return
        try {
            const rows = session.baseGrid.value.length || 0
            if (!rows) return

            let anyCompleted = false
            for (let r = 0; r < rows; r++) {
                if (!session.gm.hasAnyEditableInRow(r)) continue
                if (session.gm.areAllEditableFilledInRow(r)) {
                    anyCompleted = true
                    break
                }
            }
            if (!anyCompleted) return

            const resp = await callLiveScoring({ forceApi: true }).catch(() => null)
            const summaries = (resp && Array.isArray(resp.row_summaries)) ? resp.row_summaries : []

            const invalids = []
            for (let r = 0; r < rows; r++) {
                if (!session.gm.hasAnyEditableInRow(r)) continue
                if (!session.gm.areAllEditableFilledInRow(r)) continue

                if ((options.settingsEnableWildcardBypass?.value) && session.gm.rowHasWildcard(r)) {
                    session.gm.rowValid.value[r] = true
                    session.gm.rowValidating.value[r] = false
                    session.gm.rowError.value[r] = false
                    continue
                }

                const s = summaries.find((x: any) => Number(x?.row) === Number(r)) || null
                const v = !!s?.valid
                session.gm.rowValid.value[r] = v
                session.gm.rowValidating.value[r] = false
                session.gm.rowError.value[r] = !v
                if (!v) invalids.push(r)
            }

            if (!session.endOfGame.value) {
                if (invalids.length) {
                    session.errorRow.value = invalids[0]
                } else if (session.errorRow.value != null) {
                    session.errorRow.value = null
                }
            }

            session.schedulePersist()
        } catch (_) {}
    }


    const onVisHandler = () => {
        if (document.visibilityState === 'hidden') {
            session.persistNow()
            try { options.typingAgg.flush('hidden') } catch (_) {}
            try { options.highlightAgg.flush('hidden') } catch (_) {}
            try { options.shuffleAgg.flush('hidden') } catch (_) {}
        }
    }

    const onUnloadHandler = () => {
        session.persistNow()
        try { options.typingAgg.flush('beforeunload') } catch (_) {}
        try { options.highlightAgg.flush('beforeunload') } catch (_) {}
        try { options.shuffleAgg.flush('beforeunload') } catch (_) {}
    }

    onMounted(() => {
        document.addEventListener('visibilitychange', onVisHandler)
        window.addEventListener('beforeunload', onUnloadHandler)
    })

    onBeforeUnmount(() => {
        document.removeEventListener('visibilitychange', onVisHandler)
        window.removeEventListener('beforeunload', onUnloadHandler)
        try { options.typingAgg.flush('unmount') } catch (_) {}
        try { options.highlightAgg.flush('unmount') } catch (_) {}
        try { options.shuffleAgg.flush('unmount') } catch (_) {}
    })

    watch(session.endOfGame, (v) => {
        if (v) {
            try { options.typingAgg.flush('game_end') } catch (_) {}
            try { options.highlightAgg.flush('game_end') } catch (_) {}
            try { options.shuffleAgg.flush('game_end') } catch (_) {}
            
            const res = session.result.value
            const madnessEf = getMadnessCelebrationEffect({ resp: res, lastMadnessSig: session.madnessSig.value })
            if (madnessEf) {
                session.madnessSig.value = madnessEf.sig
                session.pm.clearPulse()
                session.pm.triggerPulseCells(madnessEf.cells, madnessEf.theme, madnessEf.label, madnessEf.rStart, madnessEf.cStart)
            }
        }
    })

    return {
        posting: computed(() => session.posting.value),
        error,
        showStatistics: computed(() => session.showStatistics.value),
        newAchievements,
        callLiveScoring,
        submit,
        hydrate
    }
}
