import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { BrandBadge } from '@taylorvance/tv-shared-ui';
import './App.css';
import HexBoard from './components/HexBoard';
import {
  getEdgeTieSegment,
  getHexPoints,
  getRailPaths,
} from './components/railGeometry';
import {
  SurveyTokenButton,
  TileChoiceButton,
} from './components/TileChoiceButton';
import {
  chooseTile,
  createGame,
  createGameFromSetupDeck,
  estimateBoardCellCount,
  estimateFeatureCount,
  estimateObstacleCount,
  estimateTokenCount,
  getBoardCoordinateLabelFromKey,
  getExitEdge,
  getRecommendedTileCounts,
  normalizeRules,
  previewMove,
  spendSurveyToken,
  type MovePreview,
  type RulesConfig,
  type Tile,
  type TileKind,
} from './lib/game';
import {
  DEFAULT_PRESET_RULES,
  RULES_PRESETS,
  findMatchingRulesPreset,
  type RulesPreset,
} from './lib/presets';
import {
  clearPersistedAppState,
  loadPersistedAppState,
  savePersistedAppState,
} from './lib/persistence';

function rollSeed(): number {
  return Math.floor(Math.random() * 2147483647) + 1;
}

function withFreshSeed(rules: RulesConfig): RulesConfig {
  return {
    ...rules,
    seed: rollSeed(),
  };
}

function createGameForRules(rules: RulesConfig): ReturnType<typeof createGame> {
  return findMatchingRulesPreset(rules)
    ? createGameFromSetupDeck(rules)
    : createGame(rules);
}

const INITIAL_RULES = withFreshSeed(DEFAULT_PRESET_RULES);

function createInitialAppState() {
  const persistedState = loadPersistedAppState();
  if (persistedState) {
    return persistedState;
  }

  return {
    draftRules: INITIAL_RULES,
    activeRules: INITIAL_RULES,
    game: createGameForRules(INITIAL_RULES),
    showPlaytestControls: false,
  };
}

function createDefaultAppState() {
  const defaultRules = withFreshSeed(DEFAULT_PRESET_RULES);

  return {
    draftRules: defaultRules,
    activeRules: defaultRules,
    game: createGameForRules(defaultRules),
    showPlaytestControls: false,
  };
}

const BAG_KIND_ORDER: TileKind[] = [
  'hardLeft',
  'softLeft',
  'straight',
  'softRight',
  'hardRight',
];

const BAG_KIND_LABELS: Record<TileKind, string> = {
  straight: 'Straight',
  softLeft: 'Soft left',
  softRight: 'Soft right',
  hardLeft: 'Hard left',
  hardRight: 'Hard right',
};

function getBagCounts(tiles: Tile[]) {
  return tiles.reduce(
    (counts, tile) => {
      counts[tile.kind] += 1;
      counts.total += 1;
      return counts;
    },
    {
      straight: 0,
      softLeft: 0,
      softRight: 0,
      hardLeft: 0,
      hardRight: 0,
      total: 0,
    },
  );
}

function getBagAriaLabel(
  counts: ReturnType<typeof getBagCounts>,
): string {
  const summary = BAG_KIND_ORDER.filter((kind) => counts[kind] > 0)
    .map((kind) => `${counts[kind]} ${BAG_KIND_LABELS[kind].toLowerCase()}`)
    .join(', ');

  return summary.length > 0
    ? `Bag has ${counts.total} future tiles including the current offer. Canonical tile previews show the red endpoint on the bottom edge: ${summary}.`
    : 'Bag is empty.';
}

function compareCellKeysByCoordinate(a: string, b: string): number {
  const [aCol, aRow] = a.split(',').map(Number);
  const [bCol, bRow] = b.split(',').map(Number);

  if (aCol !== bCol) {
    return aCol - bCol;
  }

  return aRow - bRow;
}

function formatCellList(keys: string[], emptyLabel: string): string {
  if (keys.length === 0) {
    return emptyLabel;
  }

  return [...keys]
    .sort(compareCellKeysByCoordinate)
    .map((key) => getBoardCoordinateLabelFromKey(key))
    .join(', ');
}

function buildSetupCardText({
  game,
}: {
  game: ReturnType<typeof createGame>;
}): string {
  return [
    'Traingame Setup Card',
    `Board: ${game.board.width}x${game.board.height} ${game.board.shape}`,
    `Start: ${getBoardCoordinateLabelFromKey(game.board.start.key)}`,
    `Bag: ${game.rules.straightWeight} straight, ${game.rules.softWeight} soft-turn, ${game.rules.hardWeight} hard-turn`,
    `Starting survey tokens: ${game.rules.startingTokens}`,
    `Mountains: ${formatCellList(game.obstacleCells, 'none')}`,
    `Survey token spaces: ${formatCellList(game.tokenCells, 'none')}`,
    `Seed: ${game.rules.seed}`,
  ].join('\n');
}

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back below for browsers that block the async clipboard API.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';

  document.body.append(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function getMobileOfferColumns(
  offerCount: number,
  isCompactMobileLayout: boolean,
): number {
  if (offerCount <= 1) {
    return 1;
  }

  if (offerCount <= 2) {
    return 2;
  }

  if (offerCount <= 4 || isCompactMobileLayout) {
    return 4;
  }

  return 6;
}

function BagIndicator({
  counts,
}: {
  counts: ReturnType<typeof getBagCounts>;
}) {
  return (
    <div
      aria-label={getBagAriaLabel(counts)}
      className="bag-indicator"
    >
      <span aria-hidden="true" className="bag-indicator-label">
        Bag
      </span>
      <div aria-hidden="true" className="bag-indicator-glyphs">
        {BAG_KIND_ORDER.map((kind) => {
          const center = 18;
          const radius = 13.5;
          const clipId = `bag-indicator-${kind}-clip`;
          const hexPoints = getHexPoints(radius, center, center);
          const exitEdge = getExitEdge(3, kind);
          const railPaths = getRailPaths(
            radius,
            center,
            center,
            3,
            exitEdge,
            1.9,
          );

          return (
            <span
              className={`bag-indicator-chip bag-indicator-chip-${kind} ${
                counts[kind] === 0 ? 'bag-indicator-chip-empty' : ''
              }`}
              key={kind}
              title={`${BAG_KIND_LABELS[kind]}: ${counts[kind]}`}
            >
              <svg
                className="bag-indicator-svg"
                role="img"
                viewBox="0 0 36 36"
              >
                <defs>
                  <clipPath id={clipId}>
                    <polygon points={hexPoints} />
                  </clipPath>
                </defs>
                <polygon className="bag-indicator-shell" points={hexPoints} />
                <g clipPath={`url(#${clipId})`}>
                  <line
                    className="bag-indicator-half-tie bag-indicator-half-tie-red"
                    {...getEdgeTieSegment(radius, center, center, 3)}
                  />
                  <line
                    className="bag-indicator-half-tie bag-indicator-half-tie-blue"
                    {...getEdgeTieSegment(radius, center, center, exitEdge)}
                  />
                </g>
                <path className="bag-indicator-track" d={railPaths.left} />
                <path className="bag-indicator-track" d={railPaths.right} />
              </svg>
              <span className="bag-indicator-count">{counts[kind]}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function App() {
  const [initialAppState] = useState(createInitialAppState);
  const [draftRules, setDraftRules] = useState<RulesConfig>(
    initialAppState.draftRules,
  );
  const [activeRules, setActiveRules] = useState<RulesConfig>(
    initialAppState.activeRules,
  );
  const [game, setGame] = useState(initialAppState.game);
  const [hoveredTileId, setHoveredTileId] = useState<string | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [isCompactMobileLayout, setIsCompactMobileLayout] = useState(false);
  const [copySetupStatus, setCopySetupStatus] = useState<
    'idle' | 'copied' | 'failed'
  >('idle');
  const [showPlaytestControls, setShowPlaytestControls] = useState(
    initialAppState.showPlaytestControls,
  );

  const previews = useMemo<Record<string, MovePreview>>(
    () =>
      Object.fromEntries(
        game.offer.map((tile) => [tile.id, previewMove(game, tile)]),
      ),
    [game],
  );
  const estimatedObstacles = estimateObstacleCount(draftRules);
  const estimatedFeatures = estimateFeatureCount(draftRules);
  const estimatedTokens = estimateTokenCount(draftRules);
  const estimatedCells = estimateBoardCellCount(draftRules);
  const bagCounts = getBagCounts([...game.deck, ...game.offer]);
  const normalizedDraftRules = normalizeRules(draftRules);
  const setupCardText = useMemo(() => buildSetupCardText({ game }), [game]);
  const activePreset = findMatchingRulesPreset(activeRules);
  const mobileOfferColumns = getMobileOfferColumns(
    game.offer.length,
    isCompactMobileLayout,
  );
  const playbarGridStyle = isMobileLayout
    ? ({ '--offer-columns': String(mobileOfferColumns) } as CSSProperties)
    : undefined;
  const draftChanged =
    JSON.stringify(normalizedDraftRules) !== JSON.stringify(activeRules);
  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 720px)');
    const compactMobileQuery = window.matchMedia('(max-width: 380px)');
    const syncLayout = () => {
      setIsMobileLayout(mobileQuery.matches);
      setIsCompactMobileLayout(compactMobileQuery.matches);
    };

    syncLayout();
    mobileQuery.addEventListener('change', syncLayout);
    compactMobileQuery.addEventListener('change', syncLayout);

    return () => {
      mobileQuery.removeEventListener('change', syncLayout);
      compactMobileQuery.removeEventListener('change', syncLayout);
    };
  }, []);

  useEffect(() => {
    savePersistedAppState({
      draftRules,
      activeRules,
      game,
      showPlaytestControls,
    });
  }, [activeRules, draftRules, game, showPlaytestControls]);

  useEffect(() => {
    if (copySetupStatus === 'idle') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopySetupStatus('idle');
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copySetupStatus]);

  useEffect(() => {
    if (!showPlaytestControls) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowPlaytestControls(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPlaytestControls]);

  useEffect(() => {
    if (!showPlaytestControls) {
      return undefined;
    }

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction;

    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';

    return () => {
      body.style.overflow = previousOverflow;
      body.style.touchAction = previousTouchAction;
    };
  }, [showPlaytestControls]);

  function updateDraftRule<K extends keyof RulesConfig>(
    key: K,
    value: RulesConfig[K],
  ) {
    setDraftRules((currentRules) => {
      const nextRules = {
        ...currentRules,
        [key]: value,
      };

      if (
        key !== 'boardWidth' &&
        key !== 'boardHeight' &&
        key !== 'boardShape'
      ) {
        return nextRules;
      }

      const currentRecommendedCounts = getRecommendedTileCounts(
        currentRules.boardWidth,
        currentRules.boardHeight,
        currentRules.boardShape,
      );
      const usesRecommendedCounts =
        currentRules.straightWeight ===
          currentRecommendedCounts.straightWeight &&
        currentRules.softWeight === currentRecommendedCounts.softWeight &&
        currentRules.hardWeight === currentRecommendedCounts.hardWeight;

      if (!usesRecommendedCounts) {
        return nextRules;
      }

      return {
        ...nextRules,
        ...getRecommendedTileCounts(
          nextRules.boardWidth,
          nextRules.boardHeight,
          nextRules.boardShape,
        ),
      };
    });
  }

  function nudgeDraftRule<K extends keyof RulesConfig>(
    key: K,
    delta: number,
    min: number,
    max: number,
  ) {
    setDraftRules((currentRules) => ({
      ...currentRules,
      [key]: Math.max(
        min,
        Math.min(max, Number(currentRules[key]) + delta),
      ) as RulesConfig[K],
    }));
  }

  function applyDraftRules() {
    const normalizedRules = normalizeRules(withFreshSeed(draftRules));
    startTransition(() => {
      setActiveRules(normalizedRules);
      setDraftRules(normalizedRules);
      setGame(createGameForRules(normalizedRules));
      setHoveredTileId(null);
    });
  }

  function handleNewGame() {
    const nextRules = withFreshSeed(activeRules);
    setActiveRules(nextRules);
    setDraftRules((currentRules) => ({
      ...currentRules,
      seed: nextRules.seed,
    }));
    setGame(createGameForRules(nextRules));
    setHoveredTileId(null);
  }

  function handleResetDefaults() {
    const defaultAppState = createDefaultAppState();
    clearPersistedAppState();
    setDraftRules(defaultAppState.draftRules);
    setActiveRules(defaultAppState.activeRules);
    setGame(defaultAppState.game);
    setHoveredTileId(null);
    setShowPlaytestControls(false);
  }

  function handleChooseTile(tileId: string) {
    setGame((currentGame) => chooseTile(currentGame, tileId));
    setHoveredTileId(null);
  }

  function handleSpendToken() {
    setGame((currentGame) => spendSurveyToken(currentGame));
    setHoveredTileId(null);
  }

  function togglePlaytestControls() {
    setShowPlaytestControls((currentValue) => !currentValue);
  }

  function handleChoosePreset(preset: RulesPreset) {
    const presetRules = normalizeRules(withFreshSeed(preset.rules));
    setActiveRules(presetRules);
    setDraftRules(presetRules);
    setGame(createGameFromSetupDeck(presetRules));
    setHoveredTileId(null);
  }

  async function handleCopySetup() {
    const copied = await copyText(setupCardText);

    if (copied) {
      setCopySetupStatus('copied');
    } else {
      setCopySetupStatus('failed');
    }
  }

  function renderTileChoices(compact: boolean) {
    if (game.offer.length === 0) {
      return (
        <p
          className={
            compact ? 'empty-state empty-state-compact' : 'empty-state'
          }
        >
          {game.status === 'playing'
            ? 'No options loaded.'
            : game.status === 'won'
              ? 'Route complete. Start a new game.'
              : 'Game over. Start a new game.'}
        </p>
      );
    }

    return game.offer.map((tile) => {
      const preview = previews[tile.id];

      return (
        <TileChoiceButton
          compact={compact}
          disabled={game.status !== 'playing'}
          entryEdge={game.frontier.entryEdge}
          hovered={hoveredTileId === tile.id}
          key={tile.id}
          onBlur={() =>
            setHoveredTileId((current) =>
              current === tile.id ? null : current,
            )
          }
          onChoose={() => handleChooseTile(tile.id)}
          onFocus={() => setHoveredTileId(tile.id)}
          onHoverEnd={() =>
            setHoveredTileId((current) =>
              current === tile.id ? null : current,
            )
          }
          onHoverStart={() => setHoveredTileId(tile.id)}
          preview={preview}
          requiredColor={game.frontier.requiredColor}
        />
      );
    });
  }

  return (
    <div
      className={isMobileLayout ? 'app-shell app-shell-mobile' : 'app-shell'}
    >
      <div className="rail-glow rail-glow-a" />
      <div className="rail-glow rail-glow-b" />

      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Rail Puzzle</p>
          <div className="hero-title-row">
            <h1>Traingame</h1>
            <button
              aria-label={
                showPlaytestControls
                  ? 'Hide playtest controls'
                  : 'Show playtest controls'
              }
              className={
                showPlaytestControls
                  ? 'settings-button settings-button-active'
                  : 'settings-button'
              }
              onClick={togglePlaytestControls}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="settings-icon"
                viewBox="0 0 24 24"
              >
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
                <circle cx="9" cy="7" r="2.2" />
                <circle cx="15" cy="12" r="2.2" />
                <circle cx="11" cy="17" r="2.2" />
              </svg>
            </button>
          </div>
          <p className="hero-subtitle">
            Lay track from the bottom to any goal at the top.
          </p>

          <div className="hero-actions">
            <div className="hero-actions-primary">
              <button
                aria-label="Start a new game"
                className="new-game-button new-game-button-compact"
                onClick={handleNewGame}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  className="new-game-icon"
                  viewBox="0 0 24 24"
                >
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0 1 15.6-6.36L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 0 1-15.6 6.36L3 16" />
                </svg>
              </button>
              <BagIndicator counts={bagCounts} />
              <SurveyTokenButton
                compact={isMobileLayout}
                disabled={game.status !== 'playing' || game.tokens <= 0}
                onClick={handleSpendToken}
                tokens={game.tokens}
              />
            </div>
            {showPlaytestControls ? (
              <button
                className="button-secondary"
                onClick={applyDraftRules}
                type="button"
              >
                Apply settings
              </button>
            ) : null}
          </div>

          <div className="playbar">
            <div className="playbar-option-grid" style={playbarGridStyle}>
              {renderTileChoices(isMobileLayout)}
            </div>
          </div>
        </div>
      </header>

      <main className="main-layout">
        <section className="play-column">
          <section className="panel board-panel">
            <div className="board-panel-meta">
              <span className="mode-pill">
                {activePreset ? activePreset.label : 'Custom'}
              </span>
            </div>
            <HexBoard game={game} />
          </section>

          {!isMobileLayout && game.history.length > 0 ? (
            <section className="panel log-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Run Log</p>
                  <h2>Recent Turns</h2>
                </div>
              </div>

              <ol className="turn-list">
                {game.history.map((turn) => (
                  <li
                    className="turn-item"
                    key={`${turn.turnNumber}-${turn.targetKey}`}
                  >
                    <strong>Turn {turn.turnNumber}.</strong> {turn.summary}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </section>
      </main>

      {showPlaytestControls ? (
        <>
          <button
            aria-label="Close playtest controls"
            className="lab-backdrop"
            onClick={() => setShowPlaytestControls(false)}
            type="button"
          />
          <aside
            aria-label="Playtest controls"
            className={
              isMobileLayout
                ? 'lab-panel lab-panel-mobile'
                : 'lab-panel lab-panel-desktop'
            }
          >
            <div className="lab-panel-inner">
              <div className="lab-handle" />

              <div className="lab-header">
                <div>
                  <p className="eyebrow">Lab</p>
                  <h2>Playtest Controls</h2>
                </div>
                <div className="lab-header-actions">
                  <span
                    className={
                      draftChanged ? 'soft-pill soft-pill-alert' : 'soft-pill'
                    }
                  >
                    {draftChanged ? 'Pending changes' : 'In sync'}
                  </span>
                  <button
                    aria-label="Close playtest controls"
                    className="settings-button"
                    onClick={() => setShowPlaytestControls(false)}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="settings-icon"
                      viewBox="0 0 24 24"
                    >
                      <path d="M6 6l12 12" />
                      <path d="M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="control-actions">
                <button onClick={applyDraftRules} type="button">
                  Apply + new game
                </button>
                <button
                  className="button-secondary"
                  onClick={handleResetDefaults}
                  type="button"
                >
                  Reset to defaults
                </button>
              </div>

              {copySetupStatus !== 'idle' ? (
                <p className="control-copy-feedback">
                  {copySetupStatus === 'copied'
                    ? 'Setup card copied.'
                    : 'Clipboard copy failed. The setup card text is below.'}
                </p>
              ) : null}

              <div className="control-group">
                <p className="group-label">Difficulty</p>
                <div className="preset-grid">
                  {RULES_PRESETS.map((preset) => (
                    <button
                      className={
                        activePreset?.id === preset.id
                          ? 'preset-card preset-card-active'
                          : 'preset-card'
                      }
                      key={preset.id}
                      onClick={() => handleChoosePreset(preset)}
                      type="button"
                    >
                      <span className="preset-card-label">{preset.label}</span>
                      <span className="preset-card-copy">
                        {preset.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-group">
                <p className="group-label">Setup Card</p>
                <div className="setup-card-box">
                  <button
                    aria-label="Copy setup card"
                    className="setup-card-copy-button"
                    onClick={() => {
                      void handleCopySetup();
                    }}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="setup-card-copy-icon"
                      viewBox="0 0 24 24"
                    >
                      <rect x="9" y="9" width="10" height="10" rx="2" />
                      <path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <pre className="setup-card-preview">{setupCardText}</pre>
                </div>
              </div>

              <div className="control-group">
                <p className="group-label">Core</p>

                <label className="control-row">
                  <span>Board width</span>
                  <input
                    max={9}
                    min={5}
                    onChange={(event) =>
                      updateDraftRule('boardWidth', Number(event.target.value))
                    }
                    step={2}
                    type="range"
                    value={draftRules.boardWidth}
                  />
                  <strong>{draftRules.boardWidth}</strong>
                </label>

                <label className="control-row">
                  <span>Board height</span>
                  <input
                    max={11}
                    min={4}
                    onChange={(event) =>
                      updateDraftRule('boardHeight', Number(event.target.value))
                    }
                    type="range"
                    value={draftRules.boardHeight}
                  />
                  <strong>{draftRules.boardHeight}</strong>
                </label>

                <label className="control-row">
                  <span>Starting tokens</span>
                  <input
                    max={5}
                    min={0}
                    onChange={(event) =>
                      updateDraftRule(
                        'startingTokens',
                        Number(event.target.value),
                      )
                    }
                    type="range"
                    value={draftRules.startingTokens}
                  />
                  <strong>{draftRules.startingTokens}</strong>
                </label>

                <label className="stepper-row">
                  <span>Straight tiles</span>
                  <div className="stepper-control">
                    <button
                      aria-label="Decrease straight tiles"
                      className="stepper-button"
                      disabled={draftRules.straightWeight <= 0}
                      onClick={() =>
                        nudgeDraftRule('straightWeight', -1, 0, 24)
                      }
                      type="button"
                    >
                      -
                    </button>
                    <strong>{draftRules.straightWeight}</strong>
                    <button
                      aria-label="Increase straight tiles"
                      className="stepper-button"
                      disabled={draftRules.straightWeight >= 24}
                      onClick={() => nudgeDraftRule('straightWeight', 1, 0, 24)}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                </label>

                <label className="stepper-row">
                  <span>Soft-turn tiles</span>
                  <div className="stepper-control">
                    <button
                      aria-label="Decrease soft-turn tiles"
                      className="stepper-button"
                      disabled={draftRules.softWeight <= 0}
                      onClick={() => nudgeDraftRule('softWeight', -1, 0, 24)}
                      type="button"
                    >
                      -
                    </button>
                    <strong>{draftRules.softWeight}</strong>
                    <button
                      aria-label="Increase soft-turn tiles"
                      className="stepper-button"
                      disabled={draftRules.softWeight >= 24}
                      onClick={() => nudgeDraftRule('softWeight', 1, 0, 24)}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                </label>

                <label className="stepper-row">
                  <span>Hard-turn tiles</span>
                  <div className="stepper-control">
                    <button
                      aria-label="Decrease hard-turn tiles"
                      className="stepper-button"
                      disabled={draftRules.hardWeight <= 0}
                      onClick={() => nudgeDraftRule('hardWeight', -1, 0, 24)}
                      type="button"
                    >
                      -
                    </button>
                    <strong>{draftRules.hardWeight}</strong>
                    <button
                      aria-label="Increase hard-turn tiles"
                      className="stepper-button"
                      disabled={draftRules.hardWeight >= 24}
                      onClick={() => nudgeDraftRule('hardWeight', 1, 0, 24)}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                </label>
              </div>

              <div className="control-group">
                <p className="group-label">Structural</p>

                <label className="control-row">
                  <span>Features</span>
                  <input
                    max={40}
                    min={0}
                    onChange={(event) =>
                      updateDraftRule(
                        'featureDensityPercent',
                        Number(event.target.value),
                      )
                    }
                    type="range"
                    value={draftRules.featureDensityPercent}
                  />
                  <strong>{draftRules.featureDensityPercent}%</strong>
                </label>

                <label className="control-row">
                  <span>Hazard balance</span>
                  <input
                    max={100}
                    min={0}
                    onChange={(event) =>
                      updateDraftRule(
                        'hazardBalancePercent',
                        Number(event.target.value),
                      )
                    }
                    type="range"
                    value={draftRules.hazardBalancePercent}
                  />
                  <strong>
                    {draftRules.hazardBalancePercent}% /{' '}
                    {100 - draftRules.hazardBalancePercent}%
                  </strong>
                </label>

                <label className="number-row">
                  <span>Seed</span>
                  <input
                    onChange={(event) =>
                      updateDraftRule('seed', Number(event.target.value))
                    }
                    type="number"
                    value={draftRules.seed}
                  />
                </label>
              </div>

              <div className="summary-grid">
                <article className="summary-card">
                  <span>Valid cells</span>
                  <strong>{estimatedCells}</strong>
                </article>
                <article className="summary-card">
                  <span>Est. features</span>
                  <strong>{estimatedFeatures}</strong>
                </article>
                <article className="summary-card">
                  <span>Rewards / hazards</span>
                  <strong>
                    {estimatedTokens} / {estimatedObstacles}
                  </strong>
                </article>
              </div>

            </div>
          </aside>
        </>
      ) : null}

      {!isMobileLayout ? (
        <footer className="app-footer">
          <BrandBadge
            className="brand-badge"
            iconClassName="brand-badge-icon"
            labelClassName="brand-badge-label"
            unstyled
          />
        </footer>
      ) : null}
    </div>
  );
}

export default App;
