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
  normalizeRules,
  previewMove,
  spendSurveyToken,
  type BoardShape,
  type MovePreview,
  type RulesConfig,
} from './lib/game';
import {
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
    setDraftRules((currentRules) => ({
      ...currentRules,
      [key]: value,
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
              </div>

              <div className="control-group">
                <p className="group-label">Core</p>

                <label className="control-row">
                  <span>Board width</span>
                  <input
                    max={9}
                    min={4}
                    onChange={(event) =>
                      updateDraftRule('boardWidth', Number(event.target.value))
                    }
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

                <label className="control-row">
                  <span>Straight weight</span>
                  <input
                    max={10}
                    min={0}
                    onChange={(event) =>
                      updateDraftRule(
                        'straightWeight',
                        Number(event.target.value),
                      )
                    }
                    type="range"
                    value={draftRules.straightWeight}
                  />
                  <strong>{draftRules.straightWeight}</strong>
                </label>

                <label className="control-row">
                  <span>Soft-turn weight</span>
                  <input
                    max={10}
                    min={0}
                    onChange={(event) =>
                      updateDraftRule('softWeight', Number(event.target.value))
                    }
                    type="range"
                    value={draftRules.softWeight}
                  />
                  <strong>{draftRules.softWeight}</strong>
                </label>

                <label className="control-row">
                  <span>Hard-turn weight</span>
                  <input
                    max={10}
                    min={0}
                    onChange={(event) =>
                      updateDraftRule('hardWeight', Number(event.target.value))
                    }
                    type="range"
                    value={draftRules.hardWeight}
                  />
                  <strong>{draftRules.hardWeight}</strong>
                </label>
              </div>

              <div className="control-group">
                <p className="group-label">Structural</p>

                <label className="select-row">
                  <span>Board shape</span>
                  <select
                    onChange={(event) =>
                      updateDraftRule(
                        'boardShape',
                        event.target.value as BoardShape,
                      )
                    }
                    value={draftRules.boardShape}
                  >
                    <option value="symmetric">Symmetric</option>
                    <option value="asymmetric-left">Asymmetric left</option>
                    <option value="asymmetric-right">Asymmetric right</option>
                  </select>
                </label>

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
