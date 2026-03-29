import { startTransition, useEffect, useMemo, useState } from 'react';
import { BrandBadge } from '@taylorvance/tv-shared-ui';
import './App.css';
import HexBoard from './components/HexBoard';
import {
  SurveyTokenButton,
  TileChoiceButton,
} from './components/TileChoiceButton';
import {
  DEFAULT_RULES,
  chooseTile,
  createGame,
  estimateBoardCellCount,
  estimateFeatureCount,
  estimateObstacleCount,
  estimateTokenCount,
  getRecommendedTileCounts,
  normalizeRules,
  previewMove,
  spendSurveyToken,
  type MovePreview,
  type RulesConfig,
  type Tile,
} from './lib/game';
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

const INITIAL_RULES = withFreshSeed(DEFAULT_RULES);

function createInitialAppState() {
  const persistedState = loadPersistedAppState();
  if (persistedState) {
    return persistedState;
  }

  return {
    draftRules: INITIAL_RULES,
    activeRules: INITIAL_RULES,
    game: createGame(INITIAL_RULES),
    showPlaytestControls: false,
  };
}

function createDefaultAppState() {
  const defaultRules = withFreshSeed(DEFAULT_RULES);

  return {
    draftRules: defaultRules,
    activeRules: defaultRules,
    game: createGame(defaultRules),
    showPlaytestControls: false,
  };
}

function getBagCounts(tiles: Tile[]) {
  return tiles.reduce(
    (counts, tile) => {
      if (tile.kind === 'straight') {
        counts.straight += 1;
      } else if (tile.kind === 'softLeft' || tile.kind === 'softRight') {
        counts.soft += 1;
      } else {
        counts.hard += 1;
      }

      counts.total += 1;
      return counts;
    },
    { straight: 0, soft: 0, hard: 0, total: 0 },
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
  const bagCounts = getBagCounts(game.deck);
  const draftChanged =
    JSON.stringify(normalizeRules(draftRules)) !== JSON.stringify(activeRules);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 720px)');
    const syncLayout = () => setIsMobileLayout(mediaQuery.matches);

    syncLayout();
    mediaQuery.addEventListener('change', syncLayout);

    return () => {
      mediaQuery.removeEventListener('change', syncLayout);
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
      setGame(createGame(normalizedRules));
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
    setGame(createGame(nextRules));
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
          <div className="hero-topline">
            <p className="eyebrow">Rail Puzzle</p>
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

          <h1>Traingame</h1>
          <p className="hero-subtitle">
            Lay track from the bottom to any goal at the top.
          </p>

          <div className="hero-actions">
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
            <SurveyTokenButton
              compact={isMobileLayout}
              disabled={game.status !== 'playing' || game.tokens <= 0}
              onClick={handleSpendToken}
              tokens={game.tokens}
            />
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
            <div className="playbar-meta">
              <div
                aria-label={`Bag has ${bagCounts.total} tiles remaining: ${bagCounts.straight} straight, ${bagCounts.soft} soft-turn, ${bagCounts.hard} hard-turn.`}
                className="bag-indicator"
              >
                <span className="bag-indicator-label">Bag</span>
                <strong className="bag-indicator-total">
                  {bagCounts.total}
                </strong>
                <div aria-hidden="true" className="bag-indicator-bar">
                  <span
                    className="bag-indicator-segment bag-indicator-segment-straight"
                    style={{
                      width: `${bagCounts.total > 0 ? (bagCounts.straight / bagCounts.total) * 100 : 0}%`,
                    }}
                  />
                  <span
                    className="bag-indicator-segment bag-indicator-segment-soft"
                    style={{
                      width: `${bagCounts.total > 0 ? (bagCounts.soft / bagCounts.total) * 100 : 0}%`,
                    }}
                  />
                  <span
                    className="bag-indicator-segment bag-indicator-segment-hard"
                    style={{
                      width: `${bagCounts.total > 0 ? (bagCounts.hard / bagCounts.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="playbar-option-grid">
              {renderTileChoices(isMobileLayout)}
            </div>
          </div>
        </div>
      </header>

      <main className="main-layout">
        <section className="play-column">
          <section className="panel board-panel">
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
                  onClick={() => setDraftRules(activeRules)}
                  type="button"
                >
                  Revert draft
                </button>
                <button
                  className="button-secondary"
                  onClick={handleResetDefaults}
                  type="button"
                >
                  Reset to defaults
                </button>
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
