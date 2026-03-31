import {
  getExitEdge,
  getTileKindText,
  type Color,
  type Edge,
  type MovePreview,
} from '../lib/game';
import { getEdgeTieSegment, getHexPoints, getRailPaths } from './railGeometry';
import SurveyTokenGlyph from './SurveyTokenGlyph';

const GLYPH_RADIUS = 36;

function edgeTieClass(color: Color): string {
  return `tile-choice-edge-tie tile-choice-edge-tie-${color}`;
}

function rotationForEntryEdge(entryEdge: number): number {
  return (entryEdge - 3) * 60;
}

function describeChoice(preview: MovePreview): string {
  if (preview.outcome === 'win') {
    return preview.tokenGain > 0
      ? 'Reaches a goal space and gains 1 token.'
      : 'Reaches a goal space.';
  }

  if (preview.outcome === 'loss') {
    return preview.reason;
  }

  if (preview.tokenGain > 0) {
    return 'Continues safely and gains 1 token.';
  }

  return 'Continues safely.';
}

export function TileChoiceButton({
  compact = false,
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
  compact?: boolean;
  disabled: boolean;
  entryEdge: Edge;
  hovered: boolean;
  onBlur: () => void;
  onChoose: () => void;
  onFocus: () => void;
  onHoverEnd: () => void;
  onHoverStart: () => void;
  preview: MovePreview;
  requiredColor: Color;
}) {
  const center = 48;
  const clipId = `tile-choice-${preview.tile.id}-clip`;
  const hexPoints = getHexPoints(GLYPH_RADIUS, center, center);
  const baseExitEdge = getExitEdge(3, preview.tile.kind);
  const railPaths = getRailPaths(
    GLYPH_RADIUS,
    center,
    center,
    3,
    baseExitEdge,
    5.2,
  );
  const className = [
    'tile-choice',
    compact ? 'tile-choice-compact' : '',
    hovered ? 'tile-choice-active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      aria-label={`${getTileKindText(preview.tile, requiredColor)}. ${describeChoice(preview)}`}
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
        <defs>
          <clipPath id={clipId}>
            <polygon points={hexPoints} />
          </clipPath>
        </defs>
        <polygon className="tile-choice-shell" points={hexPoints} />
        <g clipPath={`url(#${clipId})`}>
          <line
            className={edgeTieClass(requiredColor)}
            {...getEdgeTieSegment(GLYPH_RADIUS, center, center, entryEdge)}
          />
          <line
            className={edgeTieClass(preview.nextRequiredColor)}
            {...getEdgeTieSegment(GLYPH_RADIUS, center, center, preview.exitEdge)}
          />
        </g>
        <g
          transform={`rotate(${rotationForEntryEdge(entryEdge)} ${center} ${center})`}
        >
          <path className="tile-choice-track-rail" d={railPaths.left} />
          <path className="tile-choice-track-rail" d={railPaths.right} />
        </g>
      </svg>

      {!compact ? (
        <div className="tile-choice-meta">
          <span className="tile-choice-name">
            {getTileKindText(preview.tile, requiredColor)}
          </span>
        </div>
      ) : null}
    </button>
  );
}

export function SurveyTokenButton({
  canDrawMore = true,
  compact = false,
  disabled,
  onClick,
  tokens,
}: {
  canDrawMore?: boolean;
  compact?: boolean;
  disabled: boolean;
  onClick: () => void;
  tokens: number;
}) {
  const ariaLabel = !canDrawMore
    ? 'No more track tiles remain in the bag.'
    : 'Spend 1 token to draw 2 extra tile choices.';

  return (
    <button
      aria-label={ariaLabel}
      className={
        compact
          ? 'survey-token-inline survey-token-inline-compact'
          : 'survey-token-inline'
      }
      disabled={disabled}
      onClick={onClick}
      title={ariaLabel}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="survey-token-inline-svg"
        viewBox="0 0 64 64"
      >
        <g transform="translate(32 32)">
          <SurveyTokenGlyph />
        </g>
      </svg>

      <span className="survey-token-inline-count">{tokens}</span>
    </button>
  );
}
