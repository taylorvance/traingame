# Web Prototype Plan

## Goal

Build a fast, playable browser prototype of the core rules before investing in presentation polish.

## Recommended Stack

- React
- TypeScript
- Vite
- SVG rendering for the hex board and track geometry

SVG should be enough for this prototype because the board is discrete, the state is small, and clear debug rendering matters more than animation throughput.

## Initial Scope

Implement only the core game loop:

- Fixed hex board
- Fixed start position and top-row win condition
- Track tile draw from a pool
- Forced placement based on entry edge and color
- Choose 1 tile from 2 options
- Optional token spend to reveal 2 additional tiles
- Token pickups on board
- Collision / off-board loss checks
- Restart game

## UI Priorities

- Board view with placed track and current engine position
- Visible token count
- Current drawn tile choices
- Clear forced outcome preview for each choice
- Win / loss state banner
- Restart button

## Defer For Later

- Alternate boards
- Obstacles
- Difficulty settings
- Animations beyond basic state transitions
- Persistence / save data
- Mobile polish beyond basic responsiveness

## Implementation Notes

- Keep game rules separate from rendering code.
- Make the board state serializable so test fixtures are easy to build.
- Prefer deterministic setup options for debugging, even if random setup exists by default.
- Add a small text debug panel for turn state, current required color, and last action.

## Open Questions

- Starting token count is still marked TBD in the design doc.
- Token placement quantity and distribution are still balancing questions.
- Tile pool composition is still a balancing lever, not a finalized rule.
