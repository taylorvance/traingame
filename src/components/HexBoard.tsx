import { getExitEdge, type Color, type GameState } from '../lib/game'
import {
  getEdgeSegment,
  getHexPoints,
  getRailPaths,
} from './railGeometry'

const HEX_RADIUS = 34
const HEX_HEIGHT = Math.sqrt(3) * HEX_RADIUS
const BOARD_PADDING = HEX_RADIUS + 18

function getHexCenter(col: number, row: number): { x: number; y: number } {
  return {
    x: BOARD_PADDING + col * HEX_RADIUS * 1.5,
    y: BOARD_PADDING + row * HEX_HEIGHT + (col % 2 === 1 ? HEX_HEIGHT / 2 : 0),
  }
}

function getBoardBounds(game: GameState): { width: number; height: number } {
  const cells = game.board.cells.map((cell) => getHexCenter(cell.col, cell.row))
  const maxX = Math.max(...cells.map((cell) => cell.x), 0)
  const maxY = Math.max(...cells.map((cell) => cell.y), 0)

  return {
    width: maxX + BOARD_PADDING,
    height: maxY + BOARD_PADDING,
  }
}

function edgeBandClass(color: Color): string {
  return `edge-band edge-band-${color}`
}

function rotationForEntryEdge(entryEdge: number): number {
  return (entryEdge - 3) * 60
}

export default function HexBoard({ game }: { game: GameState }) {
  const bounds = getBoardBounds(game)

  return (
    <svg
      aria-label="Railway board"
      className="hex-board"
      viewBox={`0 0 ${bounds.width} ${bounds.height}`}
      role="img"
    >
      <defs>
        <filter id="rail-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(35, 29, 16, 0.22)" />
        </filter>
      </defs>

      {game.board.cells.map((cell) => {
        const center = getHexCenter(cell.col, cell.row)
        const occupiedTrack = game.occupiedTracks[cell.key]
        const baseExitEdge = occupiedTrack ? getExitEdge(3, occupiedTrack.tile.kind) : null
        const railPaths = occupiedTrack && baseExitEdge !== null
          ? getRailPaths(HEX_RADIUS, center.x, center.y, 3, baseExitEdge, 4.4)
          : null
        const isFrontier = game.frontier.col === cell.col && game.frontier.row === cell.row && game.status === 'playing'
        const isObstacle = game.obstacleCells.includes(cell.key)
        const hasToken = game.tokenCells.includes(cell.key)
        const isGoal = cell.row === 0

        return (
          <g className="board-cell" key={cell.key}>
            <polygon
              className={`hex-tile ${isGoal ? 'goal-cell' : ''} ${isObstacle ? 'obstacle-cell' : ''} ${isFrontier ? 'frontier-cell' : ''}`}
              points={getHexPoints(HEX_RADIUS, center.x, center.y)}
            />

            {hasToken ? (
              <circle className="token-glyph" cx={center.x} cy={center.y} r={11} />
            ) : null}

            {isObstacle ? (
              <text className="obstacle-glyph" x={center.x} y={center.y + 6}>
                X
              </text>
            ) : null}

            {occupiedTrack ? (
              <g transform={`rotate(${rotationForEntryEdge(occupiedTrack.entryEdge)} ${center.x} ${center.y})`}>
                <path
                  className="track-rail"
                  d={railPaths?.left}
                />
                <path
                  className="track-rail"
                  d={railPaths?.right}
                />
              </g>
            ) : null}

            {occupiedTrack ? (
              <>
                <line
                  className={edgeBandClass(occupiedTrack.entryColor)}
                  {...getEdgeSegment(HEX_RADIUS, center.x, center.y, occupiedTrack.entryEdge)}
                />
                <line
                  className={edgeBandClass(occupiedTrack.exitColor)}
                  {...getEdgeSegment(HEX_RADIUS, center.x, center.y, occupiedTrack.exitEdge)}
                />
              </>
            ) : null}

            {isFrontier ? (
              <>
                <line
                  className={edgeBandClass(game.frontier.requiredColor)}
                  {...getEdgeSegment(HEX_RADIUS, center.x, center.y, game.frontier.entryEdge)}
                />
              </>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
