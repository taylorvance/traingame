import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RULES,
  chooseTile,
  createGame,
  normalizeRules,
  previewMove,
  spendSurveyToken,
} from './game'

describe('normalizeRules', () => {
  it('clamps values and restores tile weights when all are zero', () => {
    const rules = normalizeRules({
      ...DEFAULT_RULES,
      boardWidth: 30,
      boardHeight: 1,
      tokenDensityPercent: 99,
      straightWeight: 0,
      softWeight: 0,
      hardWeight: 0,
    })

    expect(rules.boardWidth).toBe(9)
    expect(rules.boardHeight).toBe(4)
    expect(rules.tokenDensityPercent).toBe(40)
    expect(rules.straightWeight + rules.softWeight + rules.hardWeight).toBeGreaterThan(0)
  })
})

describe('survey flow', () => {
  it('spends a token and reveals two additional options', () => {
    const game = createGame(DEFAULT_RULES)
    const surveyed = spendSurveyToken(game)

    expect(surveyed.tokens).toBe(game.tokens - 1)
    expect(surveyed.offer).toHaveLength(4)
    expect(surveyed.surveyUsedThisTurn).toBe(true)
  })
})

describe('move resolution', () => {
  it('starts by pointing players at highlighted goal spaces', () => {
    const game = createGame(DEFAULT_RULES)

    expect(game.statusMessage).toBe('Lay track from the bottom to any highlighted goal space.')
  })

  it('plays a tile and advances the frontier when the move is safe', () => {
    const game = createGame({
      ...DEFAULT_RULES,
      obstacleCount: 0,
      tokenDensityPercent: 0,
      seed: 11,
    })

    const safeTile = game.offer.find((tile) => previewMove(game, tile).outcome === 'continue')
    expect(safeTile).toBeDefined()

    const nextGame = chooseTile(game, safeTile!.id)
    expect(nextGame.turnNumber).toBe(2)
    expect(nextGame.status).toBe('playing')
    expect(Object.keys(nextGame.occupiedTracks)).toHaveLength(1)
  })

  it('wins by reaching a highlighted goal space without changing the underlying rule', () => {
    const game = createGame({
      ...DEFAULT_RULES,
      obstacleCount: 0,
      tokenDensityPercent: 0,
      seed: 11,
    })
    const goalCell = game.board.cells.find((cell) => cell.row === 0)

    expect(goalCell).toBeDefined()

    const goalGame = {
      ...game,
      frontier: {
        ...game.frontier,
        col: goalCell!.col,
        row: goalCell!.row,
      },
      offer: [{ id: 'goal-tile', kind: 'straight' as const }],
    }

    const preview = previewMove(goalGame, goalGame.offer[0]!)
    expect(preview.outcome).toBe('win')
    expect(preview.reason).toBe('Reached a goal space.')

    const wonGame = chooseTile(goalGame, 'goal-tile')
    expect(wonGame.status).toBe('won')
    expect(wonGame.statusMessage).toBe('Reached a goal space.')
  })
})
