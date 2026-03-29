import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  chooseTile,
  createGame,
  getContextualTileKind,
  getRecommendedTileCounts,
  normalizeRules,
  previewMove,
  spendSurveyToken,
} from './game';

function toCube(col: number, row: number): [number, number, number] {
  const x = col;
  const z = row - Math.floor((col - (col & 1)) / 2);
  const y = -x - z;
  return [x, y, z];
}

function hexDistanceFromKeys(a: string, b: string): number {
  const [aCol, aRow] = a.split(',').map(Number);
  const [bCol, bRow] = b.split(',').map(Number);
  const [ax, ay, az] = toCube(aCol ?? 0, aRow ?? 0);
  const [bx, by, bz] = toCube(bCol ?? 0, bRow ?? 0);
  return (Math.abs(ax - bx) + Math.abs(ay - by) + Math.abs(az - bz)) / 2;
}

describe('normalizeRules', () => {
  it('clamps values and restores tile counts when all are zero', () => {
    const rules = normalizeRules({
      ...DEFAULT_RULES,
      boardWidth: 30,
      boardHeight: 1,
      featureDensityPercent: 99,
      hazardBalancePercent: 140,
      straightWeight: 40,
      softWeight: 0,
      hardWeight: 0,
    });

    expect(rules.boardWidth).toBe(9);
    expect(rules.boardHeight).toBe(4);
    expect(rules.featureDensityPercent).toBe(40);
    expect(rules.hazardBalancePercent).toBe(100);
    expect(rules.straightWeight).toBe(24);
  });

  it('restores default tile counts when all are zero', () => {
    const rules = normalizeRules({
      ...DEFAULT_RULES,
      straightWeight: 0,
      softWeight: 0,
      hardWeight: 0,
    });

    expect(
      rules.straightWeight + rules.softWeight + rules.hardWeight,
    ).toBeGreaterThan(0);
  });
});

describe('recommended tile counts', () => {
  it('matches the tuned baseline for the default board', () => {
    expect(getRecommendedTileCounts(7, 8, 'symmetric')).toEqual({
      straightWeight: 4,
      softWeight: 10,
      hardWeight: 8,
    });
  });

  it('scales up on larger boards without overreacting to one extra row', () => {
    expect(getRecommendedTileCounts(7, 9, 'symmetric')).toEqual({
      straightWeight: 4,
      softWeight: 10,
      hardWeight: 8,
    });
    expect(getRecommendedTileCounts(9, 11, 'symmetric')).toEqual({
      straightWeight: 5,
      softWeight: 14,
      hardWeight: 10,
    });
  });
});

describe('tile bag composition', () => {
  it('splits odd soft and hard counts across left and right variants without exceeding a one-tile difference', () => {
    const game = createGame({
      ...DEFAULT_RULES,
      straightWeight: 0,
      softWeight: 5,
      hardWeight: 5,
      featureDensityPercent: 0,
      seed: 11,
    });
    const allTiles = [...game.offer, ...game.deck];
    const softLeftCount = allTiles.filter(
      (tile) => tile.kind === 'softLeft',
    ).length;
    const softRightCount = allTiles.filter(
      (tile) => tile.kind === 'softRight',
    ).length;
    const hardLeftCount = allTiles.filter(
      (tile) => tile.kind === 'hardLeft',
    ).length;
    const hardRightCount = allTiles.filter(
      (tile) => tile.kind === 'hardRight',
    ).length;

    expect(softLeftCount + softRightCount).toBe(5);
    expect(hardLeftCount + hardRightCount).toBe(5);
    expect(Math.abs(softLeftCount - softRightCount)).toBe(1);
    expect(Math.abs(hardLeftCount - hardRightCount)).toBe(1);
  });
});

describe('contextual turn direction', () => {
  it('flips left and right variants for blue entry', () => {
    expect(getContextualTileKind('straight', 'blue')).toBe('straight');
    expect(getContextualTileKind('softLeft', 'blue')).toBe('softRight');
    expect(getContextualTileKind('softRight', 'blue')).toBe('softLeft');
    expect(getContextualTileKind('hardLeft', 'blue')).toBe('hardRight');
    expect(getContextualTileKind('hardRight', 'blue')).toBe('hardLeft');
  });
});

describe('survey flow', () => {
  it('spends tokens and can be used multiple times in the same turn', () => {
    const game = createGame({
      ...DEFAULT_RULES,
      startingTokens: 3,
    });
    const surveyedOnce = spendSurveyToken(game);
    const surveyedTwice = spendSurveyToken(surveyedOnce);

    expect(surveyedOnce.tokens).toBe(game.tokens - 1);
    expect(surveyedOnce.offer).toHaveLength(4);
    expect(surveyedTwice.tokens).toBe(game.tokens - 2);
    expect(surveyedTwice.offer).toHaveLength(6);
    expect(surveyedTwice.surveyUsedThisTurn).toBe(false);
  });

  it('does not spend a token if the bag is empty', () => {
    const game = createGame({
      ...DEFAULT_RULES,
      straightWeight: 1,
      softWeight: 0,
      hardWeight: 0,
      startingTokens: 2,
      featureDensityPercent: 0,
      seed: 11,
    });

    expect(game.deck).toHaveLength(0);

    const nextGame = spendSurveyToken(game);

    expect(nextGame.tokens).toBe(game.tokens);
    expect(nextGame.status).toBe('playing');
    expect(nextGame.statusMessage).toBe(
      'No more track tiles remain in the bag.',
    );
  });
});

describe('move resolution', () => {
  it('starts by pointing players at highlighted goal spaces', () => {
    const game = createGame(DEFAULT_RULES);

    expect(game.statusMessage).toBe(
      'Lay track from the bottom to any highlighted goal space.',
    );
  });

  it('never places tokens on goal spaces', () => {
    const game = createGame({
      ...DEFAULT_RULES,
      featureDensityPercent: 40,
      hazardBalancePercent: 0,
      seed: 11,
    });
    const goalKeys = new Set(
      game.board.cells.filter((cell) => cell.row === 0).map((cell) => cell.key),
    );

    expect(game.tokenCells.every((key) => !goalKeys.has(key))).toBe(true);
  });

  it('pulls rewards closer to hazards than a neutral spread would', () => {
    let tokenDistanceTotal = 0;
    let tokenCount = 0;
    let candidateDistanceTotal = 0;
    let candidateCount = 0;

    for (let seed = 1; seed <= 48; seed += 1) {
      const game = createGame({
        ...DEFAULT_RULES,
        featureDensityPercent: 28,
        hazardBalancePercent: 50,
        seed,
      });
      if (game.obstacleCells.length === 0 || game.tokenCells.length === 0) {
        continue;
      }

      const tokenSet = new Set(game.tokenCells);
      const candidateKeys = game.board.cells
        .filter(
          (cell) =>
            cell.key !== game.board.start.key &&
            cell.row !== 0 &&
            !game.obstacleCells.includes(cell.key),
        )
        .map((cell) => cell.key);

      for (const key of game.tokenCells) {
        tokenDistanceTotal += Math.min(
          ...game.obstacleCells.map((obstacleKey) =>
            hexDistanceFromKeys(key, obstacleKey),
          ),
        );
        tokenCount += 1;
      }

      for (const key of candidateKeys) {
        if (tokenSet.has(key)) {
          continue;
        }

        candidateDistanceTotal += Math.min(
          ...game.obstacleCells.map((obstacleKey) =>
            hexDistanceFromKeys(key, obstacleKey),
          ),
        );
        candidateCount += 1;
      }
    }

    expect(tokenCount).toBeGreaterThan(0);
    expect(candidateCount).toBeGreaterThan(0);
    expect(tokenDistanceTotal / tokenCount).toBeLessThan(
      candidateDistanceTotal / candidateCount,
    );
  });

  it('plays a tile and advances the frontier when the move is safe', () => {
    const game = createGame({
      ...DEFAULT_RULES,
      featureDensityPercent: 0,
      seed: 11,
    });

    const safeTile = game.offer.find(
      (tile) => previewMove(game, tile).outcome === 'continue',
    );
    expect(safeTile).toBeDefined();

    const nextGame = chooseTile(game, safeTile!.id);
    const placedTrack = Object.values(nextGame.occupiedTracks)[0];

    expect(nextGame.turnNumber).toBe(2);
    expect(nextGame.status).toBe('playing');
    expect(Object.keys(nextGame.occupiedTracks)).toHaveLength(1);
    expect(placedTrack?.entryColor).toBe('red');
    expect(placedTrack?.exitColor).toBe('blue');
  });

  it('loses when the bag runs out before the next turn offer can be dealt', () => {
    const game = createGame({
      ...DEFAULT_RULES,
      straightWeight: 1,
      softWeight: 0,
      hardWeight: 0,
      featureDensityPercent: 0,
      seed: 11,
    });

    expect(game.offer).toHaveLength(1);

    const nextGame = chooseTile(game, game.offer[0]!.id);

    expect(nextGame.status).toBe('lost');
    expect(nextGame.statusMessage).toBe('Ran out of track tiles.');
  });

  it('collects tokens immediately on pickup', () => {
    const game = createGame({
      ...DEFAULT_RULES,
      featureDensityPercent: 0,
      seed: 11,
    });
    const safeTile = game.offer.find(
      (tile) => previewMove(game, tile).outcome === 'continue',
    );

    expect(safeTile).toBeDefined();

    const tokenGame = {
      ...game,
      tokenCells: [game.board.start.key],
    };
    const nextGame = chooseTile(tokenGame, safeTile!.id);

    expect(nextGame.tokens).toBe(game.tokens + 1);
    expect(nextGame.tokenCells).not.toContain(game.board.start.key);
  });

  it('marks a move as blocked if it steers into an obstacle on the next forced hex', () => {
    const game = createGame({
      ...DEFAULT_RULES,
      featureDensityPercent: 0,
      seed: 11,
    });
    const candidateTiles = [
      { id: 'straight', kind: 'straight' as const },
      { id: 'soft-left', kind: 'softLeft' as const },
      { id: 'soft-right', kind: 'softRight' as const },
      { id: 'hard-left', kind: 'hardLeft' as const },
      { id: 'hard-right', kind: 'hardRight' as const },
    ];

    let blockedPreview: ReturnType<typeof previewMove> | undefined;

    for (const tile of candidateTiles) {
      const initialPreview = previewMove(game, tile);
      if (initialPreview.outcome !== 'continue' || !initialPreview.nextKey) {
        continue;
      }

      const obstacleGame = {
        ...game,
        obstacleCells: [initialPreview.nextKey],
        offer: [tile],
      };
      const obstaclePreview = previewMove(obstacleGame, tile);

      if (obstaclePreview.outcome === 'loss') {
        blockedPreview = obstaclePreview;
        break;
      }
    }

    expect(blockedPreview).toBeDefined();
    expect(blockedPreview?.reason).toBe('Steers into an obstacle.');
  });

  it('wins as soon as a move enters a highlighted goal space', () => {
    const game = createGame({
      ...DEFAULT_RULES,
      featureDensityPercent: 0,
      seed: 11,
    });
    const approachCells = game.board.cells.filter((cell) => cell.row === 1);
    const candidateTiles = [
      { id: 'straight', kind: 'straight' as const },
      { id: 'soft-left', kind: 'softLeft' as const },
      { id: 'soft-right', kind: 'softRight' as const },
      { id: 'hard-left', kind: 'hardLeft' as const },
      { id: 'hard-right', kind: 'hardRight' as const },
    ];
    const edges = [0, 1, 2, 3, 4, 5] as const;

    expect(approachCells.length).toBeGreaterThan(0);

    let winningTile: (typeof candidateTiles)[number] | undefined;
    let goalGame: ReturnType<typeof createGame> | undefined;

    for (const approachCell of approachCells) {
      for (const entryEdge of edges) {
        for (const tile of candidateTiles) {
          const trialGame = {
            ...game,
            frontier: {
              ...game.frontier,
              col: approachCell.col,
              row: approachCell.row,
              entryEdge,
            },
            offer: [tile],
          };

          if (previewMove(trialGame, tile).outcome === 'win') {
            winningTile = tile;
            goalGame = trialGame;
            break;
          }
        }

        if (winningTile && goalGame) {
          break;
        }
      }

      if (winningTile && goalGame) {
        break;
      }
    }

    expect(winningTile).toBeDefined();
    expect(goalGame).toBeDefined();

    const preview = previewMove(goalGame!, winningTile!);
    expect(preview.outcome).toBe('win');
    expect(preview.reason).toBe('Reached a goal space.');

    const wonGame = chooseTile(goalGame!, winningTile!.id);
    expect(wonGame.status).toBe('won');
    expect(wonGame.statusMessage).toBe('Reached a goal space.');
  });
});
