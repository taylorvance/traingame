import {
  getBoardCellMap,
  type Edge,
  type GameState,
  type MovePreview,
} from '../lib/game'

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

function getHexPoints(centerX: number, centerY: number): string {
  const points = [
    [HEX_RADIUS, 0],
    [HEX_RADIUS / 2, HEX_HEIGHT / 2],
    [-HEX_RADIUS / 2, HEX_HEIGHT / 2],
    [-HEX_RADIUS, 0],
    [-HEX_RADIUS / 2, -HEX_HEIGHT / 2],
    [HEX_RADIUS / 2, -HEX_HEIGHT / 2],
  ]

  return points.map(([x, y]) => `${centerX + x},${centerY + y}`).join(' ')
}

function getEdgeMidpoint(edge: Edge): { x: number; y: number } {
  switch (edge) {
    case 0:
      return { x: 0, y: -HEX_HEIGHT / 2 }
    case 1:
      return { x: HEX_RADIUS * 0.75, y: -HEX_HEIGHT / 4 }
    case 2:
      return { x: HEX_RADIUS * 0.75, y: HEX_HEIGHT / 4 }
    case 3:
      return { x: 0, y: HEX_HEIGHT / 2 }
    case 4:
      return { x: -HEX_RADIUS * 0.75, y: HEX_HEIGHT / 4 }
    case 5:
      return { x: -HEX_RADIUS * 0.75, y: -HEX_HEIGHT / 4 }
  }
}

function getTrackPath(centerX: number, centerY: number, entryEdge: Edge, exitEdge: Edge): string {
  const start = getEdgeMidpoint(entryEdge)
  const end = getEdgeMidpoint(exitEdge)

  if (((entryEdge + 3) % 6) === exitEdge) {
    return `M ${centerX + start.x} ${centerY + start.y} L ${centerX + end.x} ${centerY + end.y}`
  }

  return `M ${centerX + start.x} ${centerY + start.y} Q ${centerX} ${centerY} ${centerX + end.x} ${centerY + end.y}`
}

function getPreviewClass(preview: MovePreview | null): string {
  if (!preview) {
    return ''
  }

  switch (preview.outcome) {
    case 'win':
      return 'preview-win'
    case 'loss':
      return 'preview-loss'
    case 'continue':
      return 'preview-continue'
  }
}

export default function HexBoard({
  game,
  hoveredTileId,
  previews,
}: {
  game: GameState
  hoveredTileId: string | null
  previews: Record<string, MovePreview>
}) {
  const boardCellMap = getBoardCellMap(game.board)
  const hoveredPreview = hoveredTileId ? previews[hoveredTileId] ?? null : null
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
        const isFrontier = game.frontier.col === cell.col && game.frontier.row === cell.row && game.status === 'playing'
        const isObstacle = game.obstacleCells.includes(cell.key)
        const hasToken = game.tokenCells.includes(cell.key)
        const isGoal = cell.row === 0
        const previewTarget = hoveredPreview && hoveredPreview.targetKey === cell.key ? hoveredPreview : null

        return (
          <g className={`board-cell ${getPreviewClass(previewTarget)}`} key={cell.key}>
            <polygon
              className={`hex-tile ${isGoal ? 'goal-cell' : ''} ${isObstacle ? 'obstacle-cell' : ''} ${isFrontier ? 'frontier-cell' : ''}`}
              points={getHexPoints(center.x, center.y)}
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
              <path
                className="track-path"
                d={getTrackPath(center.x, center.y, occupiedTrack.entryEdge, occupiedTrack.exitEdge)}
                filter="url(#rail-shadow)"
              />
            ) : null}

            {previewTarget ? (
              <path
                className="preview-path"
                d={getTrackPath(center.x, center.y, game.frontier.entryEdge, previewTarget.exitEdge)}
              />
            ) : null}

            {isFrontier ? (
              <>
                <circle className={`frontier-pulse frontier-${game.frontier.requiredColor}`} cx={center.x} cy={center.y} r={18} />
                <circle className={`frontier-core frontier-${game.frontier.requiredColor}`} cx={center.x} cy={center.y} r={8} />
              </>
            ) : null}
          </g>
        )
      })}

      {Object.values(previews).map((preview) => {
        if (!hoveredPreview || preview.tile.id !== hoveredPreview.tile.id || !preview.nextKey) {
          return null
        }

        const nextCell = boardCellMap[preview.nextKey]
        if (!nextCell) {
          return null
        }

        const center = getHexCenter(nextCell.col, nextCell.row)
        return (
          <circle
            className={`next-target ${getPreviewClass(preview)}`}
            cx={center.x}
            cy={center.y}
            key={`${preview.tile.id}-next`}
            r={10}
          />
        )
      })}
    </svg>
  )
}
