import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from './game';
import {
  formatAggregateTable,
  runExperiment,
  simulateGame,
} from '../../scripts/lib/playtest-core.ts';

describe('playtest simulator', () => {
  it('can simulate one complete game for every policy', () => {
    for (const policyId of [
      'random',
      'safeRandom',
      'surveyHeuristic',
      'monteCarlo',
    ] as const) {
      const result = simulateGame(
        {
          ...DEFAULT_RULES,
          featureDensityPercent: 0,
          seed: 11,
        },
        {
          id: policyId,
          rolloutCount: 4,
          surveyRolloutCount: 3,
        },
      );

      expect(['won', 'lost']).toContain(result.status);
      expect(result.turnsPlayed).toBeGreaterThan(0);
    }
  });

  it('aggregates experiment totals consistently', () => {
    const aggregate = runExperiment({
      label: 'smoke',
      games: 12,
      seedStart: 3,
      policy: {
        id: 'surveyHeuristic',
      },
      rules: {
        ...DEFAULT_RULES,
        featureDensityPercent: 12,
      },
    });

    expect(aggregate.games).toBe(12);
    expect(aggregate.wins + aggregate.losses).toBe(12);
    expect(aggregate.winRate).toBeGreaterThanOrEqual(0);
    expect(aggregate.winRate).toBeLessThanOrEqual(1);
  });

  it('formats comparison tables with headers and rows', () => {
    const table = formatAggregateTable([
      runExperiment({
        label: 'smoke-a',
        games: 4,
        seedStart: 20,
        policy: { id: 'safeRandom' },
        rules: DEFAULT_RULES,
      }),
      runExperiment({
        label: 'smoke-b',
        games: 4,
        seedStart: 40,
        policy: { id: 'surveyHeuristic' },
        rules: DEFAULT_RULES,
      }),
    ]);

    expect(table).toContain('Label');
    expect(table).toContain('smoke-a');
    expect(table).toContain('smoke-b');
  });
});
