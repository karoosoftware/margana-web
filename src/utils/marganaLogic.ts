import { sanitizeLetter, getAnagramWordFromSlots } from './highlightUtils.js'

/**
 * Pure functions for Margana game logic to enable testing and reusability.
 */

export function isEditableCell(r, c, isTargetCellFn) {
  return !isTargetCellFn(r, c)
}

export function firstEditableInRow(r, cols, isEditableCellFn) {
  for (let c = 0; c < cols; c++) {
    if (isEditableCellFn(r, c)) return { r, c }
  }
  return null
}

export function lastEditableInRow(r, cols, isEditableCellFn) {
  for (let c = cols - 1; c >= 0; c--) {
    if (isEditableCellFn(r, c)) return { r, c }
  }
  return null
}

export function areAllEditableFilledInRow(r, cols, editableGrid, isEditableCellFn) {
  for (let c = 0; c < cols; c++) {
    if (isEditableCellFn(r, c)) {
      const v = editableGrid?.[r]?.[c] || ''
      if (v.length !== 1) return false
    }
  }
  return true
}

export function hasAnyEditableInRow(r, cols, isEditableCellFn) {
  for (let c = 0; c < cols; c++) {
    if (isEditableCellFn(r, c)) return true
  }
  return false
}

export function handleBackspaceLogic(r, c, editableGrid) {
  if (editableGrid[r][c] !== '') {
    editableGrid[r][c] = ''
    return true // indicates value was cleared
  }
  return false // indicates it was already empty
}

export function scoreFor(ch, letterScores) {
  if (!ch) return ''
  const L = String(ch).toUpperCase()
  const v = letterScores?.[L]
  return typeof v === 'number' ? v : ''
}

export function buildMarganaPayload({
  baseGrid,
  editableGrid,
  puzzle,
  settingsEnableWildcardBypass,
  rowHasWildcardFn,
  isVerticalTargetCellFn,
  isDiagonalCellFn,
  guestId,
  colIndex,
  latestBuilderSnapshot,
  builderWord
}) {
  const unwrap = (v) => (typeof v === 'object' && v !== null && 'value' in v) ? v.value : v
  const _settingsEnableWildcardBypass = unwrap(settingsEnableWildcardBypass)
  const _guestId = unwrap(guestId)
  const _colIndex = unwrap(colIndex)

  const rows = baseGrid?.length || 0
  const cols = rows ? (baseGrid[0]?.length || 0) : 0
  const cells = []
  const skippedRows = []

  for (let r = 0; r < rows; r++) {
    const isSkipped = !!(_settingsEnableWildcardBypass && rowHasWildcardFn(r))
    if (isSkipped) skippedRows.push(r)

    for (let c = 0; c < cols; c++) {
      const targetVertical = isVerticalTargetCellFn(r, c)
      const targetDiagonal = isDiagonalCellFn(r, c)
      const targetType = targetVertical ? 'vertical' : (targetDiagonal ? 'diagonal' : null)
      const letterRaw = targetType ? baseGrid[r][c] : (editableGrid?.[r]?.[c] || '')
      const letter = sanitizeLetter(letterRaw)
      cells.push({ r, c, letter, target: !!targetType, targetType })
    }
  }

  return {
    meta: {
      date: puzzle?.date || null,
      guest_id: _guestId,
      rows,
      cols,
      wordLength: puzzle?.word_length || cols,
      columnIndex: _colIndex,
      diagonalDirection: puzzle?.diagonal_direction || 'main',
      verticalTargetWord: (puzzle?.vertical_target_word || '').toLowerCase() || null,
      diagonalTargetWord: (puzzle?.diagonal_target_word || '').toLowerCase() || null,
      madnessAvailable: !!(puzzle?.madnessAvailable || puzzle?.meta?.madnessAvailable || false),
      longestAnagramCount: (() => {
        const v = (puzzle?.longest_anagram_count ?? puzzle?.longestAnagramCount ?? puzzle?.meta?.longestAnagramCount ?? puzzle?.meta?.longest_anagram_count);
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
      userAnagram: (() => {
        const slots = Array.isArray(latestBuilderSnapshot?.slots) ? latestBuilderSnapshot.slots : []
        if (!slots.length) return (builderWord || '').toUpperCase() || null
        return getAnagramWordFromSlots(slots) || null
      })(),
      skippedRows,
    },
    cells,
  }
}
