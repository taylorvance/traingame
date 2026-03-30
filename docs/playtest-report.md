# Playtest Report

Date: 2026-03-29

## Run

Main large-batch command:

```bash
npm run playtest:report -- --base-games 1200 --sweep-games 800 --rollouts 10 --survey-rollouts 6
```

This run covered:

- 1,200 games per policy in the baseline comparison
- 800 games per variant in each sweep
- 8 named presets under both `surveyHeuristic` and `monteCarlo`

## Default Baseline

| Policy | Games | Win rate | Avg turns | Avg surveys |
| --- | ---: | ---: | ---: | ---: |
| `random` | 1200 | 0.1% | 3.96 | 0.00 |
| `safeRandom` | 1200 | 14.0% | 9.63 | 1.38 |
| `surveyHeuristic` | 1200 | 39.9% | 9.98 | 1.52 |
| `monteCarlo` | 1200 | 95.7% | 13.45 | 1.69 |

Key points:

- The default game is very solvable in principle.
- The same default game is still fairly punishing for weaker play.
- The gap between `39.9%` and `95.7%` remains the clearest signal that the main issue is recoverability and readability, not impossibility.

## Strongest Single-Axis Findings

### Starting tokens

| Starting tokens | Monte Carlo win rate |
| --- | ---: |
| `0` | 68.9% |
| `1` | 95.6% |
| `2` | 98.9% |
| `3` | 99.9% |

Takeaway:

- `1` still looks like the right normal-mode default.
- `2` is a good easy-mode lever.
- `0` is a meaningful hard-mode lever.

### Feature density

| Feature density | Monte Carlo win rate |
| --- | ---: |
| `12%` | 98.0% |
| `18%` | 95.6% |
| `24%` | 94.9% |
| `30%` | 94.0% |

Takeaway:

- Density matters, but not as dramatically as hazard share or starting tokens.
- Higher density mostly increases economy and rescue opportunities, not just raw difficulty.

### Hazard balance

| Hazard balance | Monte Carlo win rate |
| --- | ---: |
| `25%` | 99.8% |
| `50%` | 95.6% |
| `75%` | 88.8% |

Takeaway:

- Hazard share is still the strongest fairness lever.
- Moving from `50%` to `40%` or `35%` is the safest way to make the game feel less punishing without flattening it.

### Tile mix

| Tile mix | Monte Carlo win rate |
| --- | ---: |
| `6 / 8 / 6` straighter | 97.5% |
| `4 / 10 / 8` default | 95.6% |
| `2 / 12 / 10` turn-heavy | 95.3% |

Takeaway:

- A slightly straighter bag helps more than it hurts.
- Turn-heavy bags increase route-planning pressure without making the game unsalvageable for the oracle.

## Named Preset Bakeoff

### Heuristic policy

| Preset | Win rate | Avg turns |
| --- | ---: | ---: |
| `default` | 39.4% | 9.99 |
| `fairer-default` | 59.1% | 10.30 |
| `easy-cruise` | 83.6% | 10.61 |
| `stingy-gauntlet` | 14.0% | 7.43 |
| `token-rush` | 65.6% | 11.01 |
| `turn-maze` | 38.3% | 10.26 |
| `short-sprint` | 66.5% | 6.87 |
| `long-haul` | 39.1% | 14.18 |

### Monte Carlo policy

| Preset | Win rate | Avg turns |
| --- | ---: | ---: |
| `default` | 95.6% | 13.46 |
| `fairer-default` | 98.8% | 12.78 |
| `easy-cruise` | 99.9% | 12.91 |
| `stingy-gauntlet` | 53.0% | 10.19 |
| `token-rush` | 99.3% | 14.02 |
| `turn-maze` | 95.4% | 14.35 |
| `short-sprint` | 98.5% | 8.49 |
| `long-haul` | 96.6% | 19.14 |

## New Findings From The Broader Preset Space

### 1. Board length changes readability more than solvability

- `short-sprint` is much easier for the heuristic than default: `66.5%` vs `39.4%`.
- `long-haul` stays near default for the heuristic: `39.1%`.
- The oracle still handles `long-haul` well at `96.6%`.

Interpretation:

- Bigger boards do not make the game impossible.
- They do make planning depth matter more, which is rougher on weaker play.

### 2. Reward-rich boards can be forgiving without becoming trivial

- `token-rush` reached `65.6%` for the heuristic and `99.3%` for the oracle.
- That preset wins more through economy and recovery than through raw geometric simplification.

Interpretation:

- A game can feel generous because it gives more bailouts, not only because it removes hazards.
- That is a different kind of “easy” than `easy-cruise`.

### 3. Hard mode is easy to create accidentally

- `stingy-gauntlet` dropped to `14.0%` for the heuristic and only `53.0%` for the oracle.

Interpretation:

- Zero starting tokens plus denser hazards is not just “more tactical.”
- It is a qualitatively different, much harsher game.

### 4. Not every harder-looking preset is harder in the same way

- `turn-maze` leaves oracle performance almost unchanged from default: `95.4%` vs `95.6%`.
- But it does not help the heuristic: `38.3%` vs `39.4%`.

Interpretation:

- A turn-heavy bag mostly increases planning complexity, not absolute impossibility.
- That makes it useful if you want a mode that feels more brainy rather than more punishing.

## Updated Recommendations

### Main mode

Keep the main mode close to:

- `startingTokens: 1`
- `hazardBalancePercent: 40`
- `straightWeight: 6`
- `softWeight: 8`
- `hardWeight: 6`

This still looks like the best “fairer default” compromise.

### Easy mode

Use:

- `startingTokens: 2`
- `hazardBalancePercent: 25`
- `straightWeight: 6`
- `softWeight: 8`
- `hardWeight: 6`

### Alternate modes worth keeping

- `Token Rush`: generous, reward-driven, economy-heavy play
- `Short Sprint`: quicker, clearer runs on a smaller board
- `Turn Maze`: more cerebral route-planning without a large oracle difficulty spike
- `Stingy Gauntlet`: explicit hard mode only
