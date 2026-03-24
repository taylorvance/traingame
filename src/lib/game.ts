export type Color = 'red' | 'blue'
export type BoardShape = 'symmetric' | 'asymmetric-left' | 'asymmetric-right'
export type TileKind = 'straight' | 'softLeft' | 'softRight' | 'hardLeft' | 'hardRight'
export type GameStatus = 'playing' | 'won' | 'lost'
export type Edge = 0 | 1 | 2 | 3 | 4 | 5

export interface RulesConfig {
  boardWidth: number
  boardHeight: number
  boardShape: BoardShape
  obstacleCount: number
  startingTokens: number
  tokenDensityPercent: number
  straightWeight: number
  softWeight: number
  hardWeight: number
  seed: number
}

export interface Cell {
  col: number
  row: number
  key: string
}

export interface BoardState {
  cells: Cell[]
  width: number
  height: number
  shape: BoardShape
  start: Cell
}

export interface Frontier {
  col: number
  row: number
  entryEdge: Edge
  requiredColor: Color
}

export interface Tile {
  id: string
  kind: TileKind
}

export interface PlacedTrack {
  tile: Tile
  entryEdge: Edge
  exitEdge: Edge
  turnNumber: number
}

export interface TurnRecord {
  turnNumber: number
  tileKind: TileKind
  targetKey: string
  summary: string
}

export interface GameState {
  rules: RulesConfig
  board: BoardState
  status: GameStatus
  statusMessage: string
  turnNumber: number
  tokens: number
  frontier: Frontier
  tokenCells: string[]
  obstacleCells: string[]
  occupiedTracks: Record<string, PlacedTrack>
  offer: Tile[]
  surveyUsedThisTurn: boolean
  history: TurnRecord[]
  deck: Tile[]
  rngState: number
  nextTileSerial: number
}

export interface MovePreview {
  tile: Tile
  targetKey: string
  exitEdge: Edge
  nextKey: string | null
  nextRequiredColor: Color
  tokenGain: number
  outcome: 'continue' | 'win' | 'loss'
  reason: string
}

const DEFAULT_SEED = 4317
const START_ENTRY_EDGE: Edge = 3

export const DEFAULT_RULES: RulesConfig = {
  boardWidth: 6,
  boardHeight: 7,
  boardShape: 'symmetric',
  obstacleCount: 2,
  startingTokens: 1,
  tokenDensityPercent: 12,
  straightWeight: 4,
  softWeight: 5,
  hardWeight: 3,
  seed: DEFAULT_SEED,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`
}

function toggleColor(color: Color): Color {
  return color === 'red' ? 'blue' : 'red'
}

function oppositeEdge(edge: Edge): Edge {
  return ((edge + 3) % 6) as Edge
}

function isOdd(value: number): boolean {
  return Math.abs(value % 2) === 1
}

function nextRandom(state: number): [number, number] {
  let seed = state >>> 0
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const random = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [random, seed]
}

function randomIndex(length: number, state: number): [number, number] {
  const [value, nextState] = nextRandom(state)
  return [Math.floor(value * length), nextState]
}

function shuffleTiles(items: Tile[], state: number): [Tile[], number] {
  const nextItems = [...items]
  let nextState = state

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const [swapIndex, shuffledState] = randomIndex(index + 1, nextState)
    nextState = shuffledState
    const hold = nextItems[index]
    nextItems[index] = nextItems[swapIndex]
    nextItems[swapIndex] = hold
  }

  return [nextItems, nextState]
}

function getTileKindLabel(kind: TileKind): string {
  switch (kind) {
    case 'straight':
      return 'Straight'
    case 'softLeft':
      return 'Soft left'
    case 'softRight':
      return 'Soft right'
    case 'hardLeft':
      return 'Hard left'
    case 'hardRight':
      return 'Hard right'
  }
}

function buildRowSpan(width: number, row: number, boardShape: BoardShape): [number, number] {
  if (width <= 4) {
    return [0, width - 1]
  }

  if (boardShape === 'symmetric' && row === 0) {
    return [1, width - 2]
  }

  if (boardShape === 'asymmetric-left' && row <= 1) {
    return [Math.min(2, width - 2), width - 1]
  }

  if (boardShape === 'asymmetric-right' && row <= 1) {
    return [0, Math.max(1, width - 3)]
  }

  return [0, width - 1]
}

function buildBoard(rules: RulesConfig): BoardState {
  const cells: Cell[] = []

  for (let row = 0; row < rules.boardHeight; row += 1) {
    const [startCol, endCol] = buildRowSpan(rules.boardWidth, row, rules.boardShape)

    for (let col = startCol; col <= endCol; col += 1) {
      cells.push({
        col,
        row,
        key: cellKey(col, row),
      })
    }
  }

  const startCol = Math.floor(rules.boardWidth / 2)
  const startRow = rules.boardHeight - 1
  const start = cells.find((cell) => cell.col === startCol && cell.row === startRow) ?? cells[cells.length - 1]

  return {
    cells,
    width: rules.boardWidth,
    height: rules.boardHeight,
    shape: rules.boardShape,
    start,
  }
}

function fillPoolCount(weight: number, totalWeight: number, totalTiles: number): number {
  if (weight <= 0 || totalWeight <= 0) {
    return 0
  }

  return Math.max(1, Math.round((weight / totalWeight) * totalTiles))
}

function createTileBatch(
  rules: RulesConfig,
  totalTiles: number,
  nextTileSerial: number,
  state: number,
): [Tile[], number, number] {
  const totalWeight = rules.straightWeight + rules.softWeight + rules.hardWeight
  const safeTotalWeight = totalWeight > 0 ? totalWeight : 1
  const straightCount = fillPoolCount(rules.straightWeight, safeTotalWeight, totalTiles)
  const softCount = fillPoolCount(rules.softWeight, safeTotalWeight, totalTiles)
  const hardCount = fillPoolCount(rules.hardWeight, safeTotalWeight, totalTiles)
  const tiles: Tile[] = []
  let serial = nextTileSerial

  for (let count = 0; count < straightCount; count += 1) {
    tiles.push({ id: `tile-${serial}`, kind: 'straight' })
    serial += 1
  }

  for (let count = 0; count < softCount; count += 1) {
    tiles.push({ id: `tile-${serial}`, kind: count % 2 === 0 ? 'softLeft' : 'softRight' })
    serial += 1
  }

  for (let count = 0; count < hardCount; count += 1) {
    tiles.push({ id: `tile-${serial}`, kind: count % 2 === 0 ? 'hardLeft' : 'hardRight' })
    serial += 1
  }

  while (tiles.length < totalTiles) {
    tiles.push({ id: `tile-${serial}`, kind: 'straight' })
    serial += 1
  }

  const [shuffledTiles, nextState] = shuffleTiles(tiles, state)
  return [shuffledTiles, serial, nextState]
}

function topUpDeck(
  deck: Tile[],
  rules: RulesConfig,
  boardCellCount: number,
  nextTileSerial: number,
  state: number,
): [Tile[], number, number] {
  if (deck.length >= 6) {
    return [deck, nextTileSerial, state]
  }

  const batchSize = Math.max(18, boardCellCount * 2)
  const [extraTiles, nextSerial, nextState] = createTileBatch(rules, batchSize, nextTileSerial, state)
  return [[...deck, ...extraTiles], nextSerial, nextState]
}

function drawTiles(
  deck: Tile[],
  count: number,
  rules: RulesConfig,
  boardCellCount: number,
  nextTileSerial: number,
  state: number,
): [Tile[], Tile[], number, number] {
  let workingDeck = deck
  let serial = nextTileSerial
  let nextState = state

  ;[workingDeck, serial, nextState] = topUpDeck(workingDeck, rules, boardCellCount, serial, nextState)

  if (workingDeck.length < count) {
    ;[workingDeck, serial, nextState] = topUpDeck([], rules, boardCellCount, serial, nextState)
  }

  return [workingDeck.slice(count), workingDeck.slice(0, count), serial, nextState]
}

function returnTilesToDeck(deck: Tile[], tiles: Tile[], state: number): [Tile[], number] {
  const [shuffledTiles, nextState] = shuffleTiles([...deck, ...tiles], state)
  return [shuffledTiles, nextState]
}

function sampleCellKeys(
  sourceKeys: string[],
  count: number,
  state: number,
): [string[], number] {
  const pool = [...sourceKeys]
  const chosen: string[] = []
  let nextState = state
  const drawCount = Math.min(count, pool.length)

  for (let index = 0; index < drawCount; index += 1) {
    const [choiceIndex, sampledState] = randomIndex(pool.length, nextState)
    nextState = sampledState
    const [choice] = pool.splice(choiceIndex, 1)
    if (choice) {
      chosen.push(choice)
    }
  }

  return [chosen, nextState]
}

function generateBoardFeatures(board: BoardState, rules: RulesConfig, state: number): [string[], string[], number] {
  const startKey = board.start.key
  const nonStartCells = board.cells.filter((cell) => cell.key !== startKey && cell.row !== 0).map((cell) => cell.key)
  const obstacleCap = Math.min(rules.obstacleCount, Math.max(0, nonStartCells.length - 1))
  const [obstacleCells, obstacleState] = sampleCellKeys(nonStartCells, obstacleCap, state)
  const obstacleSet = new Set(obstacleCells)
  const tokenCandidates = board.cells
    .filter((cell) => cell.key !== startKey && !obstacleSet.has(cell.key))
    .map((cell) => cell.key)
  const desiredTokens = Math.round(board.cells.length * (rules.tokenDensityPercent / 100))
  const [tokenCells, tokenState] = sampleCellKeys(tokenCandidates, desiredTokens, obstacleState)

  return [tokenCells, obstacleCells, tokenState]
}

function getNeighbor(col: number, row: number, edge: Edge): [number, number] {
  if (isOdd(col)) {
    switch (edge) {
      case 0:
        return [col, row - 1]
      case 1:
        return [col + 1, row]
      case 2:
        return [col + 1, row + 1]
      case 3:
        return [col, row + 1]
      case 4:
        return [col - 1, row + 1]
      case 5:
        return [col - 1, row]
    }
  }

  switch (edge) {
    case 0:
      return [col, row - 1]
    case 1:
      return [col + 1, row - 1]
    case 2:
      return [col + 1, row]
    case 3:
      return [col, row + 1]
    case 4:
      return [col - 1, row]
    case 5:
      return [col - 1, row - 1]
  }
}

export function getExitEdge(entryEdge: Edge, tileKind: TileKind): Edge {
  switch (tileKind) {
    case 'straight':
      return oppositeEdge(entryEdge)
    case 'softLeft':
      return ((entryEdge + 2) % 6) as Edge
    case 'softRight':
      return ((entryEdge + 4) % 6) as Edge
    case 'hardLeft':
      return ((entryEdge + 1) % 6) as Edge
    case 'hardRight':
      return ((entryEdge + 5) % 6) as Edge
  }
}

export function normalizeRules(rules: RulesConfig): RulesConfig {
  const nextRules = {
    boardWidth: clamp(Math.round(rules.boardWidth), 4, 9),
    boardHeight: clamp(Math.round(rules.boardHeight), 4, 11),
    boardShape: rules.boardShape,
    obstacleCount: clamp(Math.round(rules.obstacleCount), 0, 12),
    startingTokens: clamp(Math.round(rules.startingTokens), 0, 5),
    tokenDensityPercent: clamp(Math.round(rules.tokenDensityPercent), 0, 40),
    straightWeight: clamp(Math.round(rules.straightWeight), 0, 10),
    softWeight: clamp(Math.round(rules.softWeight), 0, 10),
    hardWeight: clamp(Math.round(rules.hardWeight), 0, 10),
    seed: Math.round(rules.seed) || DEFAULT_SEED,
  } satisfies RulesConfig

  if (nextRules.straightWeight + nextRules.softWeight + nextRules.hardWeight === 0) {
    nextRules.straightWeight = DEFAULT_RULES.straightWeight
    nextRules.softWeight = DEFAULT_RULES.softWeight
    nextRules.hardWeight = DEFAULT_RULES.hardWeight
  }

  return nextRules
}

function hasCell(board: BoardState, key: string): boolean {
  return board.cells.some((cell) => cell.key === key)
}

function describePreview(preview: MovePreview): string {
  if (preview.outcome === 'win') {
    return preview.tokenGain > 0 ? 'Reached a goal space and collected a token.' : 'Reached a goal space.'
  }

  if (preview.outcome === 'loss') {
    return preview.reason
  }

  if (preview.tokenGain > 0) {
    return `Continues and gains ${preview.tokenGain} token.`
  }

  return `Continues ${preview.reason.toLowerCase()}.`
}

export function previewMove(game: GameState, tile: Tile): MovePreview {
  const { frontier } = game
  const targetKey = cellKey(frontier.col, frontier.row)
  const exitEdge = getExitEdge(frontier.entryEdge, tile.kind)
  const nextRequiredColor = toggleColor(frontier.requiredColor)

  if (!hasCell(game.board, targetKey)) {
    return {
      tile,
      targetKey,
      exitEdge,
      nextKey: null,
      nextRequiredColor,
      tokenGain: 0,
      outcome: 'loss',
      reason: 'Leaves the board before placing.',
    }
  }

  if (game.obstacleCells.includes(targetKey)) {
    return {
      tile,
      targetKey,
      exitEdge,
      nextKey: null,
      nextRequiredColor,
      tokenGain: 0,
      outcome: 'loss',
      reason: 'Hits an obstacle.',
    }
  }

  if (game.occupiedTracks[targetKey]) {
    return {
      tile,
      targetKey,
      exitEdge,
      nextKey: null,
      nextRequiredColor,
      tokenGain: 0,
      outcome: 'loss',
      reason: 'Collides with existing track.',
    }
  }

  const tokenGain = game.tokenCells.includes(targetKey) ? 1 : 0

  if (frontier.row === 0) {
    return {
      tile,
      targetKey,
      exitEdge,
      nextKey: null,
      nextRequiredColor,
      tokenGain,
      outcome: 'win',
      reason: 'Reached a goal space.',
    }
  }

  const [nextCol, nextRow] = getNeighbor(frontier.col, frontier.row, exitEdge)
  const nextKey = cellKey(nextCol, nextRow)

  if (!hasCell(game.board, nextKey)) {
    return {
      tile,
      targetKey,
      exitEdge,
      nextKey: null,
      nextRequiredColor,
      tokenGain,
      outcome: 'loss',
      reason: 'Exits off the board.',
    }
  }

  return {
    tile,
    targetKey,
    exitEdge,
    nextKey,
    nextRequiredColor,
    tokenGain,
    outcome: 'continue',
    reason: `toward ${nextKey}`,
  }
}

function drawNextTurnOffer(game: GameState): Pick<GameState, 'deck' | 'offer' | 'nextTileSerial' | 'rngState' | 'surveyUsedThisTurn'> {
  const [deck, offer, nextTileSerial, rngState] = drawTiles(
    game.deck,
    2,
    game.rules,
    game.board.cells.length,
    game.nextTileSerial,
    game.rngState,
  )

  return {
    deck,
    offer,
    nextTileSerial,
    rngState,
    surveyUsedThisTurn: false,
  }
}

export function createGame(inputRules: RulesConfig): GameState {
  const rules = normalizeRules(inputRules)
  const board = buildBoard(rules)
  const [tokenCells, obstacleCells, featureState] = generateBoardFeatures(board, rules, rules.seed >>> 0)
  const [initialDeck, initialOffer, nextTileSerial, rngState] = drawTiles([], 2, rules, board.cells.length, 1, featureState)

  return {
    rules,
    board,
    status: 'playing',
    statusMessage: 'Lay track from the bottom to any highlighted goal space.',
    turnNumber: 1,
    tokens: rules.startingTokens,
    frontier: {
      col: board.start.col,
      row: board.start.row,
      entryEdge: START_ENTRY_EDGE,
      requiredColor: 'red',
    },
    tokenCells,
    obstacleCells,
    occupiedTracks: {},
    offer: initialOffer,
    surveyUsedThisTurn: false,
    history: [],
    deck: initialDeck,
    rngState,
    nextTileSerial,
  }
}

export function spendSurveyToken(game: GameState): GameState {
  if (game.status !== 'playing' || game.tokens <= 0 || game.surveyUsedThisTurn) {
    return game
  }

  const [deck, extraTiles, nextTileSerial, rngState] = drawTiles(
    game.deck,
    2,
    game.rules,
    game.board.cells.length,
    game.nextTileSerial,
    game.rngState,
  )

  return {
    ...game,
    tokens: game.tokens - 1,
    surveyUsedThisTurn: true,
    deck,
    offer: [...game.offer, ...extraTiles],
    nextTileSerial,
    rngState,
    statusMessage: 'Surveyor hired. Choose from four forced placements.',
  }
}

export function chooseTile(game: GameState, tileId: string): GameState {
  if (game.status !== 'playing') {
    return game
  }

  const chosenTile = game.offer.find((tile) => tile.id === tileId)
  if (!chosenTile) {
    return game
  }

  const preview = previewMove(game, chosenTile)
  const unusedTiles = game.offer.filter((tile) => tile.id !== tileId)
  const tokens = game.tokens + preview.tokenGain
  let tokenCells = game.tokenCells
  let deck = game.deck
  let rngState = game.rngState
  ;[deck, rngState] = returnTilesToDeck(deck, unusedTiles, rngState)

  if (preview.tokenGain > 0) {
    tokenCells = tokenCells.filter((key) => key !== preview.targetKey)
  }

  const occupiedTracks = {
    ...game.occupiedTracks,
    [preview.targetKey]: {
      tile: chosenTile,
      entryEdge: game.frontier.entryEdge,
      exitEdge: preview.exitEdge,
      turnNumber: game.turnNumber,
    },
  }

  const historyEntry: TurnRecord = {
    turnNumber: game.turnNumber,
    tileKind: chosenTile.kind,
    targetKey: preview.targetKey,
    summary: `${getTileKindLabel(chosenTile.kind)} on ${preview.targetKey}. ${describePreview(preview)}`,
  }

  if (preview.outcome === 'loss') {
    return {
      ...game,
      tokens,
      tokenCells,
      deck,
      rngState,
      occupiedTracks,
      offer: [],
      history: [historyEntry, ...game.history].slice(0, 12),
      status: 'lost',
      statusMessage: preview.reason,
    }
  }

  if (preview.outcome === 'win') {
    return {
      ...game,
      tokens,
      tokenCells,
      deck,
      rngState,
      occupiedTracks,
      offer: [],
      history: [historyEntry, ...game.history].slice(0, 12),
      status: 'won',
      statusMessage: 'Reached a goal space.',
    }
  }

  const nextFrontier = preview.nextKey?.split(',').map(Number)
  if (!nextFrontier || nextFrontier.length !== 2) {
    return game
  }

  const provisionalGame: GameState = {
    ...game,
    turnNumber: game.turnNumber + 1,
    tokens,
    tokenCells,
    deck,
    rngState,
    occupiedTracks,
    offer: [],
    surveyUsedThisTurn: false,
    history: [historyEntry, ...game.history].slice(0, 12),
    frontier: {
      col: nextFrontier[0] ?? 0,
      row: nextFrontier[1] ?? 0,
      entryEdge: oppositeEdge(preview.exitEdge),
      requiredColor: preview.nextRequiredColor,
    },
    statusMessage: preview.tokenGain > 0 ? 'Token collected. Choose the next tile.' : 'Track advanced.',
  }

  const nextTurnOffer = drawNextTurnOffer(provisionalGame)
  return {
    ...provisionalGame,
    ...nextTurnOffer,
  }
}

export function estimateTokenCount(rules: RulesConfig): number {
  const board = buildBoard(normalizeRules(rules))
  return Math.round(board.cells.length * (rules.tokenDensityPercent / 100))
}

export function estimateBoardCellCount(rules: RulesConfig): number {
  return buildBoard(normalizeRules(rules)).cells.length
}

export function getTileKindText(tile: Tile): string {
  return getTileKindLabel(tile.kind)
}

export function getBoardCellMap(board: BoardState): Record<string, Cell> {
  return Object.fromEntries(board.cells.map((cell) => [cell.key, cell]))
}
