import {
  createProjectStorage,
  type ProjectStorage,
} from '@taylorvance/tv-shared-web/storage';
import {
  DEFAULT_RULES,
  createGame,
  estimateFeatureCellCount,
  normalizeRules,
  type BoardShape,
  type Color,
  type Edge,
  type GameState,
  type GameStatus,
  type RulesConfig,
  type TileKind,
} from './game';

const APP_STORAGE = createProjectStorage('traingame', { version: 1 });
const APP_STATE_KEY = 'app-state';

export interface PersistedAppState {
  activeRules: RulesConfig;
  draftRules: RulesConfig;
  game: GameState;
  showPlaytestControls: boolean;
}

type AppStateReader = Pick<ProjectStorage, 'readJson'>;
type AppStateWriter = Pick<ProjectStorage, 'writeJson' | 'remove'>;

const BOARD_SHAPES: BoardShape[] = [
  'symmetric',
  'asymmetric-left',
  'asymmetric-right',
];
const COLORS: Color[] = ['red', 'blue'];
const GAME_STATUSES: GameStatus[] = ['playing', 'won', 'lost'];
const TILE_KINDS: TileKind[] = [
  'straight',
  'softLeft',
  'softRight',
  'hardLeft',
  'hardRight',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isBoardShape(value: unknown): value is BoardShape {
  return (
    typeof value === 'string' && BOARD_SHAPES.includes(value as BoardShape)
  );
}

function isColor(value: unknown): value is Color {
  return typeof value === 'string' && COLORS.includes(value as Color);
}

function isGameStatus(value: unknown): value is GameStatus {
  return (
    typeof value === 'string' && GAME_STATUSES.includes(value as GameStatus)
  );
}

function isTileKind(value: unknown): value is TileKind {
  return typeof value === 'string' && TILE_KINDS.includes(value as TileKind);
}

function isEdge(value: unknown): value is Edge {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 5
  );
}

function isRulesConfig(value: unknown): value is RulesConfig {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.boardWidth) &&
    isFiniteNumber(value.boardHeight) &&
    isBoardShape(value.boardShape) &&
    isFiniteNumber(value.featureDensityPercent) &&
    isFiniteNumber(value.hazardBalancePercent) &&
    isFiniteNumber(value.startingTokens) &&
    isFiniteNumber(value.straightWeight) &&
    isFiniteNumber(value.softWeight) &&
    isFiniteNumber(value.hardWeight) &&
    isFiniteNumber(value.seed)
  );
}

function isCell(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.col) &&
    isFiniteNumber(value.row) &&
    typeof value.key === 'string'
  );
}

function isBoardState(value: unknown): boolean {
  return (
    isRecord(value) &&
    Array.isArray(value.cells) &&
    value.cells.every(isCell) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    isBoardShape(value.shape) &&
    isCell(value.start)
  );
}

function isFrontier(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.col) &&
    isFiniteNumber(value.row) &&
    isEdge(value.entryEdge) &&
    isColor(value.requiredColor)
  );
}

function isTile(value: unknown): boolean {
  return (
    isRecord(value) && typeof value.id === 'string' && isTileKind(value.kind)
  );
}

function isPlacedTrack(value: unknown): boolean {
  return (
    isRecord(value) &&
    isTile(value.tile) &&
    isEdge(value.entryEdge) &&
    isColor(value.entryColor) &&
    isEdge(value.exitEdge) &&
    isColor(value.exitColor) &&
    isFiniteNumber(value.turnNumber)
  );
}

function isTurnRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.turnNumber) &&
    isTileKind(value.tileKind) &&
    typeof value.targetKey === 'string' &&
    typeof value.summary === 'string'
  );
}

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || !isRecord(value.occupiedTracks)) {
    return false;
  }

  return (
    isRulesConfig(value.rules) &&
    isBoardState(value.board) &&
    isGameStatus(value.status) &&
    typeof value.statusMessage === 'string' &&
    isFiniteNumber(value.turnNumber) &&
    isFiniteNumber(value.tokens) &&
    isFrontier(value.frontier) &&
    isStringArray(value.tokenCells) &&
    isStringArray(value.obstacleCells) &&
    Object.values(value.occupiedTracks).every(isPlacedTrack) &&
    Array.isArray(value.offer) &&
    value.offer.every(isTile) &&
    typeof value.surveyUsedThisTurn === 'boolean' &&
    Array.isArray(value.history) &&
    value.history.every(isTurnRecord) &&
    Array.isArray(value.deck) &&
    value.deck.every(isTile) &&
    isFiniteNumber(value.rngState) &&
    isFiniteNumber(value.nextTileSerial)
  );
}

function normalizeSavedRules(value: unknown): RulesConfig | null {
  if (isRulesConfig(value)) {
    return normalizeRules(value);
  }

  if (
    !isRecord(value) ||
    !isFiniteNumber(value.boardWidth) ||
    !isFiniteNumber(value.boardHeight) ||
    !isBoardShape(value.boardShape) ||
    !isFiniteNumber(value.startingTokens) ||
    !isFiniteNumber(value.straightWeight) ||
    !isFiniteNumber(value.softWeight) ||
    !isFiniteNumber(value.hardWeight) ||
    !isFiniteNumber(value.seed)
  ) {
    return null;
  }

  const baseRules = normalizeRules({
    boardWidth: value.boardWidth,
    boardHeight: value.boardHeight,
    boardShape: value.boardShape,
    featureDensityPercent: DEFAULT_RULES.featureDensityPercent,
    hazardBalancePercent: DEFAULT_RULES.hazardBalancePercent,
    startingTokens: value.startingTokens,
    straightWeight: value.straightWeight,
    softWeight: value.softWeight,
    hardWeight: value.hardWeight,
    seed: value.seed,
  });
  const featureCellCount = Math.max(1, estimateFeatureCellCount(baseRules));
  const obstaclePercent = isFiniteNumber(value.obstacleDensityPercent)
    ? value.obstacleDensityPercent
    : isFiniteNumber(value.obstacleCount)
      ? (value.obstacleCount / featureCellCount) * 100
      : 0;
  const tokenPercent = isFiniteNumber(value.tokenDensityPercent)
    ? value.tokenDensityPercent
    : 0;
  const featureDensityPercent = obstaclePercent + tokenPercent;
  const hazardBalancePercent =
    featureDensityPercent > 0
      ? (obstaclePercent / featureDensityPercent) * 100
      : DEFAULT_RULES.hazardBalancePercent;

  if (
    featureDensityPercent === 0 &&
    !isFiniteNumber(value.obstacleCount) &&
    !isFiniteNumber(value.obstacleDensityPercent) &&
    !isFiniteNumber(value.tokenDensityPercent) &&
    !isFiniteNumber(value.featureDensityPercent)
  ) {
    return null;
  }

  return normalizeRules({
    ...baseRules,
    featureDensityPercent: isFiniteNumber(value.featureDensityPercent)
      ? value.featureDensityPercent
      : featureDensityPercent,
    hazardBalancePercent,
  });
}

export function loadPersistedAppState(
  storage: AppStateReader = APP_STORAGE,
): PersistedAppState | null {
  const snapshot = storage.readJson<unknown>(APP_STATE_KEY);
  if (!isRecord(snapshot)) {
    return null;
  }

  const persistedGame = isGameState(snapshot.game) ? snapshot.game : null;
  const activeRules = persistedGame
    ? normalizeRules(persistedGame.rules)
    : normalizeSavedRules(snapshot.activeRules);

  if (!activeRules) {
    return null;
  }

  const draftRules = normalizeSavedRules(snapshot.draftRules) ?? activeRules;
  const game = persistedGame ?? createGame(activeRules);

  return {
    activeRules,
    draftRules,
    game,
    showPlaytestControls: snapshot.showPlaytestControls === true,
  };
}

export function savePersistedAppState(
  state: PersistedAppState,
  storage: AppStateWriter = APP_STORAGE,
): void {
  storage.writeJson(state, APP_STATE_KEY);
}

export function clearPersistedAppState(
  storage: AppStateWriter = APP_STORAGE,
): void {
  storage.remove(APP_STATE_KEY);
}
