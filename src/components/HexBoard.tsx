import { getExitEdge, type Color, type GameState } from '../lib/game';
import { getEdgeSegment, getHexPoints, getRailPaths } from './railGeometry';

const HEX_RADIUS = 34;
const HEX_HEIGHT = Math.sqrt(3) * HEX_RADIUS;
const BOARD_PADDING = HEX_RADIUS + 18;

function getHexCenter(col: number, row: number): { x: number; y: number } {
  return {
    x: BOARD_PADDING + col * HEX_RADIUS * 1.5,
    y: BOARD_PADDING + row * HEX_HEIGHT + (col % 2 === 1 ? HEX_HEIGHT / 2 : 0),
  };
}

function getBoardBounds(game: GameState): { width: number; height: number } {
  const cells = game.board.cells.map((cell) =>
    getHexCenter(cell.col, cell.row),
  );
  const maxX = Math.max(...cells.map((cell) => cell.x), 0);
  const maxY = Math.max(...cells.map((cell) => cell.y), 0);

  return {
    width: maxX + BOARD_PADDING,
    height: maxY + BOARD_PADDING,
  };
}

function edgeBandClass(color: Color): string {
  return `edge-band edge-band-${color}`;
}

function rotationForEntryEdge(entryEdge: number): number {
  return (entryEdge - 3) * 60;
}

export default function HexBoard({ game }: { game: GameState }) {
  const bounds = getBoardBounds(game);

  return (
    <svg
      aria-label="Railway board"
      className="hex-board"
      viewBox={`0 0 ${bounds.width} ${bounds.height}`}
      role="img"
    >
      <defs>
        <filter id="rail-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="2"
            floodColor="rgba(35, 29, 16, 0.22)"
          />
        </filter>
      </defs>

      {game.board.cells.map((cell) => {
        const center = getHexCenter(cell.col, cell.row);
        const occupiedTrack = game.occupiedTracks[cell.key];
        const baseExitEdge = occupiedTrack
          ? getExitEdge(3, occupiedTrack.tile.kind)
          : null;
        const railPaths =
          occupiedTrack && baseExitEdge !== null
            ? getRailPaths(HEX_RADIUS, center.x, center.y, 3, baseExitEdge, 4.4)
            : null;
        const isFrontier =
          game.frontier.col === cell.col &&
          game.frontier.row === cell.row &&
          game.status === 'playing';
        const isObstacle = game.obstacleCells.includes(cell.key);
        const hasToken = game.tokenCells.includes(cell.key);
        const isGoal = cell.row === 0;

        return (
          <g className="board-cell" key={cell.key}>
            <polygon
              className={`hex-tile ${isGoal ? 'goal-cell' : ''} ${isObstacle ? 'obstacle-cell' : ''} ${isFrontier ? 'frontier-cell' : ''}`}
              points={getHexPoints(HEX_RADIUS, center.x, center.y)}
            />

            {isObstacle ? (
              <g
                className="obstacle-glyph"
                transform={`translate(${center.x} ${center.y + 4})`}
              >
                <path
                  className="obstacle-mountain-back"
                  d="M -18 10 L -8 -8 L 0 4 L 8 -10 L 18 10 Z"
                />
                <path
                  className="obstacle-mountain-front"
                  d="M -22 10 L -9 -14 L 0 -1 L 10 -14 L 22 10 Z"
                />
                <path
                  className="obstacle-snow"
                  d="M -9 -14 L -5 -7 L -1 -3 L 3 -8 L 10 -14 L 6 -6 L 0 -1 Z"
                />
              </g>
            ) : null}

            {isGoal ? (
              <g
                className="goal-glyph"
                transform={`translate(${center.x} ${center.y + 3})`}
              >
                <rect
                  className="goal-station-base"
                  x="-13"
                  y="-5"
                  width="26"
                  height="15"
                  rx="2.5"
                />
                <path
                  className="goal-station-roof"
                  d="M -16 -4 L 0 -16 L 16 -4 Z"
                />
                <rect
                  className="goal-station-door"
                  x="-3.5"
                  y="0"
                  width="7"
                  height="10"
                  rx="1.5"
                />
                <rect
                  className="goal-station-window"
                  x="-10"
                  y="-1"
                  width="4"
                  height="4"
                  rx="1"
                />
                <rect
                  className="goal-station-window"
                  x="6"
                  y="-1"
                  width="4"
                  height="4"
                  rx="1"
                />
              </g>
            ) : null}

            {occupiedTrack ? (
              <g
                transform={`rotate(${rotationForEntryEdge(occupiedTrack.entryEdge)} ${center.x} ${center.y})`}
              >
                <path className="track-rail" d={railPaths?.left} />
                <path className="track-rail" d={railPaths?.right} />
              </g>
            ) : null}

            {occupiedTrack ? (
              <>
                <line
                  className={edgeBandClass(occupiedTrack.entryColor)}
                  {...getEdgeSegment(
                    HEX_RADIUS,
                    center.x,
                    center.y,
                    occupiedTrack.entryEdge,
                  )}
                />
                <line
                  className={edgeBandClass(occupiedTrack.exitColor)}
                  {...getEdgeSegment(
                    HEX_RADIUS,
                    center.x,
                    center.y,
                    occupiedTrack.exitEdge,
                  )}
                />
              </>
            ) : null}

            {hasToken ? (
              <circle
                className="token-glyph"
                cx={center.x}
                cy={center.y}
                r={11}
              />
            ) : null}

            {isFrontier ? null : null}
          </g>
        );
      })}
    </svg>
  );
}
