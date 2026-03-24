# Railway Path — Prototype Design Document

## 1. High Concept

A tile-based path-building puzzle on a hex grid.
Each turn, the player chooses between two forced placements, shaping a continuous railway from the bottom of the board to the top. The challenge comes from anticipating future constraints: every move is legal now, but may lead to an unavoidable loss later.

---

## 2. Core Loop

1. Draw 2 tiles from the pool.
2. Evaluate both:
   - Each tile has exactly one valid placement (forced by color + geometry).
3. Optionally spend 1 token to hire a surveyor:
   - Draw 2 additional tiles.
4. Choose 1 tile to play.
5. Place the tile:
   - Lay track.
   - Advance the engine.
6. Resolve:
   - Return unused tiles to the pool.
   - Collect a token if present.
   - Check for loss.
7. Repeat.

---

## 3. Objective

- **Win:** Reach any hex on the top row.
- **Lose:** If placement causes:
  - Collision with existing track, or
  - Exit off the board

---

## 4. Board

- Hex grid (fixed layout)
- Start: bottom entry position
- Goal: any top-row hex
- Tokens:
  - Placed randomly at setup
  - Collected automatically when entered
  - Do not respawn (for now--TBD)

Future:

- Alternate board layouts (front/back of board) for difficulty
- Obstacles / blocked hexes

---

## 5. Railway Rules

- The railway is a continuous path of placed tiles
- It:
  - Never retracts
  - Cannot overlap itself
  - Has a single active “engine” end at all times

---

## 6. Tile System

### 6.1 Tile Properties

Each tile:

- Connects exactly **two edges** of a hex
- Has:
  - One **red** endpoint
  - One **blue** endpoint

### 6.2 Shapes

Tiles represent mappings from entry edge → exit edge:

- **Straight**
  - Exit is opposite edge (180° rotation from entry)

- **Soft Turn**
  - Exit is adjacent to opposite edge (±120° rotation)

- **Hard Turn**
  - Exit is adjacent to entry edge (±60° rotation)

---

## 7. Placement Rules

- The engine exposes:
  - A **current edge**
  - A **required color** (red or blue)

- A tile:
  - Must match the required color at the entry edge
  - Is rotated automatically to satisfy this

- Result:
  - Each tile has exactly **one forced placement**
  - The exit edge determines the next engine position
  - The next edge color **always alternates**

---

## 8. Validity vs Outcome

- **All drawn tiles are always playable**
- A move can still immediately lose if it causes a collision with any obstacle:
  - colliding with existing track
  - exiting the board before reaching the goal
  - hitting a wall (TBD)

---

## 9. Survey System

### 9.1 Starting Tokens

- Player begins with 1 token (TBD)

### 9.2 Usage

- Spend (discard) 1 token to hire a surveyor:
  - Draw 2 additional tiles to choose from

### 9.3 Pickup

- Landing on a token:
  - Gain +1 token

### 9.4 Timing

- Survey use occurs **after seeing both initial tiles, before placing**

---

## 10. Tile Pool

- Finite pool of tiles
- Each turn:
  - Draw 2
  - Play 1
  - Return the other to the pool

- Tile distribution is a primary balancing lever

---

## 11. Starting Move

- Initial position is fixed
- Player may choose the **initial orientation**
  - Small but meaningful agency:
    - Can aim toward tokens
    - Can avoid early constraints (if any--TBD)

---

## 12. Player Decision Space

Each turn:

- Choose between two deterministic outcomes
- Optionally spend a resource to redraw options

Skill comes from:

- Reading future constraints
- Avoiding self-trapping patterns
- Managing limited redraws (tokens)

---

## 13. Design Intent

- Simple rules (kid-friendly, physical play)
- No analysis paralysis (only 2 options)
- Consistent logic (no exceptions, no hidden rules)
- Tension from:
  - Spatial constraints
  - Imperfect options
  - Limited mitigation

---

## 14. Balancing Levers

### Core

- Tile distribution (straight vs soft vs hard turns)
- Board width / height
- Token density
- Starting token count

### Structural

- Board shape (symmetry vs asymmetry)
- Obstacle placement (future)

---

## 15. Prototype Goals

Playtesting should answer:

1. Do players feel meaningful choice with only 2 options?
2. Are losses perceived as:
   - Fair (avoidable), or
   - Inevitable (frustrating)?
3. Are tokens:
   - Too strong (remove tension)?
   - Too weak (never helpful)?
4. Does tile distribution:
   - Encourage planning?
   - Or feel random?

---

## 16. Notes

- System is deterministic per turn, stochastic across turns
- Color alternation guarantees consistent flow
- No hidden information
- No backtracking

---

## 17. Future Considerations

- Obstacles / blocked hexes
- Token respawn mechanics
- Alternate win conditions (specific exit points)
- Difficulty tiers via board design
- Expanded tile sets (if needed)
