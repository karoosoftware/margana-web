import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Margana from '../Margana.vue'
import { nextTick, ref } from 'vue'
import * as ML from '../../utils/marganaLogic'

// Mock dependencies
vi.mock('@/config/api', () => ({
  API: {},
  MyAmplify: {},
  Bucket: {}
}))

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn()
}))

vi.mock('aws-amplify/storage', () => ({
  getUrl: vi.fn()
}))

vi.mock('../../composables/useBuyHistory', () => ({
  saveBuy: vi.fn(),
  hasLocalStorage: vi.fn(() => true),
  getBuys: vi.fn(() => [])
}))

vi.mock('@/utils/persist', () => ({
  clearPuzzleState: vi.fn(),
  savePuzzleState: vi.fn(),
  loadPuzzleState: vi.fn(),
  cleanupOldDrafts: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: vi.fn()
  }),
  useRoute: () => ({
    query: {}
  })
}))

// Mock useTutorial to avoid localStorage and timers
vi.mock('@/composables/useTutorial', () => ({
  useTutorial: () => ({
    isTutorialActive: ref(false),
    startTutorial: vi.fn(),
    hasSeenTutorial: ref(true)
  })
}))

describe('Margana Logic (Pure Functions)', () => {
  const isTargetCellMock = (r, c) => (r === 0 && c === 0) || (r === 0 && c === 3)

  describe('isEditableCell', () => {
    it('correctly identifies editable vs static cells', () => {
      expect(ML.isEditableCell(0, 0, isTargetCellMock)).toBe(false)
      expect(ML.isEditableCell(0, 1, isTargetCellMock)).toBe(true)
      expect(ML.isEditableCell(0, 3, isTargetCellMock)).toBe(false)
    })
  })

  describe('Row Navigation Logic', () => {
    const isEditableCellMock = (r, c) => !isTargetCellMock(r, c)
    const cols = 5

    it('firstEditableInRow finds the first non-target cell', () => {
      const first = ML.firstEditableInRow(0, cols, isEditableCellMock)
      expect(first).toEqual({ r: 0, c: 1 })
    })

    it('lastEditableInRow finds the last non-target cell', () => {
      const last = ML.lastEditableInRow(0, cols, isEditableCellMock)
      expect(last).toEqual({ r: 0, c: 4 })
    })
  })

  describe('Row Content Validation', () => {
    const isEditableCellMock = (r, c) => !isTargetCellMock(r, c)
    const cols = 5

    it('areAllEditableFilledInRow correctly detects complete row', () => {
      const grid = [
        ['', 'O', 'D', '', 'Y']
      ]
      expect(ML.areAllEditableFilledInRow(0, cols, grid, isEditableCellMock)).toBe(true)
      
      grid[0][1] = '' // Empty editable cell
      expect(ML.areAllEditableFilledInRow(0, cols, grid, isEditableCellMock)).toBe(false)
    })
  })

  describe('handleBackspaceLogic', () => {
    it('clears cell if not empty', () => {
      const grid = [['', 'A']]
      const result = ML.handleBackspaceLogic(0, 1, grid)
      expect(result).toBe(true)
      expect(grid[0][1]).toBe('')
    })

    it('returns false if cell already empty', () => {
      const grid = [['', '']]
      const result = ML.handleBackspaceLogic(0, 1, grid)
      expect(result).toBe(false)
    })
  })

  describe('buildMarganaPayload', () => {
    it('correctly assembles payload structure', () => {
      const params = {
        baseGrid: [['T', ' ', ' ', 'D', ' ']],
        editableGrid: [['', 'O', 'D', '', 'Y']],
        puzzle: { date: '2026-01-08', word_length: 5, diagonal_direction: 'main' },
        settingsEnableWildcardBypass: false,
        rowHasWildcardFn: () => false,
        isVerticalTargetCellFn: (r, c) => c === 3,
        isDiagonalCellFn: (r, c) => r === c,
        guestId: 'guest-123',
        colIndex: 3,
        latestBuilderSnapshot: { slots: ['B', 'A', 'S', 'S'] },
        builderWord: 'BASS'
      }

      const payload = ML.buildMarganaPayload(params)
      
      expect(payload.meta.date).toBe('2026-01-08')
      expect(payload.meta.guest_id).toBe('guest-123')
      expect(payload.meta.userAnagram).toBe('BASS')
      
      // Check a target cell (0,3)
      const cell03 = payload.cells.find(c => c.r === 0 && c.c === 3)
      expect(cell03.letter).toBe('D')
      expect(cell03.target).toBe(true)
      expect(cell03.targetType).toBe('vertical')

      // Check an editable cell (0,1)
      const cell01 = payload.cells.find(c => c.r === 0 && c.c === 1)
      expect(cell01.letter).toBe('O')
      expect(cell01.target).toBe(false)
    })

    it('handles Vue refs in parameters without circular errors', () => {
      const settingsEnableWildcardBypass = ref(false)
      const guestId = ref('guest-123')
      const colIndex = ref(3)

      const params = {
        baseGrid: [['T', ' ', ' ', 'D', ' ']],
        editableGrid: [['', 'O', 'D', '', 'Y']],
        puzzle: { date: '2026-01-08', word_length: 5 },
        settingsEnableWildcardBypass: settingsEnableWildcardBypass.value,
        rowHasWildcardFn: () => false,
        isVerticalTargetCellFn: () => false,
        isDiagonalCellFn: () => false,
        guestId: guestId.value,
        colIndex: colIndex.value,
        latestBuilderSnapshot: null,
        builderWord: ''
      }

      // This should NOT throw even if we accidentally passed refs (if we fix logic to handle them, but here we pass .value which is what Margana.vue should do)
      const payload = ML.buildMarganaPayload(params)
      expect(payload.meta.guest_id).toBe('guest-123')
      expect(payload.meta.columnIndex).toBe(3)
      
      // Test the "accidental ref" case if we want to be robust in ML
      const paramsWithRefs = {
        ...params,
        settingsEnableWildcardBypass: settingsEnableWildcardBypass, // Passing the ref itself
        guestId: guestId,
        colIndex: colIndex
      }
      
      // If ML doesn't handle refs, this might include the ref in payload
      const payload2 = ML.buildMarganaPayload(paramsWithRefs)
      
      // We want to ensure JSON.stringify doesn't fail
      expect(() => JSON.stringify(payload2)).not.toThrow()
    })

    it('derives userAnagram from slots in latestBuilderSnapshot if available', () => {
      const params = {
        latestBuilderSnapshot: { slots: ['B', ' ', 'A', 'S', 'S', ' '] },
        builderWord: 'OTHER'
      }
      const payload = ML.buildMarganaPayload(params)
      expect(payload.meta.userAnagram).toBe('B ASS') // sanitizeLetter might handle spaces
    })

    it('correctly handles userAnagram when slots are empty', () => {
      const params = {
        latestBuilderSnapshot: { slots: [] },
        builderWord: 'NOTES'
      }
      const payload = ML.buildMarganaPayload(params)
      expect(payload.meta.userAnagram).toBe('NOTES')
    })

    it('correctly handles userAnagram when a letter is removed (middle space)', () => {
      const params = {
        latestBuilderSnapshot: { slots: ['N', 'O', ' ', 'E', 'S'] },
        builderWord: 'NOTES'
      }
      const payload = ML.buildMarganaPayload(params)
      expect(payload.meta.userAnagram).toBe('NO ES')
    })

    it('correctly handles userAnagram when a letter is removed from the end', () => {
      const params = {
        latestBuilderSnapshot: { slots: ['N', 'O', 'T', 'E', ' ', ' '] },
        builderWord: 'NOTES'
      }
      const payload = ML.buildMarganaPayload(params)
      expect(payload.meta.userAnagram).toBe('NOTE')
    })
  })
})
