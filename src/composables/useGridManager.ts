import { ref, computed } from 'vue'
import * as ML from '../utils/marganaLogic'

export function useGridManager(baseGrid: any, settingsEnableWildcardBypass: any, isTargetCell: (r: number, c: number) => boolean) {
  const editableGrid = ref([])
  const rowValid = ref([])
  const rowValidating = ref([])
  const rowValidationSeq = ref([])
  const pendingRowValidations = ref(0)
  const rowError = ref([])
  const rowInvalidByXor = ref([])

  function isEditableCell(r: number, c: number) {
    return ML.isEditableCell(r, c, isTargetCell)
  }

  const hasAnyEditableInRow = (r: number) => {
    const cols = baseGrid.value[0]?.length || 0
    return ML.hasAnyEditableInRow(r, cols, isEditableCell)
  }

  const areAllEditableFilledInRow = (r: number) => {
    const cols = baseGrid.value[0]?.length || 0
    return ML.areAllEditableFilledInRow(r, cols, editableGrid.value, isEditableCell)
  }

  const rowHasWildcard = (r: number) => {
    const row = editableGrid.value[r]
    if (!Array.isArray(row)) return false
    return row.some(ch => ch === '*')
  }

  function buildEditableGrid() {
    const src = baseGrid.value
    editableGrid.value = src.map((row, r) =>
      row.map((ch, c) => (isTargetCell(r, c) ? ch : ''))
    )
    const rows = baseGrid.value.length
    rowValid.value = Array(rows).fill(false)
    rowValidating.value = Array(rows).fill(false)
    rowValidationSeq.value = Array(rows).fill(0)
    rowError.value = Array(rows).fill(false)

    for (let r = 0; r < rows; r++) {
      if (!hasAnyEditableInRow(r)) rowValid.value[r] = true
    }
    pendingRowValidations.value = 0
  }

  return {
    editableGrid,
    rowValid,
    rowValidating,
    rowValidationSeq,
    pendingRowValidations,
    rowError,
    rowInvalidByXor,
    rowHasWildcard,
    isEditableCell,
    hasAnyEditableInRow,
    areAllEditableFilledInRow,
    buildEditableGrid
  }
}
