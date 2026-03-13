import { ref, computed } from 'vue'
import * as ML from '../utils/marganaLogic'

export function useInputManagement(
  baseGrid: any,
  editableGrid: any,
  isEditableCell: (r: number, c: number) => boolean,
  endOfGame?: { value: boolean }
) {
  const inputRefs = ref({})

  function focusCell(r: number, c: number) {
    const el = inputRefs.value[`r${r}c${c}`]
    if (el) el.focus({ preventScroll: true })
  }

  function firstEditableInRow(r: number) {
    if (!baseGrid.value.length) return null
    const cols = baseGrid.value[0].length
    return ML.firstEditableInRow(r, cols, isEditableCell)
  }

  function lastEditableInRow(r: number) {
    if (!baseGrid.value.length) return null
    const cols = baseGrid.value[0].length
    return ML.lastEditableInRow(r, cols, isEditableCell)
  }

  function focusFirstEditable(fromRow = 0) {
    for (let r = fromRow; r < baseGrid.value.length; r++) {
      const pos = firstEditableInRow(r)
      if (pos) {
        focusCell(pos.r, pos.c)
        return true
      }
    }
    return false
  }

  function focusNextEditable(r: number, c: number) {
    const cols = baseGrid.value[0]?.length || 0
    for (let nc = c + 1; nc < cols; nc++) {
      if (isEditableCell(r, nc)) {
        focusCell(r, nc)
        return
      }
    }
    for (let nr = r + 1; nr < baseGrid.value.length; nr++) {
      const pos = firstEditableInRow(nr)
      if (pos) {
        focusCell(pos.r, pos.c)
        return
      }
    }
  }

  function focusPrevEditable(r: number, c: number) {
    for (let pc = c - 1; pc >= 0; pc--) {
      if (isEditableCell(r, pc)) {
        focusCell(r, pc)
        return { r, c: pc }
      }
    }
    for (let pr = r - 1; pr >= 0; pr--) {
      const pos = lastEditableInRow(pr)
      if (pos) {
        focusCell(pos.r, pos.c)
        return pos
      }
    }
    return null
  }

  function focusUpEditable(r: number, c: number) {
    for (let pr = r - 1; pr >= 0; pr--) {
      if (isEditableCell(pr, c)) {
        focusCell(pr, c)
        return true
      }
    }
    return false
  }

  function focusDownEditable(r: number, c: number) {
    const rows = baseGrid.value.length
    for (let nr = r + 1; nr < rows; nr++) {
      if (isEditableCell(nr, c)) {
        focusCell(nr, c)
        return true
      }
    }
    return false
  }

  function handleArrow(r: number, c: number, dir: 'left' | 'right' | 'up' | 'down') {
    if (endOfGame?.value) return
    switch (dir) {
      case 'left': focusPrevEditable(r, c); break
      case 'right': focusNextEditable(r, c); break
      case 'up': focusUpEditable(r, c); break
      case 'down': focusDownEditable(r, c); break
    }
  }

  return {
    inputRefs,
    focusCell,
    firstEditableInRow,
    lastEditableInRow,
    focusFirstEditable,
    focusNextEditable,
    focusPrevEditable,
    focusUpEditable,
    focusDownEditable,
    handleArrow
  }
}
