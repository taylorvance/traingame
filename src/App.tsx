import { startTransition, useEffect, useMemo, useState } from 'react'
import { BrandBadge } from '@taylorvance/tv-shared-ui'
import './App.css'
import HexBoard from './components/HexBoard'
import { SurveyTokenButton, TileChoiceButton } from './components/TileChoiceButton'
import {
  DEFAULT_RULES,
  chooseTile,
  createGame,
  estimateBoardCellCount,
  estimateTokenCount,
  normalizeRules,
  previewMove,
  spendSurveyToken,
  type BoardShape,
  type MovePreview,
  type RulesConfig,
} from './lib/game'

type MobilePanel = 'play' | 'tune'

function rollSeed(): number {
  return Math.floor(Math.random() * 2147483647) + 1
}

function withFreshSeed(rules: RulesConfig): RulesConfig {
  return {
    ...rules,
    seed: rollSeed(),
  }
}

const INITIAL_RULES = withFreshSeed(DEFAULT_RULES)

function formatShapeLabel(shape: BoardShape): string {
  switch (shape) {
    case 'symmetric':
      return 'Symmetric'
    case 'asymmetric-left':
      return 'Asymmetric left'
    case 'asymmetric-right':
      return 'Asymmetric right'
  }
}

function App() {
  const [draftRules, setDraftRules] = useState<RulesConfig>(INITIAL_RULES)
  const [activeRules, setActiveRules] = useState<RulesConfig>(INITIAL_RULES)
  const [game, setGame] = useState(() => createGame(INITIAL_RULES))
  const [hoveredTileId, setHoveredTileId] = useState<string | null>(null)
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('play')
  const [isMobileLayout, setIsMobileLayout] = useState(false)

  const previews = useMemo<Record<string, MovePreview>>(
    () => Object.fromEntries(game.offer.map((tile) => [tile.id, previewMove(game, tile)])),
    [game],
  )
  const estimatedTokens = estimateTokenCount(draftRules)
  const estimatedCells = estimateBoardCellCount(draftRules)
  const draftChanged = JSON.stringify(normalizeRules(draftRules)) !== JSON.stringify(activeRules)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 720px)')
    const syncLayout = () => setIsMobileLayout(mediaQuery.matches)

    syncLayout()
    mediaQuery.addEventListener('change', syncLayout)

    return () => {
      mediaQuery.removeEventListener('change', syncLayout)
    }
  }, [])

  function updateDraftRule<K extends keyof RulesConfig>(key: K, value: RulesConfig[K]) {
    setDraftRules((currentRules) => ({
      ...currentRules,
      [key]: value,
    }))
  }

  function applyDraftRules() {
    const normalizedRules = normalizeRules(withFreshSeed(draftRules))
    startTransition(() => {
      setActiveRules(normalizedRules)
      setDraftRules(normalizedRules)
      setGame(createGame(normalizedRules))
      setHoveredTileId(null)
    })
  }

  function handleNewGame() {
    const nextRules = withFreshSeed(activeRules)
    setActiveRules(nextRules)
    setDraftRules((currentRules) => ({
      ...currentRules,
      seed: nextRules.seed,
    }))
    setGame(createGame(nextRules))
    setHoveredTileId(null)
  }

  function handleChooseTile(tileId: string) {
    setGame((currentGame) => chooseTile(currentGame, tileId))
    setHoveredTileId(null)
  }

  function handleSpendToken() {
    setGame((currentGame) => spendSurveyToken(currentGame))
    setHoveredTileId(null)
  }

  return (
    <div className="app-shell">
      <div className="rail-glow rail-glow-a" />
      <div className="rail-glow rail-glow-b" />

      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Prototype</p>
          <h1>Traingame</h1>
          <p className="hero-subtitle">
            Forced-placement railway puzzle with a balance panel for every major lever.
          </p>
          <p className="hero-text">{game.statusMessage}</p>

          <div className="hero-actions">
            <button onClick={handleNewGame} type="button">New game</button>
            <button className="button-secondary" onClick={applyDraftRules} type="button">
              Apply settings
            </button>
          </div>

          <div className="pill-row">
            <span className="pill">Turn {game.turnNumber}</span>
            <span className="pill">Tokens {game.tokens}</span>
            <span className="pill">{game.frontier.requiredColor} entry</span>
            <span className="pill">{game.board.width} x {game.board.height}</span>
            <span className="pill">{formatShapeLabel(game.board.shape)}</span>
          </div>
        </div>
      </header>

      <nav className="mobile-panel-nav" aria-label="Mobile sections">
        <button
          className={mobilePanel === 'play' ? 'mobile-panel-tab active' : 'mobile-panel-tab'}
          onClick={() => setMobilePanel('play')}
          type="button"
        >
          Play
        </button>
        <button
          className={mobilePanel === 'tune' ? 'mobile-panel-tab active' : 'mobile-panel-tab'}
          onClick={() => setMobilePanel('tune')}
          type="button"
        >
          Tune
        </button>
      </nav>

      <main className="main-layout">
        {!isMobileLayout || mobilePanel === 'play' ? (
          <section className="play-column">
            <section className="panel board-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Board</p>
                  <h2>Track View</h2>
                </div>
                <div className="board-badges">
                  <span className={`status-pill status-${game.status}`}>{game.status}</span>
                  <span className="soft-pill">Start {game.board.start.key}</span>
                  <span className="soft-pill">Goal highlighted spaces</span>
                </div>
              </div>

              <HexBoard game={game} />

              <div className="play-dock">
                <div className="play-dock-header">
                  <div>
                    <p className="eyebrow">Turn</p>
                    <h2>Tile Choices</h2>
                  </div>
                  <div className="option-toolbar">
                    <span className="soft-pill">Tap a piece to lay it</span>
                    <SurveyTokenButton
                      disabled={game.status !== 'playing' || game.tokens <= 0}
                      onClick={handleSpendToken}
                      tokens={game.tokens}
                    />
                  </div>
                </div>

                <div className="option-grid">
                  {game.offer.length === 0 ? (
                    <p className="empty-state">
                      {game.status === 'playing' ? 'No options loaded.' : 'Game over. Start a new game or apply new settings.'}
                    </p>
                  ) : (
                    <>
                      {game.offer.map((tile) => {
                        const preview = previews[tile.id]

                        return (
                          <TileChoiceButton
                            disabled={game.status !== 'playing'}
                            entryEdge={game.frontier.entryEdge}
                            hovered={hoveredTileId === tile.id}
                            key={tile.id}
                            onBlur={() => setHoveredTileId((current) => (current === tile.id ? null : current))}
                            onChoose={() => handleChooseTile(tile.id)}
                            onFocus={() => setHoveredTileId(tile.id)}
                            onHoverEnd={() => setHoveredTileId((current) => (current === tile.id ? null : current))}
                            onHoverStart={() => setHoveredTileId(tile.id)}
                            preview={preview}
                            requiredColor={game.frontier.requiredColor}
                          />
                        )
                      })}
                    </>
                  )}
                </div>
              </div>

              <div aria-label="Board legend" className="board-legend">
                <span className="legend-item">
                  <span aria-hidden="true" className="legend-swatch legend-goal" />
                  Goal spaces
                </span>
                <span className="legend-item">
                  <span aria-hidden="true" className="legend-swatch legend-token" />
                  Tokens
                </span>
                <span className="legend-item">
                  <span aria-hidden="true" className="legend-swatch legend-obstacle" />
                  Obstacles
                </span>
              </div>

              <p className="panel-note board-note">
                Reach any highlighted goal space to win.
              </p>
            </section>

            <section className="panel log-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Log</p>
                  <h2>Recent Turns</h2>
                </div>
              </div>

              {game.history.length === 0 ? (
                <p className="empty-state">No turns played yet.</p>
              ) : (
                <ol className="turn-list">
                  {game.history.map((turn) => (
                    <li className="turn-item" key={`${turn.turnNumber}-${turn.targetKey}`}>
                      <strong>Turn {turn.turnNumber}.</strong> {turn.summary}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </section>
        ) : null}

        {!isMobileLayout || mobilePanel === 'tune' ? (
          <aside className="sidebar">
            <section className="panel controls-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Balance</p>
                  <h2>Playtest Controls</h2>
                </div>
                <span className={draftChanged ? 'soft-pill soft-pill-alert' : 'soft-pill'}>
                  {draftChanged ? 'Pending changes' : 'In sync'}
                </span>
              </div>

              <p className="panel-note">
                Every balancing lever from the design doc is exposed here. Change them mid-session,
                then apply them to start a fresh board with those settings.
              </p>

              <div className="control-group">
                <p className="group-label">Core</p>

                <label className="control-row">
                  <span>Board width</span>
                  <input
                    max={9}
                    min={4}
                    onChange={(event) => updateDraftRule('boardWidth', Number(event.target.value))}
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
                    onChange={(event) => updateDraftRule('boardHeight', Number(event.target.value))}
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
                    onChange={(event) => updateDraftRule('startingTokens', Number(event.target.value))}
                    type="range"
                    value={draftRules.startingTokens}
                  />
                  <strong>{draftRules.startingTokens}</strong>
                </label>

                <label className="control-row">
                  <span>Token density</span>
                  <input
                    max={40}
                    min={0}
                    onChange={(event) => updateDraftRule('tokenDensityPercent', Number(event.target.value))}
                    type="range"
                    value={draftRules.tokenDensityPercent}
                  />
                  <strong>{draftRules.tokenDensityPercent}%</strong>
                </label>

                <label className="control-row">
                  <span>Straight weight</span>
                  <input
                    max={10}
                    min={0}
                    onChange={(event) => updateDraftRule('straightWeight', Number(event.target.value))}
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
                    onChange={(event) => updateDraftRule('softWeight', Number(event.target.value))}
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
                    onChange={(event) => updateDraftRule('hardWeight', Number(event.target.value))}
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
                    onChange={(event) => updateDraftRule('boardShape', event.target.value as BoardShape)}
                    value={draftRules.boardShape}
                  >
                    <option value="symmetric">Symmetric</option>
                    <option value="asymmetric-left">Asymmetric left</option>
                    <option value="asymmetric-right">Asymmetric right</option>
                  </select>
                </label>

                <label className="control-row">
                  <span>Obstacles</span>
                  <input
                    max={12}
                    min={0}
                    onChange={(event) => updateDraftRule('obstacleCount', Number(event.target.value))}
                    type="range"
                    value={draftRules.obstacleCount}
                  />
                  <strong>{draftRules.obstacleCount}</strong>
                </label>

                <label className="number-row">
                  <span>Seed</span>
                  <input
                    onChange={(event) => updateDraftRule('seed', Number(event.target.value))}
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
                  <span>Est. tokens</span>
                  <strong>{estimatedTokens}</strong>
                </article>
                <article className="summary-card">
                  <span>Obstacles</span>
                  <strong>{draftRules.obstacleCount}</strong>
                </article>
              </div>

              <div className="control-actions">
                <button onClick={applyDraftRules} type="button">Apply + new game</button>
                <button
                  className="button-secondary"
                  onClick={() => setDraftRules(activeRules)}
                  type="button"
                >
                  Revert draft
                </button>
              </div>
            </section>
          </aside>
        ) : null}
      </main>

      <footer className="app-footer">
        <BrandBadge
          className="brand-badge"
          iconClassName="brand-badge-icon"
          labelClassName="brand-badge-label"
          unstyled
        />
      </footer>
    </div>
  )
}

export default App
