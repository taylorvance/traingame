# Automated Playtesting

Date: 2026-03-29

## Why This Exists

This project has a specific balance problem:

- the per-turn choice is small
- the consequences are long-range
- the game has stochastic draws
- fairness depends on whether trap states are avoidable, not just whether wins exist

That makes manual playtesting necessary, but insufficient on its own.

A human tester can tell you:

- whether the choices feel meaningful
- whether a loss feels fair
- whether a token feels exciting or mandatory

A headless simulator can tell you:

- how often dead offers appear
- how much survey tokens actually rescue runs
- whether a ruleset is fundamentally solvable
- which tuning levers are strongest
- whether two rulesets are meaningfully different or only cosmetically different

The reason to build this experiment was not to create a player-facing AI.
It was to create a lab instrument for the rules.

## Why Monte Carlo Fits This Game

This game is a good simulation target because the engine is already close to ideal for it:

- state creation is deterministic from a seed
- move previews are explicit
- move application is pure
- the branching factor per turn is tiny
- the interesting uncertainty comes from future draws

That means rollouts are cheap and interpretable.

For automated playtesting, hidden information is not a problem.
The simulator is allowed to inspect the full state because it is measuring the design, not pretending to be a fair player.

## What The Harness Does

The simulator lives in:

- `scripts/lib/playtest-core.ts`
- `scripts/playtest-report.ts`

It currently supports these policies:

- `random`
- `safeRandom`
- `surveyHeuristic`
- `monteCarlo`

Those policies are intentionally different in strength and style.

That matters because one policy alone can mislead you:

- a weak policy can mistake complexity for impossibility
- an oracle policy can mistake solvability for player friendliness

Using both the heuristic and Monte Carlo policies gives a more useful picture:

- heuristic results act as a rough fairness smell test
- Monte Carlo results act as an upper-bound solvability test

## What This Approach Is Good For

- comparing balance levers quickly
- estimating how often rescue mechanics matter
- identifying rulesets that are too generous or too harsh
- surfacing alternate modes with distinct feel
- checking whether a proposed preset is actually different

## What This Approach Is Not Good For

- replacing human playtests
- proving that a ruleset is fun
- predicting exact human win rates
- judging UX clarity or emotional response

If a simulator says a ruleset is good, that only means it is mechanically promising.
Humans still need to confirm that the play experience matches the numbers.

## Large-Batch Findings

Main command:

```bash
npm run playtest:report -- --base-games 1200 --sweep-games 800 --rollouts 10 --survey-rollouts 6
```

### 1. The default game is solvable, but not especially legible

Default baseline:

- `surveyHeuristic`: `39.9%`
- `monteCarlo`: `95.7%`

This is the most important headline.

The game is not fundamentally unfair in the sense of being unwinnable.
But the weaker policy performs far worse than the oracle, which suggests that the current default asks players to see further ahead than the visible choice framing may comfortably support.

### 2. Survey tokens are structurally important

On the default baseline:

- oracle forced-loss games: `480/1200`
- oracle rescue games: `461/1200`

That means survey tokens are not an occasional bonus.
They are a central pressure-release valve.

This has two design implications:

- reducing token access is a serious difficulty change
- evaluating token power only by “how often players spend them” misses the real point

The more important question is how often they prevent collapse.

### 3. Hazard share is the cleanest fairness lever

The strongest consistent axis remains hazard balance.

- `25%` hazards: `99.8%` oracle win rate
- `50%` hazards: `95.6%`
- `75%` hazards: `88.8%`

Lowering hazard share also helps the weaker policy substantially in earlier comparison runs.

This is the safest first knob when the game feels unfair.

### 4. Board size changes the character of difficulty

Two new presets were especially informative:

- `short-sprint`
- `long-haul`

Results:

- `short-sprint` heuristic: `66.5%`
- `long-haul` heuristic: `39.1%`
- `short-sprint` oracle: `98.5%`
- `long-haul` oracle: `96.6%`

Interpretation:

- larger boards do not break solvability
- they do make the planning horizon much harsher on weaker play

So board size is less a raw difficulty lever than a readability and foresight lever.

### 5. There are multiple kinds of “easy”

Two presets both score as forgiving, but for different reasons:

- `easy-cruise`
- `token-rush`

`easy-cruise` is forgiving because it lowers punishment directly:

- more starting tokens
- lighter hazards
- straighter bag

`token-rush` is forgiving because it creates more recovery economy:

- high feature density
- low hazard share
- many rewards

This matters because these modes will feel different in play even if both have high win rates.

### 6. There are also multiple kinds of “hard”

`stingy-gauntlet` and `turn-maze` are both harder-looking presets, but they stress different things.

`stingy-gauntlet`:

- heuristic: `14.0%`
- oracle: `53.0%`

This is blunt difficulty. It removes safety nets and increases punishment.

`turn-maze`:

- heuristic: `38.3%`
- oracle: `95.4%`

This is not blunt difficulty. It increases planning complexity while leaving the game mostly solvable for a strong search policy.

That makes `turn-maze` a candidate for a “thinkier” mode, not just a crueler one.

## Why These Findings Matter

The simulator changed the design conversation in a useful way.

Before the experiments, the question was mostly:

- is the default too hard?

After the experiments, the better questions are:

- too hard for what kind of player?
- hard because of trap density, or because of planning depth?
- should an easier mode be simpler, richer, or more recoverable?
- which alternate presets actually create distinct play experiences?

That is the real value of the harness.
It turns vague balance intuition into measurable tradeoffs.

## Recommended Preset Roles

### Main mode

Use something close to:

- `startingTokens: 1`
- `hazardBalancePercent: 40`
- `straightWeight: 6`
- `softWeight: 8`
- `hardWeight: 6`

Reason:

- clearly fairer than the current default
- still recognizably the same game
- does not rely on extra tokens as the only safety valve

### Easy mode

Use:

- `startingTokens: 2`
- `hazardBalancePercent: 25`
- `straightWeight: 6`
- `softWeight: 8`
- `hardWeight: 6`

Reason:

- very forgiving
- easy to explain
- clean onboarding preset

### Alternate modes worth keeping around

- `Token Rush`: reward-rich, recovery-heavy, generous economy
- `Short Sprint`: fast, readable, compact sessions
- `Turn Maze`: planning-heavy without dramatic oracle difficulty increase
- `Stingy Gauntlet`: explicit hard mode only

## Next Steps

- keep using the simulator as a filter before manual playtests
- add CSV or JSON export if external charting becomes useful
- test curated seeds that produce especially ugly openings
- compare future rule changes against both `surveyHeuristic` and `monteCarlo`, not only one of them
