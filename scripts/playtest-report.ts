import {
  DEFAULT_RULES,
  type RulesConfig,
} from '../src/lib/game.ts';
import { RULES_PRESETS } from '../src/lib/presets.ts';
import {
  type ExperimentConfig,
  type PlaytestAggregate,
  formatAggregateTable,
  formatPercent,
  runExperiment,
  sortCounts,
} from './lib/playtest-core.ts';

interface CliOptions {
  baseGames: number;
  sweepGames: number;
  rolloutCount: number;
  surveyRolloutCount: number;
  seedStart: number;
}

function parseIntegerArg(
  args: string[],
  flag: string,
  defaultValue: number,
): number {
  const index = args.indexOf(flag);
  if (index === -1) {
    return defaultValue;
  }

  const value = Number(args[index + 1]);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : defaultValue;
}

function parseArgs(args: string[]): CliOptions {
  return {
    baseGames: parseIntegerArg(args, '--base-games', 200),
    sweepGames: parseIntegerArg(args, '--sweep-games', 120),
    rolloutCount: parseIntegerArg(args, '--rollouts', 10),
    surveyRolloutCount: parseIntegerArg(args, '--survey-rollouts', 6),
    seedStart: parseIntegerArg(args, '--seed-start', 1),
  };
}

function runExperiments(experiments: readonly ExperimentConfig[]): PlaytestAggregate[] {
  return experiments.map((experiment) => runExperiment(experiment));
}

function formatCountSummary(counts: Record<string, number>, limit = 4): string {
  const entries = sortCounts(counts).slice(0, limit);
  if (entries.length === 0) {
    return 'None';
  }

  return entries.map(([label, count]) => `${label}: ${count}`).join('; ');
}

function describePolicyFindings(
  aggregates: readonly PlaytestAggregate[],
): string[] {
  const sorted = [...aggregates].sort((left, right) => right.winRate - left.winRate);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return [
    `Best default-board performer: \`${best.label}\` at ${formatPercent(best.winRate)} win rate.`,
    `Weakest default-board performer: \`${worst.label}\` at ${formatPercent(worst.winRate)} win rate.`,
    `Survey rescues matter most when the policy actually looks for them: ${sorted
      .filter((aggregate) => aggregate.gamesRescuedBySurvey > 0)
      .map(
        (aggregate) =>
          `\`${aggregate.label}\` rescued ${aggregate.gamesRescuedBySurvey}/${aggregate.games} games`,
      )
      .join(', ') || 'none of the tested policies converted a dead offer into a live turn'}.`,
  ];
}

function buildTokenSweepExperiments(options: CliOptions): ExperimentConfig[] {
  return [0, 1, 2, 3].map((startingTokens) => ({
    label: `tokens-${startingTokens}`,
    games: options.sweepGames,
    seedStart: options.seedStart,
    policy: {
      id: 'monteCarlo',
      rolloutCount: options.rolloutCount,
      surveyRolloutCount: options.surveyRolloutCount,
    },
    rules: {
      ...DEFAULT_RULES,
      startingTokens,
    },
  }));
}

function buildFeatureSweepExperiments(options: CliOptions): ExperimentConfig[] {
  return [12, 18, 24, 30].map((featureDensityPercent) => ({
    label: `density-${featureDensityPercent}`,
    games: options.sweepGames,
    seedStart: options.seedStart,
    policy: {
      id: 'monteCarlo',
      rolloutCount: options.rolloutCount,
      surveyRolloutCount: options.surveyRolloutCount,
    },
    rules: {
      ...DEFAULT_RULES,
      featureDensityPercent,
    },
  }));
}

function buildHazardSweepExperiments(options: CliOptions): ExperimentConfig[] {
  return [25, 50, 75].map((hazardBalancePercent) => ({
    label: `hazards-${hazardBalancePercent}`,
    games: options.sweepGames,
    seedStart: options.seedStart,
    policy: {
      id: 'monteCarlo',
      rolloutCount: options.rolloutCount,
      surveyRolloutCount: options.surveyRolloutCount,
    },
    rules: {
      ...DEFAULT_RULES,
      hazardBalancePercent,
    },
  }));
}

function buildTileSweepExperiments(options: CliOptions): ExperimentConfig[] {
  const variants: Array<{
    label: string;
    rules: Pick<RulesConfig, 'straightWeight' | 'softWeight' | 'hardWeight'>;
  }> = [
    {
      label: 'straighter',
      rules: {
        straightWeight: 6,
        softWeight: 8,
        hardWeight: 6,
      },
    },
    {
      label: 'default',
      rules: {
        straightWeight: 4,
        softWeight: 10,
        hardWeight: 8,
      },
    },
    {
      label: 'turn-heavy',
      rules: {
        straightWeight: 2,
        softWeight: 12,
        hardWeight: 10,
      },
    },
  ];

  return variants.map((variant) => ({
    label: variant.label,
    games: options.sweepGames,
    seedStart: options.seedStart,
    policy: {
      id: 'monteCarlo',
      rolloutCount: options.rolloutCount,
      surveyRolloutCount: options.surveyRolloutCount,
    },
    rules: {
      ...DEFAULT_RULES,
      ...variant.rules,
    },
  }));
}

function buildNamedPresetExperiments(
  options: CliOptions,
  policy: ExperimentConfig['policy'],
): ExperimentConfig[] {
  return RULES_PRESETS.map((preset) => ({
    label: preset.id,
    games: options.sweepGames,
    seedStart: options.seedStart,
    policy,
    rules: preset.rules,
  }));
}

function getBestAggregate(
  aggregates: readonly PlaytestAggregate[],
): PlaytestAggregate {
  return [...aggregates].sort((left, right) => right.winRate - left.winRate)[0]!;
}

function getWorstAggregate(
  aggregates: readonly PlaytestAggregate[],
): PlaytestAggregate {
  return [...aggregates].sort((left, right) => left.winRate - right.winRate)[0]!;
}

function buildReport(options: CliOptions): string {
  const policyAggregates = runExperiments([
    {
      label: 'random',
      games: options.baseGames,
      seedStart: options.seedStart,
      policy: { id: 'random' },
      rules: DEFAULT_RULES,
    },
    {
      label: 'safeRandom',
      games: options.baseGames,
      seedStart: options.seedStart,
      policy: { id: 'safeRandom' },
      rules: DEFAULT_RULES,
    },
    {
      label: 'surveyHeuristic',
      games: options.baseGames,
      seedStart: options.seedStart,
      policy: { id: 'surveyHeuristic' },
      rules: DEFAULT_RULES,
    },
    {
      label: 'monteCarlo',
      games: options.baseGames,
      seedStart: options.seedStart,
      policy: {
        id: 'monteCarlo',
        rolloutCount: options.rolloutCount,
        surveyRolloutCount: options.surveyRolloutCount,
      },
      rules: DEFAULT_RULES,
    },
  ]);
  const tokenAggregates = runExperiments(buildTokenSweepExperiments(options));
  const featureAggregates = runExperiments(buildFeatureSweepExperiments(options));
  const hazardAggregates = runExperiments(buildHazardSweepExperiments(options));
  const tileAggregates = runExperiments(buildTileSweepExperiments(options));
  const heuristicPresetAggregates = runExperiments(
    buildNamedPresetExperiments(options, {
      id: 'surveyHeuristic',
    }),
  );
  const monteCarloPresetAggregates = runExperiments(
    buildNamedPresetExperiments(options, {
      id: 'monteCarlo',
      rolloutCount: options.rolloutCount,
      surveyRolloutCount: options.surveyRolloutCount,
    }),
  );
  const baselineMonteCarlo = policyAggregates.find(
    (aggregate) => aggregate.policyId === 'monteCarlo',
  );

  if (!baselineMonteCarlo) {
    throw new Error('Baseline Monte Carlo aggregate was not produced.');
  }

  return [
    '# Traingame Playtest Report',
    '',
    `Base games per policy comparison: ${options.baseGames}`,
    `Sweep games per variant: ${options.sweepGames}`,
    `Monte Carlo rollout count: ${options.rolloutCount}`,
    `Monte Carlo survey rollout count: ${options.surveyRolloutCount}`,
    `Seed range starts at: ${options.seedStart}`,
    '',
    '## Policy Comparison',
    '',
    '```text',
    formatAggregateTable(policyAggregates),
    '```',
    '',
    ...describePolicyFindings(policyAggregates).map((line) => `- ${line}`),
    '',
    `Baseline Monte Carlo loss profile: ${formatCountSummary(
      baselineMonteCarlo.lossReasonCounts,
    )}.`,
    '',
    '## Starting Token Sweep',
    '',
    '```text',
    formatAggregateTable(tokenAggregates),
    '```',
    '',
    `Best token setting in this sweep: \`${[...tokenAggregates].sort(
      (left, right) => right.winRate - left.winRate,
    )[0]!.label}\` with ${formatPercent(getBestAggregate(tokenAggregates).winRate)} win rate.`,
    '',
    '## Feature Density Sweep',
    '',
    '```text',
    formatAggregateTable(featureAggregates),
    '```',
    '',
    `Highest-scoring density in this sweep: \`${[...featureAggregates].sort(
      (left, right) => right.winRate - left.winRate,
    )[0]!.label}\` at ${formatPercent(getBestAggregate(featureAggregates).winRate)}.`,
    '',
    '## Hazard Balance Sweep',
    '',
    '```text',
    formatAggregateTable(hazardAggregates),
    '```',
    '',
    `Best hazard split in this sweep: \`${[...hazardAggregates].sort(
      (left, right) => right.winRate - left.winRate,
    )[0]!.label}\` at ${formatPercent(getBestAggregate(hazardAggregates).winRate)}.`,
    '',
    '## Tile Mix Sweep',
    '',
    '```text',
    formatAggregateTable(tileAggregates),
    '```',
    '',
    `Best tile mix in this sweep: \`${[...tileAggregates].sort(
      (left, right) => right.winRate - left.winRate,
    )[0]!.label}\` at ${formatPercent(getBestAggregate(tileAggregates).winRate)}.`,
    '',
    '## Named Preset Bakeoff',
    '',
    '### Heuristic Policy',
    '',
    '```text',
    formatAggregateTable(heuristicPresetAggregates),
    '```',
    '',
    `Best heuristic preset: \`${getBestAggregate(heuristicPresetAggregates).label}\` at ${formatPercent(
      getBestAggregate(heuristicPresetAggregates).winRate,
    )}.`,
    `Worst heuristic preset: \`${getWorstAggregate(heuristicPresetAggregates).label}\` at ${formatPercent(
      getWorstAggregate(heuristicPresetAggregates).winRate,
    )}.`,
    '',
    '### Monte Carlo Policy',
    '',
    '```text',
    formatAggregateTable(monteCarloPresetAggregates),
    '```',
    '',
    `Best oracle preset: \`${getBestAggregate(monteCarloPresetAggregates).label}\` at ${formatPercent(
      getBestAggregate(monteCarloPresetAggregates).winRate,
    )}.`,
    `Worst oracle preset: \`${getWorstAggregate(monteCarloPresetAggregates).label}\` at ${formatPercent(
      getWorstAggregate(monteCarloPresetAggregates).winRate,
    )}.`,
    '',
    '## Baseline Notes',
    '',
    `- Default rules under Monte Carlo won ${baselineMonteCarlo.wins}/${baselineMonteCarlo.games} games.`,
    `- Forced-loss turns showed up in ${baselineMonteCarlo.gamesWithForcedLossTurn}/${baselineMonteCarlo.games} default-board games.`,
    `- Survey rescues occurred in ${baselineMonteCarlo.gamesRescuedBySurvey}/${baselineMonteCarlo.games} default-board games.`,
    `- Average surveys spent per default-board game: ${baselineMonteCarlo.averageSurveysSpent.toFixed(2)}.`,
    `- Average tokens collected per default-board game: ${baselineMonteCarlo.averageTokensCollected.toFixed(2)}.`,
    '',
  ].join('\n');
}

const options = parseArgs(process.argv.slice(2));
console.log(buildReport(options));
