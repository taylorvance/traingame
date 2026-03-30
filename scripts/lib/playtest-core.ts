import {
  DEFAULT_RULES,
  type GameState,
  type MovePreview,
  type RulesConfig,
  type Tile,
  type TileKind,
  chooseTile,
  createGame,
  previewMove,
  spendSurveyToken,
} from '../../src/lib/game.ts';

export type PlaytestPolicyId =
  | 'random'
  | 'safeRandom'
  | 'surveyHeuristic'
  | 'monteCarlo';

export interface PlaytestPolicyConfig {
  id: PlaytestPolicyId;
  rolloutCount?: number;
  surveyRolloutCount?: number;
}

export interface SimulatedTurn {
  turnNumber: number;
  offerSize: number;
  offeredTileKinds: TileKind[];
  safeOptionCount: number;
  surveysSpent: number;
  surveyRescued: boolean;
  chosenTileKind: TileKind;
  preview: MovePreview;
}

export interface SimulatedGameResult {
  seed: number;
  policyId: PlaytestPolicyId;
  status: GameState['status'];
  statusMessage: string;
  turnsPlayed: number;
  surveysSpent: number;
  forcedLossTurns: number;
  surveyRescueTurns: number;
  tokensCollected: number;
  remainingTokens: number;
  turnLog: SimulatedTurn[];
}

export interface TilePickStats {
  offered: number;
  picked: number;
  winningPicks: number;
}

export interface PlaytestAggregate {
  label: string;
  policyId: PlaytestPolicyId;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  averageTurns: number;
  averageTurnsOnWin: number;
  averageTurnsOnLoss: number;
  averageSurveysSpent: number;
  averageSurveyRescues: number;
  averageForcedLossTurns: number;
  averageTokensCollected: number;
  averageRemainingTokens: number;
  gamesWithForcedLossTurn: number;
  gamesRescuedBySurvey: number;
  averageSafeOptionsSeen: number;
  averageOfferSize: number;
  statusCounts: Record<string, number>;
  lossReasonCounts: Record<string, number>;
  tileStats: Record<TileKind, TilePickStats>;
}

export interface ExperimentConfig {
  label: string;
  rules: RulesConfig;
  games: number;
  seedStart?: number;
  policy: PlaytestPolicyConfig;
}

const TILE_KINDS: TileKind[] = [
  'straight',
  'softLeft',
  'softRight',
  'hardLeft',
  'hardRight',
];

const ABSTRACT_TILES: Tile[] = TILE_KINDS.map((kind) => ({
  id: `abstract-${kind}`,
  kind,
}));

function nextRandom(state: number): [number, number] {
  let seed = state >>> 0;
  seed = (seed + 0x6d2b79f5) >>> 0;
  let mixed = seed;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return [((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296, seed];
}

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    const [value, nextState] = nextRandom(this.state);
    this.state = nextState;
    return value;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty list.');
    }

    const index = Math.floor(this.next() * items.length);
    return items[index] ?? items[0]!;
  }
}

function createTileStats(): Record<TileKind, TilePickStats> {
  return {
    straight: { offered: 0, picked: 0, winningPicks: 0 },
    softLeft: { offered: 0, picked: 0, winningPicks: 0 },
    softRight: { offered: 0, picked: 0, winningPicks: 0 },
    hardLeft: { offered: 0, picked: 0, winningPicks: 0 },
    hardRight: { offered: 0, picked: 0, winningPicks: 0 },
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function safePreviews(game: GameState): MovePreview[] {
  return game.offer
    .map((tile) => previewMove(game, tile))
    .filter((preview) => preview.outcome !== 'loss');
}

function countImmediateSafeAbstractMoves(game: GameState): number {
  return ABSTRACT_TILES.filter(
    (tile) => previewMove(game, tile).outcome !== 'loss',
  ).length;
}

function buildProjectedState(
  game: GameState,
  tile: Tile,
  preview: MovePreview,
): GameState | null {
  if (preview.outcome !== 'continue' || !preview.nextKey) {
    return null;
  }

  const [nextCol, nextRow] = preview.nextKey.split(',').map(Number);
  if (!Number.isFinite(nextCol) || !Number.isFinite(nextRow)) {
    return null;
  }

  return {
    ...game,
    frontier: {
      col: nextCol,
      row: nextRow,
      entryEdge: ((preview.exitEdge + 3) % 6) as GameState['frontier']['entryEdge'],
      requiredColor: preview.nextRequiredColor,
    },
    tokenCells:
      preview.tokenGain > 0
        ? game.tokenCells.filter((key) => key !== preview.targetKey)
        : game.tokenCells,
    occupiedTracks: {
      ...game.occupiedTracks,
      [preview.targetKey]: {
        tile,
        entryEdge: game.frontier.entryEdge,
        entryColor: game.frontier.requiredColor,
        exitEdge: preview.exitEdge,
        exitColor: preview.nextRequiredColor,
        turnNumber: game.turnNumber,
      },
    },
  };
}

function evaluatePreviewHeuristic(game: GameState, preview: MovePreview): number {
  if (preview.outcome === 'win') {
    return 10000 + preview.tokenGain * 300;
  }

  if (preview.outcome === 'loss') {
    return -10000;
  }

  const projectedState = buildProjectedState(game, preview.tile, preview);
  const projectedSafeMoves = projectedState
    ? countImmediateSafeAbstractMoves(projectedState)
    : 0;
  const [nextCol, nextRow] = (preview.nextKey ?? preview.targetKey)
    .split(',')
    .map(Number);
  const boardCenter = (game.board.width - 1) / 2;
  const centralityPenalty = Math.abs((nextCol ?? game.frontier.col) - boardCenter);

  return (
    3000
    - (nextRow ?? game.frontier.row) * 120
    - centralityPenalty * 24
    + projectedSafeMoves * 180
    + preview.tokenGain * 220
  );
}

function pickBestHeuristicTile(game: GameState, random: SeededRandom): Tile {
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestTiles: Tile[] = [];

  for (const tile of game.offer) {
    const score = evaluatePreviewHeuristic(game, previewMove(game, tile));
    if (score > bestScore) {
      bestScore = score;
      bestTiles = [tile];
      continue;
    }

    if (score === bestScore) {
      bestTiles.push(tile);
    }
  }

  return random.pick(bestTiles);
}

function rewardForTerminalState(game: GameState, tokensCollected: number): number {
  const placedTrackCount = Object.keys(game.occupiedTracks).length;
  const totalTiles =
    game.rules.straightWeight + game.rules.softWeight + game.rules.hardWeight;
  const progress = totalTiles > 0 ? placedTrackCount / totalTiles : 0;

  if (game.status === 'won') {
    return 1.2 + game.tokens * 0.02 + tokensCollected * 0.01 - progress * 0.08;
  }

  return progress * 0.35 + game.tokens * 0.015 + tokensCollected * 0.01;
}

function selectStochasticSafeTile(game: GameState, random: SeededRandom): Tile {
  const scoredTiles = game.offer.map((tile) => {
    const preview = previewMove(game, tile);
    return {
      score: evaluatePreviewHeuristic(game, preview),
      tile,
      preview,
    };
  });
  const safeTiles = scoredTiles.filter(({ preview }) => preview.outcome !== 'loss');
  const source = safeTiles.length > 0 ? safeTiles : scoredTiles;
  const ranked = [...source].sort((left, right) => right.score - left.score);
  const shortlist = ranked.slice(0, Math.min(2, ranked.length)).map(({ tile }) => tile);

  return random.pick(shortlist);
}

function shouldSpendSurveyHeuristically(
  game: GameState,
  random: SeededRandom,
): boolean {
  if (game.tokens <= 0 || game.deck.length === 0) {
    return false;
  }

  const currentSafeMoves = safePreviews(game).length;
  if (currentSafeMoves === 0) {
    return true;
  }

  const currentBest = evaluatePreviewHeuristic(
    game,
    previewMove(game, pickBestHeuristicTile(game, random)),
  );
  const surveyedGame = spendSurveyToken(game);
  if (surveyedGame.tokens === game.tokens) {
    return false;
  }

  const surveyedBest = evaluatePreviewHeuristic(
    surveyedGame,
    previewMove(surveyedGame, pickBestHeuristicTile(surveyedGame, random)),
  );

  return surveyedBest >= currentBest + 260;
}

function playoutStep(
  game: GameState,
  random: SeededRandom,
  allowSurvey: boolean,
): { game: GameState; tokensCollected: number } {
  let nextGame = game;
  let tokensCollected = 0;

  if (
    allowSurvey
    && nextGame.tokens > 0
    && nextGame.deck.length > 0
    && safePreviews(nextGame).length === 0
  ) {
    const surveyedGame = spendSurveyToken(nextGame);
    if (surveyedGame.tokens < nextGame.tokens) {
      nextGame = surveyedGame;
    }
  }

  const chosenTile = selectStochasticSafeTile(nextGame, random);
  const preview = previewMove(nextGame, chosenTile);
  tokensCollected += preview.tokenGain;

  return {
    game: chooseTile(nextGame, chosenTile.id),
    tokensCollected,
  };
}

function rolloutFromState(
  initialGame: GameState,
  random: SeededRandom,
  allowSurvey: boolean,
): number {
  let game = initialGame;
  let tokensCollected = 0;
  let guard = 0;

  while (game.status === 'playing' && guard < 200) {
    const step = playoutStep(game, random, allowSurvey);
    game = step.game;
    tokensCollected += step.tokensCollected;
    guard += 1;
  }

  return rewardForTerminalState(game, tokensCollected);
}

function scoreTileByMonteCarlo(
  game: GameState,
  tile: Tile,
  random: SeededRandom,
  rolloutCount: number,
): number {
  const preview = previewMove(game, tile);
  if (preview.outcome === 'win') {
    return 2;
  }

  if (preview.outcome === 'loss') {
    return -1;
  }

  const nextGame = chooseTile(game, tile.id);
  let total = 0;

  for (let index = 0; index < rolloutCount; index += 1) {
    total += rolloutFromState(nextGame, random, true);
  }

  return total / rolloutCount;
}

function pickBestMonteCarloTile(
  game: GameState,
  random: SeededRandom,
  rolloutCount: number,
): Tile {
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestTiles: Tile[] = [];

  for (const tile of game.offer) {
    const score = scoreTileByMonteCarlo(game, tile, random, rolloutCount);
    if (score > bestScore) {
      bestScore = score;
      bestTiles = [tile];
      continue;
    }

    if (score === bestScore) {
      bestTiles.push(tile);
    }
  }

  return random.pick(bestTiles);
}

function shouldSpendSurveyByMonteCarlo(
  game: GameState,
  random: SeededRandom,
  rolloutCount: number,
): boolean {
  if (game.tokens <= 0 || game.deck.length === 0) {
    return false;
  }

  const currentSafeMoves = safePreviews(game).length;
  if (currentSafeMoves === 0) {
    return true;
  }

  const currentBestTile = pickBestMonteCarloTile(game, random, rolloutCount);
  const currentBestScore = scoreTileByMonteCarlo(
    game,
    currentBestTile,
    random,
    rolloutCount,
  );
  const surveyedGame = spendSurveyToken(game);

  if (surveyedGame.tokens === game.tokens) {
    return false;
  }

  const surveyedBestTile = pickBestMonteCarloTile(
    surveyedGame,
    random,
    rolloutCount,
  );
  const surveyedBestScore = scoreTileByMonteCarlo(
    surveyedGame,
    surveyedBestTile,
    random,
    rolloutCount,
  );

  return surveyedBestScore >= currentBestScore + 0.08;
}

function chooseTileForPolicy(
  game: GameState,
  policy: PlaytestPolicyConfig,
  random: SeededRandom,
): Tile {
  switch (policy.id) {
    case 'random':
      return random.pick(game.offer);
    case 'safeRandom': {
      const safeTiles = game.offer.filter(
        (tile) => previewMove(game, tile).outcome !== 'loss',
      );
      return random.pick(safeTiles.length > 0 ? safeTiles : game.offer);
    }
    case 'surveyHeuristic':
      return pickBestHeuristicTile(game, random);
    case 'monteCarlo':
      return pickBestMonteCarloTile(game, random, policy.rolloutCount ?? 12);
  }
}

function shouldSpendSurveyForPolicy(
  game: GameState,
  policy: PlaytestPolicyConfig,
  random: SeededRandom,
): boolean {
  switch (policy.id) {
    case 'random':
      return false;
    case 'safeRandom':
      return game.tokens > 0 && game.deck.length > 0 && safePreviews(game).length === 0;
    case 'surveyHeuristic':
      return shouldSpendSurveyHeuristically(game, random);
    case 'monteCarlo':
      return shouldSpendSurveyByMonteCarlo(
        game,
        random,
        policy.surveyRolloutCount ?? policy.rolloutCount ?? 12,
      );
  }
}

export function simulateGame(
  rules: RulesConfig,
  policy: PlaytestPolicyConfig,
): SimulatedGameResult {
  const seededRules = {
    ...DEFAULT_RULES,
    ...rules,
  };
  let game = createGame(seededRules);
  const random = new SeededRandom((seededRules.seed ^ 0x9e3779b9) >>> 0);
  let surveysSpent = 0;
  let forcedLossTurns = 0;
  let surveyRescueTurns = 0;
  let tokensCollected = 0;
  const turnLog: SimulatedTurn[] = [];
  let guard = 0;

  while (game.status === 'playing' && guard < 200) {
    const safeOptionCountAtStart = safePreviews(game).length;
    if (safeOptionCountAtStart === 0) {
      forcedLossTurns += 1;
    }

    let currentGame = game;
    let spentThisTurn = 0;

    while (shouldSpendSurveyForPolicy(currentGame, policy, random)) {
      const surveyedGame = spendSurveyToken(currentGame);
      if (surveyedGame.tokens === currentGame.tokens) {
        break;
      }

      currentGame = surveyedGame;
      surveysSpent += 1;
      spentThisTurn += 1;
    }

    const safeOptionCountAfterSurvey = safePreviews(currentGame).length;
    const surveyRescued =
      safeOptionCountAtStart === 0 && safeOptionCountAfterSurvey > 0;
    if (surveyRescued) {
      surveyRescueTurns += 1;
    }

    const chosenTile = chooseTileForPolicy(currentGame, policy, random);
    const preview = previewMove(currentGame, chosenTile);
    tokensCollected += preview.tokenGain;
    game = chooseTile(currentGame, chosenTile.id);
    turnLog.push({
      turnNumber: currentGame.turnNumber,
      offerSize: currentGame.offer.length,
      offeredTileKinds: currentGame.offer.map((tile) => tile.kind),
      safeOptionCount: safeOptionCountAfterSurvey,
      surveysSpent: spentThisTurn,
      surveyRescued,
      chosenTileKind: chosenTile.kind,
      preview,
    });
    guard += 1;
  }

  return {
    seed: seededRules.seed,
    policyId: policy.id,
    status: game.status,
    statusMessage: game.statusMessage,
    turnsPlayed: Object.keys(game.occupiedTracks).length,
    surveysSpent,
    forcedLossTurns,
    surveyRescueTurns,
    tokensCollected,
    remainingTokens: game.tokens,
    turnLog,
  };
}

export function runExperiment(config: ExperimentConfig): PlaytestAggregate {
  const seedStart = config.seedStart ?? 1;
  const tileStats = createTileStats();
  const statusCounts: Record<string, number> = {};
  const lossReasonCounts: Record<string, number> = {};
  let wins = 0;
  let losses = 0;
  let totalTurns = 0;
  let totalTurnsOnWin = 0;
  let totalTurnsOnLoss = 0;
  let totalSurveysSpent = 0;
  let totalSurveyRescues = 0;
  let totalForcedLossTurns = 0;
  let totalTokensCollected = 0;
  let totalRemainingTokens = 0;
  let totalSafeOptionsSeen = 0;
  let totalOfferSize = 0;
  let gamesWithForcedLossTurn = 0;
  let gamesRescuedBySurvey = 0;

  for (let index = 0; index < config.games; index += 1) {
    const result = simulateGame(
      {
        ...config.rules,
        seed: seedStart + index,
      },
      config.policy,
    );

    statusCounts[result.status] = (statusCounts[result.status] ?? 0) + 1;

    if (result.status === 'won') {
      wins += 1;
      totalTurnsOnWin += result.turnsPlayed;
    } else {
      losses += 1;
      totalTurnsOnLoss += result.turnsPlayed;
      lossReasonCounts[result.statusMessage] =
        (lossReasonCounts[result.statusMessage] ?? 0) + 1;
    }

    if (result.forcedLossTurns > 0) {
      gamesWithForcedLossTurn += 1;
    }

    if (result.surveyRescueTurns > 0) {
      gamesRescuedBySurvey += 1;
    }

    totalTurns += result.turnsPlayed;
    totalSurveysSpent += result.surveysSpent;
    totalSurveyRescues += result.surveyRescueTurns;
    totalForcedLossTurns += result.forcedLossTurns;
    totalTokensCollected += result.tokensCollected;
    totalRemainingTokens += result.remainingTokens;

    for (const turn of result.turnLog) {
      totalSafeOptionsSeen += turn.safeOptionCount;
      totalOfferSize += turn.offerSize;

      for (const tileKind of turn.offeredTileKinds) {
        tileStats[tileKind].offered += 1;
      }

      tileStats[turn.chosenTileKind].picked += 1;
      if (result.status === 'won') {
        tileStats[turn.chosenTileKind].winningPicks += 1;
      }
    }
  }

  return {
    label: config.label,
    policyId: config.policy.id,
    games: config.games,
    wins,
    losses,
    winRate: round(wins / config.games),
    averageTurns: round(totalTurns / config.games),
    averageTurnsOnWin: wins > 0 ? round(totalTurnsOnWin / wins) : 0,
    averageTurnsOnLoss: losses > 0 ? round(totalTurnsOnLoss / losses) : 0,
    averageSurveysSpent: round(totalSurveysSpent / config.games),
    averageSurveyRescues: round(totalSurveyRescues / config.games),
    averageForcedLossTurns: round(totalForcedLossTurns / config.games),
    averageTokensCollected: round(totalTokensCollected / config.games),
    averageRemainingTokens: round(totalRemainingTokens / config.games),
    gamesWithForcedLossTurn,
    gamesRescuedBySurvey,
    averageSafeOptionsSeen:
      totalTurns > 0 ? round(totalSafeOptionsSeen / totalTurns) : 0,
    averageOfferSize: totalTurns > 0 ? round(totalOfferSize / totalTurns) : 0,
    statusCounts,
    lossReasonCounts,
    tileStats,
  };
}

export function sortCounts(
  counts: Record<string, number>,
): Array<[string, number]> {
  return Object.entries(counts).sort((left, right) => right[1] - left[1]);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatAggregateTable(
  aggregates: readonly PlaytestAggregate[],
): string {
  const rows = [
    [
      'Label',
      'Policy',
      'Win Rate',
      'Avg Turns',
      'Avg Surveys',
      'Avg Tokens',
      'Forced Loss Games',
      'Survey Rescue Games',
    ],
    ...aggregates.map((aggregate) => [
      aggregate.label,
      aggregate.policyId,
      formatPercent(aggregate.winRate),
      aggregate.averageTurns.toFixed(2),
      aggregate.averageSurveysSpent.toFixed(2),
      aggregate.averageTokensCollected.toFixed(2),
      `${aggregate.gamesWithForcedLossTurn}/${aggregate.games}`,
      `${aggregate.gamesRescuedBySurvey}/${aggregate.games}`,
    ]),
  ];

  const widths = rows[0]!.map((_, columnIndex) =>
    Math.max(...rows.map((row) => row[columnIndex]!.length)),
  );

  return rows
    .map((row, rowIndex) => {
      const line = row
        .map((cell, columnIndex) => cell.padEnd(widths[columnIndex]))
        .join(' | ');

      if (rowIndex === 0) {
        const divider = widths.map((width) => '-'.repeat(width)).join('-|-');
        return `${line}\n${divider}`;
      }

      return line;
    })
    .join('\n');
}
