import { RULES_PRESETS } from '../src/lib/presets.ts';
import { formatPercent, simulateGame } from './lib/playtest-core.ts';

interface CliOptions {
  games: number;
  policy: 'surveyHeuristic' | 'monteCarlo';
  seedStart: number;
  showCards: boolean;
  rolloutCount: number;
  surveyRolloutCount: number;
}

interface CardStat {
  games: number;
  wins: number;
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
  const policyArg = args.includes('--policy')
    ? args[args.indexOf('--policy') + 1]
    : 'monteCarlo';

  return {
    games: parseIntegerArg(args, '--games', 240),
    policy:
      policyArg === 'surveyHeuristic' ? 'surveyHeuristic' : 'monteCarlo',
    seedStart: parseIntegerArg(args, '--seed-start', 1),
    showCards: args.includes('--show-cards'),
    rolloutCount: parseIntegerArg(args, '--rollouts', 10),
    surveyRolloutCount: parseIntegerArg(args, '--survey-rollouts', 6),
  };
}

function sortCardStats(
  cardStats: Map<string, CardStat>,
): Array<[string, CardStat, number]> {
  return [...cardStats.entries()]
    .map(([cardId, stat]) => [cardId, stat, stat.games > 0 ? stat.wins / stat.games : 0] as const)
    .sort((left, right) => right[2] - left[2]);
}

function main(options: CliOptions): void {
  const policy =
    options.policy === 'surveyHeuristic'
      ? {
          id: 'surveyHeuristic' as const,
        }
      : {
          id: 'monteCarlo' as const,
          rolloutCount: options.rolloutCount,
          surveyRolloutCount: options.surveyRolloutCount,
        };

  console.log('# Preset Audit');
  console.log('');
  console.log(`Games per preset: ${options.games}`);
  console.log(`Policy: ${options.policy}`);
  console.log(`Seed start: ${options.seedStart}`);
  if (options.policy === 'monteCarlo') {
    console.log(`Rollouts: ${options.rolloutCount}`);
    console.log(`Survey rollouts: ${options.surveyRolloutCount}`);
  }
  console.log('');

  for (const preset of RULES_PRESETS) {
    let wins = 0;
    let totalTurns = 0;
    let totalSurveys = 0;
    let forcedLossGames = 0;
    const cardStats = new Map<string, CardStat>();

    for (let index = 0; index < options.games; index += 1) {
      const result = simulateGame(
        {
          ...preset.rules,
          seed: options.seedStart + index,
        },
        policy,
        {
          setupMode: 'deck',
        },
      );

      totalTurns += result.turnsPlayed;
      totalSurveys += result.surveysSpent;
      if (result.status === 'won') {
        wins += 1;
      }
      if (result.forcedLossTurns > 0) {
        forcedLossGames += 1;
      }

      const current = cardStats.get(result.setupCardId) ?? {
        games: 0,
        wins: 0,
      };
      current.games += 1;
      if (result.status === 'won') {
        current.wins += 1;
      }
      cardStats.set(result.setupCardId, current);
    }

    const sortedCards = sortCardStats(cardStats);
    const bestCard = sortedCards[0];
    const worstCard = sortedCards[sortedCards.length - 1];

    console.log(`## ${preset.label}`);
    console.log(
      `Overall: ${formatPercent(wins / options.games)} win rate, ${(totalTurns / options.games).toFixed(2)} avg turns, ${(totalSurveys / options.games).toFixed(2)} avg surveys, ${forcedLossGames}/${options.games} games with a forced-loss turn.`,
    );
    console.log(
      `Card spread: best ${bestCard?.[0] ?? 'n/a'} at ${formatPercent(bestCard?.[2] ?? 0)} (${bestCard?.[1].wins ?? 0}/${bestCard?.[1].games ?? 0}), worst ${worstCard?.[0] ?? 'n/a'} at ${formatPercent(worstCard?.[2] ?? 0)} (${worstCard?.[1].wins ?? 0}/${worstCard?.[1].games ?? 0}).`,
    );
    if (options.showCards) {
      for (const [cardId, stat, winRate] of sortedCards) {
        console.log(
          `  ${cardId}: ${formatPercent(winRate)} (${stat.wins}/${stat.games})`,
        );
      }
    }
    console.log('');
  }
}

main(parseArgs(process.argv.slice(2)));
