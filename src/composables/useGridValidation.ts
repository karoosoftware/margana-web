import { type Ref } from 'vue'
import { getRowCelebrationEffects, getMadnessCelebrationEffect } from '@/services/celebration/celebrationLogic'

export interface GridValidationDeps {
  baseGrid: Ref<any[][]>
  editableGrid: Ref<any[][]>
  rowValid: Ref<boolean[]>
  rowValidating: Ref<boolean[]>
  rowValidationSeq: Ref<number[]>
  pendingRowValidations: Ref<number>
  rowError: Ref<boolean[]>
  errorRow: Ref<number | null>
  shakeRow: Ref<number | null>
  rowInvalidByXor: Ref<boolean[]>
  settingsEnableWildcardBypass: Ref<boolean>
  liveTotalScore: Ref<number>
  lastMadnessSig: Ref<string>
  lastRowPulseSigs: Ref<Map<number, string>>
  lastDiagPulseSigs: Ref<Map<string, string>>
  madnessAvailable: Ref<boolean>
  
  // Functions
  rowHasWildcard: (r: number) => boolean
  composeRowWord: (r: number) => string
  callLiveScoring: (opts: any) => Promise<any>
  triggerPulseRow: (r: number, theme?: string, label?: string | null, cStart?: number | null, cEnd?: number | null) => void
  triggerPulseCells: (cells: Set<string>, theme?: string, label?: string | null, rStart?: number | null, cStart?: number | null) => void
  focusFirstEditable: (fromRow: number) => void
  isTargetCell: (r: number, c: number) => boolean
  computeHighlightFromItem: any
  schedulePersist: () => void
  dispatchUsage: (action: string, payload: any) => void
}

export function useGridValidation(deps: GridValidationDeps) {
  async function validateRowAndMaybeAdvance(r: number, options: { autoFocus?: boolean } = {}) {
    let didIncPending = false

    try {
      // Wildcard rows are auto-valid and do not require async validation when enabled
      if (deps.settingsEnableWildcardBypass.value && deps.rowHasWildcard(r)) {
        deps.rowValid.value[r] = true
        deps.rowValidating.value[r] = false
        deps.rowError.value[r] = false
        if (deps.errorRow.value === r) deps.errorRow.value = null
        deps.schedulePersist()
        if (options.autoFocus) {
          deps.focusFirstEditable(r + 1)
        }
        return true
      }

      // Bump per-row seq token to ignore stale results
      const seq = (deps.rowValidationSeq.value[r] || 0) + 1
      deps.rowValidationSeq.value[r] = seq

      if (!deps.rowValidating.value[r]) {
        deps.rowValidating.value[r] = true
        deps.pendingRowValidations.value++
        didIncPending = true
      }

      const word = deps.composeRowWord(r)

      // Live scoring is the default and only path
      const resp = await deps.callLiveScoring({ triggerRow: r }).catch(() => null)

      // If another validation started after us, ignore everything
      if (deps.rowValidationSeq.value[r] !== seq) return false

      // Derive row validity from response
      let valid = false
      const items = Array.isArray(resp?.valid_words_metadata) ? resp.valid_words_metadata : [];
      try {
        if (resp && Array.isArray(resp.row_summaries)) {
          const s = resp.row_summaries.find((x: any) => Number(x?.row) === Number(r)) || null
          if (s && typeof s.valid === 'boolean') valid = s.valid
        }
      } catch (_) {
        valid = false
      }

      // Update live total score if present
      if (resp && typeof resp.total_score === 'number') {
        deps.liveTotalScore.value = resp.total_score
      }

      // Update XOR marker
      try {
        const wasPrechecked = !!resp?.meta?.prechecked
        if (wasPrechecked && !valid) {
          deps.rowInvalidByXor.value[r] = true
        } else if (!wasPrechecked) {
          deps.rowInvalidByXor.value[r] = false
        }
      } catch (_) {}

      // Store validity + persistent red state
      deps.rowValid.value[r] = !!valid
      deps.rowError.value[r] = !valid

      deps.dispatchUsage('validate_word', { len: (word || '').length, ok: !!valid, live: true })

      if (valid) {
        try {
          // Celebration pulse
          const celebEffects = getRowCelebrationEffects({
            r,
            word,
            resp,
            baseGrid: deps.baseGrid.value,
            editableGrid: deps.editableGrid.value,
            lastMadnessSig: deps.lastMadnessSig.value,
            lastRowPulseSigs: deps.lastRowPulseSigs.value,
            lastDiagPulseSigs: deps.lastDiagPulseSigs.value,
            isTargetCell: deps.isTargetCell,
            computeHighlightFromItem: deps.computeHighlightFromItem,
            firstEditableInRow: (row: number) => {
                const cols = deps.baseGrid.value[0]?.length || 0;
                for (let c = 0; c < cols; c++) {
                    if (!deps.isTargetCell(row, c)) return { r: row, c };
                }
                return null;
            },
            lastEditableInRow: (row: number) => {
                const cols = deps.baseGrid.value[0]?.length || 0;
                for (let c = cols - 1; c >= 0; c--) {
                    if (!deps.isTargetCell(row, c)) return { r: row, c };
                }
                return null;
            }
          })

          for (const ef of celebEffects) {
            if (ef.type === 'row') {
              deps.lastRowPulseSigs.value.set(ef.r, ef.sig)
              setTimeout(() => {
                if (deps.lastRowPulseSigs.value.get(ef.r) === ef.sig) deps.lastRowPulseSigs.value.delete(ef.r)
              }, 5000)
              deps.triggerPulseRow(ef.r, ef.theme, ef.label, ef.cStart, ef.cEnd)
            } else if (ef.type === 'cells') {
              if (ef.diagonalSig) {
                deps.lastDiagPulseSigs.value.set(ef.diagonalSig, ef.sig)
                setTimeout(() => {
                  if (deps.lastDiagPulseSigs.value.get(ef.diagonalSig) === ef.sig) deps.lastDiagPulseSigs.value.delete(ef.diagonalSig)
                }, 5000)
              }
              deps.triggerPulseCells(ef.cells, ef.theme, ef.label, ef.rStart, ef.cStart)
            }
          }

          // Margana Madness celebration
          const madnessEf = getMadnessCelebrationEffect({ resp, lastMadnessSig: deps.lastMadnessSig.value, currentRow: r })
          if (madnessEf) {
            deps.lastMadnessSig.value = madnessEf.sig
            deps.triggerPulseCells(madnessEf.cells, madnessEf.theme, madnessEf.label, madnessEf.rStart, madnessEf.cStart)
          }

          // Madness sig cleanup
          if (deps.madnessAvailable.value && resp && resp.meta && !resp.meta.madnessFound) {
            deps.lastMadnessSig.value = ''
          }

          // Row/Diag sig cleanup
          const currentDiags = items.filter((it: any) => it && it.type === 'diagonal')
          const currentDiagSigs = new Set()
          for (const d of currentDiags) {
            const cells = deps.computeHighlightFromItem(d, deps.baseGrid.value, deps.editableGrid.value, deps.isTargetCell)
            if (cells && cells.size) currentDiagSigs.add(Array.from(cells).sort().join('|'))
          }
          for (const sig of deps.lastDiagPulseSigs.value.keys()) {
            if (!currentDiagSigs.has(sig)) deps.lastDiagPulseSigs.value.delete(sig)
          }
          if (deps.lastRowPulseSigs.value.has(r)) {
            const wordNow = (word || '').toLowerCase()
            const found = items.find((it: any) => it && it.type === 'row' && Number(it.index) === Number(r) && String(it.word || '').toLowerCase() === wordNow)
            if (!found || (found.palindrome !== true && found.semordnilap !== true)) {
              deps.lastRowPulseSigs.value.delete(r)
            }
          }
        } catch (_) {}

        if (options.autoFocus) {
          deps.focusFirstEditable(r + 1)
        }
      } else {
        // Shake and mark error for this row
        deps.shakeRow.value = r
        deps.errorRow.value = r
        try {
          if (Array.isArray(deps.rowError.value)) deps.rowError.value[r] = true
        } catch (_) {}
        setTimeout(() => {
          if (deps.shakeRow.value === r) deps.shakeRow.value = null
        }, 600)
      }
      return valid
    } catch (e) {
      console.error('Unexpected validation error:', e)
      try {
        const seqNow = deps.rowValidationSeq.value[r]
        if (seqNow === seq) {
          deps.rowValid.value[r] = false
          deps.rowError.value[r] = true
        }
      } catch (_) {}
      return false
    } finally {
      if (didIncPending) {
        deps.rowValidating.value[r] = false
        deps.pendingRowValidations.value--
      }
    }
  }

  return { validateRowAndMaybeAdvance }
}
