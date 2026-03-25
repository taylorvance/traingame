import {
  getExitEdge,
  getTileKindText,
  type Color,
  type Edge,
  type MovePreview,
} from '../lib/game'
import {
  getEdgeSegment,
  getHexPoints,
  getRailPaths,
} from './railGeometry'

const GLYPH_RADIUS = 36

function edgeBandClass(color: Color): string {
  return `tile-choice-edge tile-choice-edge-${color}`
}

function rotationForEntryEdge(entryEdge: number): number {
  return (entryEdge - 3) * 60
}

function getPreviewChip(preview: MovePreview): string {
  if (preview.outcome === 'win') {
    return 'Goal'
  }

  if (preview.outcome === 'loss') {
    return 'Blocked'
  }

  if (preview.tokenGain > 0) {
    return '+1 token'
  }

  return 'Safe'
}

function describeChoice(preview: MovePreview): string {
  if (preview.outcome === 'win') {
    return preview.tokenGain > 0 ? 'Reaches a goal space and gains 1 token.' : 'Reaches a goal space.'
  }

  if (preview.outcome === 'loss') {
    return preview.reason
  }

  if (preview.tokenGain > 0) {
    return 'Continues safely and gains 1 token.'
  }

  return 'Continues safely.'
}

export function TileChoiceButton({
  disabled,
  entryEdge,
  hovered,
  onBlur,
  onChoose,
  onFocus,
  onHoverEnd,
  onHoverStart,
  preview,
  requiredColor,
}: {
  disabled: boolean
  entryEdge: Edge
  hovered: boolean
  onBlur: () => void
  onChoose: () => void
  onFocus: () => void
  onHoverEnd: () => void
  onHoverStart: () => void
  preview: MovePreview
  requiredColor: Color
}) {
  const center = 48
  const baseExitEdge = getExitEdge(3, preview.tile.kind)
  const railPaths = getRailPaths(GLYPH_RADIUS, center, center, 3, baseExitEdge, 4.2)
  const className = [
    'tile-choice',
    `tile-choice-${preview.outcome}`,
    hovered ? 'tile-choice-active' : '',
  ].filter(Boolean).join(' ')

  return (
    <button
      aria-label={`${getTileKindText(preview.tile)}. ${describeChoice(preview)}`}
      className={className}
      disabled={disabled}
      onBlur={onBlur}
      onClick={onChoose}
      onFocus={onFocus}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="tile-choice-svg"
        role="img"
        viewBox="0 0 96 96"
      >
        <polygon className="tile-choice-shell" points={getHexPoints(GLYPH_RADIUS, center, center)} />
        <g transform={`rotate(${rotationForEntryEdge(entryEdge)} ${center} ${center})`}>
          <path className="tile-choice-track-rail" d={railPaths.left} />
          <path className="tile-choice-track-rail" d={railPaths.right} />
        </g>
        <line className={edgeBandClass(requiredColor)} {...getEdgeSegment(GLYPH_RADIUS, center, center, entryEdge)} />
        <line className={edgeBandClass(preview.nextRequiredColor)} {...getEdgeSegment(GLYPH_RADIUS, center, center, preview.exitEdge)} />

        {preview.outcome === 'win' ? (
          <circle className="tile-choice-goal-ring" cx={center} cy={center} r={10} />
        ) : null}

        {preview.outcome === 'loss' ? (
          <>
            <line className="tile-choice-block" x1={center - 8} x2={center + 8} y1={center - 8} y2={center + 8} />
            <line className="tile-choice-block" x1={center + 8} x2={center - 8} y1={center - 8} y2={center + 8} />
          </>
        ) : null}

        {preview.tokenGain > 0 ? (
          <g transform="translate(71 23)">
            <circle className="tile-choice-token-badge" cx="0" cy="0" r="11" />
            <text className="tile-choice-token-text" x="0" y="4">
              +1
            </text>
          </g>
        ) : null}
      </svg>

      <div className="tile-choice-meta">
        <span className="tile-choice-name">{getTileKindText(preview.tile)}</span>
        <span className={`tile-choice-chip tile-choice-chip-${preview.outcome}`}>{getPreviewChip(preview)}</span>
      </div>
    </button>
  )
}

export function SurveyTokenButton({
  disabled,
  onClick,
  tokens,
}: {
  disabled: boolean
  onClick: () => void
  tokens: number
}) {
  return (
    <button
      aria-label={`Spend 1 token to draw 2 extra tile choices. ${tokens} tokens available.`}
      className="survey-token-inline"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <svg aria-hidden="true" className="survey-token-inline-svg" viewBox="0 0 96 64">
        <g transform="translate(13 32)">
          <polygon className="survey-mini-hex" points="-7,0 -3.5,6.1 3.5,6.1 7,0 3.5,-6.1 -3.5,-6.1" />
          <line className="survey-mini-rail" x1="-4" x2="4" y1="0" y2="0" />
        </g>
        <g transform="translate(83 32)">
          <polygon className="survey-mini-hex" points="-7,0 -3.5,6.1 3.5,6.1 7,0 3.5,-6.1 -3.5,-6.1" />
          <path className="survey-mini-rail" d="M -4 3 Q 0 0 4 -3" />
        </g>
        <circle className="survey-token-outer" cx="48" cy="32" r="18" />
        <circle className="survey-token-inner" cx="48" cy="32" r="11" />
        <circle className="survey-token-core" cx="48" cy="32" r="5" />
        <line className="survey-token-cross" x1="48" x2="48" y1="17" y2="23" />
        <line className="survey-token-cross" x1="48" x2="48" y1="41" y2="47" />
        <line className="survey-token-cross" x1="33" x2="39" y1="32" y2="32" />
        <line className="survey-token-cross" x1="57" x2="63" y1="32" y2="32" />
      </svg>

      <span className="survey-token-inline-text">
        Survey +2
      </span>

      <span className="survey-token-inline-count">{tokens}</span>
    </button>
  )
}
