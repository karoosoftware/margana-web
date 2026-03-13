import { describe, it, expect } from 'vitest';
import { getRowCelebrationEffects, getMadnessCelebrationEffect, CelebrationContext } from '../celebrationLogic';

describe('celebrationLogic', () => {
  const mockBaseGrid = [
    ['A', 'B', 'C', 'D', 'E'],
    ['F', 'G', 'H', 'I', 'J'],
    ['K', 'L', 'M', 'N', 'O'],
    ['P', 'Q', 'R', 'S', 'T'],
    ['U', 'V', 'W', 'X', 'Y']
  ];
  const mockEditableGrid = mockBaseGrid.map(row => [...row]);

  const defaultCtx: CelebrationContext = {
    r: 0,
    word: 'LEVEL',
    resp: {
      valid_words_metadata: [
        { type: 'row', index: 0, word: 'level', palindrome: true, score: 10 }
      ]
    },
    baseGrid: mockBaseGrid,
    editableGrid: mockEditableGrid,
    lastMadnessSig: '',
    lastRowPulseSigs: new Map(),
    lastDiagPulseSigs: new Map(),
    isTargetCell: () => false,
    computeHighlightFromItem: () => new Set(['0:0', '0:1', '0:2', '0:3', '0:4']),
    firstEditableInRow: () => ({ r: 0, c: 0 }),
    lastEditableInRow: () => ({ r: 0, c: 4 })
  };

  describe('getRowCelebrationEffects', () => {
    it('should detect a row palindrome', () => {
      const effects = getRowCelebrationEffects(defaultCtx);
      expect(effects).toHaveLength(1);
      expect(effects[0]).toMatchObject({
        type: 'row',
        theme: 'pal',
        label: 'Palindrome +10',
        sig: 'pal|Palindrome +10'
      });
    });

    it('should detect a row semordnilap and double the score', () => {
      const ctx = {
        ...defaultCtx,
        word: 'DEER',
        resp: {
          valid_words_metadata: [
            { type: 'row', index: 0, word: 'deer', semordnilap: true, score: 5 }
          ]
        }
      };
      const effects = getRowCelebrationEffects(ctx);
      expect(effects).toHaveLength(1);
      expect(effects[0]).toMatchObject({
        type: 'row',
        theme: 'sem',
        label: 'Semordnilap +10'
      });
    });


    it('should detect diagonal intersections', () => {
      const ctx: CelebrationContext = {
        ...defaultCtx,
        resp: {
          valid_words_metadata: [
            { type: 'diagonal', word: 'diagonal', score: 20 }
          ]
        },
        computeHighlightFromItem: () => new Set(['0:0', '1:1', '2:2', '3:3', '4:4'])
      };
      const effects = getRowCelebrationEffects(ctx);
      expect(effects).toHaveLength(1);
      expect(effects[0]).toMatchObject({
        type: 'cells',
        theme: 'diag',
        label: 'Diagonal +20'
      });
    });

    it('should detect multiple triggers simultaneously (semordnilap and diagonal)', () => {
      const ctx: CelebrationContext = {
        ...defaultCtx,
        word: 'DEER',
        resp: {
          valid_words_metadata: [
            { type: 'row', index: 0, word: 'deer', semordnilap: true, score: 5 },
            { type: 'diagonal', word: 'diagonal', score: 20 }
          ]
        },
        computeHighlightFromItem: (item) => {
          if (item.type === 'row') return new Set(['0:0', '0:1', '0:2', '0:3']);
          if (item.type === 'diagonal') return new Set(['0:0', '1:1', '2:2', '3:3', '4:4']);
          return new Set();
        }
      };
      const effects = getRowCelebrationEffects(ctx);
      
      // Should find 2 effects: one for the row (semordnilap) and one for the diagonal
      expect(effects).toHaveLength(2);
      
      const rowEffect = effects.find(e => e.type === 'row');
      const diagEffect = effects.find(e => e.type === 'cells');
      
      expect(rowEffect).toMatchObject({
        theme: 'sem',
        label: 'Semordnilap +10'
      });
      
      expect(diagEffect).toMatchObject({
        theme: 'diag',
        label: 'Diagonal +20'
      });
    });

    it('should assign correct themes for simultaneous semordnilap and madness triggers', () => {
      const ctx: CelebrationContext = {
        ...defaultCtx,
        word: 'SWARD',
        resp: {
          meta: {
            madnessFound: true,
            madnessPath: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]], // Row 1
            madnessScore: 30
          },
          valid_words_metadata: [
            { type: 'row', index: 1, word: 'sward', semordnilap: true, score: 5 }
          ]
        },
        r: 1
      };

      const rowEffects = getRowCelebrationEffects(ctx);
      const madnessEffect = getMadnessCelebrationEffect({ resp: ctx.resp, lastMadnessSig: '', currentRow: 1 });

      expect(rowEffects).toHaveLength(1);
      expect(rowEffects[0].theme).toBe('sem');
      
      expect(madnessEffect).not.toBeNull();
      expect(madnessEffect?.theme).toBe('mad');
    });

    it('should suppress row celebration if signature matches', () => {
      const ctx: CelebrationContext = {
        ...defaultCtx,
        lastRowPulseSigs: new Map([[0, 'pal|Palindrome +10']])
      };
      const effects = getRowCelebrationEffects(ctx);
      expect(effects).toHaveLength(0);
    });

    it('should suppress diagonal celebration if signature matches', () => {
      const ctx: CelebrationContext = {
        ...defaultCtx,
        resp: {
          valid_words_metadata: [
            { type: 'diagonal', word: 'diagonal', score: 20 }
          ]
        },
        computeHighlightFromItem: () => new Set(['0:0', '1:1', '2:2', '3:3', '4:4']),
        lastDiagPulseSigs: new Map([['0:0|1:1|2:2|3:3|4:4', 'diag|Diagonal +20']])
      };
      const effects = getRowCelebrationEffects(ctx);
      expect(effects).toHaveLength(0);
    });
  });

  describe('getMadnessCelebrationEffect', () => {
    it('should detect Margana Madness', () => {
      const resp = {
        meta: {
          madnessFound: true,
          madnessPath: [[0, 0], [0, 1], [0, 2]],
          madnessScore: 30
        }
      };
      const effect = getMadnessCelebrationEffect({ resp, lastMadnessSig: '' });
      expect(effect).not.toBeNull();
      expect(effect).toMatchObject({
        type: 'cells',
        theme: 'mad',
        label: 'Madness +30'
      });
    });

    it('should not repeat madness pulse if signature matches', () => {
      const resp = {
        meta: {
          madnessFound: true,
          madnessPath: [[0, 0], [0, 1]],
          madnessScore: 30
        }
      };
      const sig = '0:0|0:1';
      const effect = getMadnessCelebrationEffect({ resp, lastMadnessSig: sig });
      expect(effect).toBeNull();
    });

    it('should NOT trigger Margana Madness if the completed row does not intersect the madness path (bug fix verification)', () => {
      // Madness path is on rows 0, 1, 2
      const madnessPath = [[0, 4], [1, 3], [2, 2]]; 
      const resp = {
        meta: {
          madnessFound: true,
          madnessPath,
          madnessScore: 30
        }
      };

      // User just completed row 4, which is NOT in the madness path
      const effect = getMadnessCelebrationEffect({ resp, lastMadnessSig: '', currentRow: 4 });
      expect(effect).toBeNull();
      
      // User just completed row 2, which IS in the madness path
      const effect2 = getMadnessCelebrationEffect({ resp, lastMadnessSig: '', currentRow: 2 });
      expect(effect2).not.toBeNull();
    });

  });
});
