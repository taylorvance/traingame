import { DEFAULT_RULES, normalizeRules, type RulesConfig } from './game.ts';

export interface RulesPreset {
  id: string;
  label: string;
  description: string;
  rules: RulesConfig;
}

export const RULES_PRESETS: RulesPreset[] = [
  {
    id: 'gold-rush',
    label: 'Gold Rush',
    description:
      'Kid-easy difficulty with extra tokens, gentler mountains, and lots of shiny rewards to chase.',
    rules: {
      ...DEFAULT_RULES,
      startingTokens: 2,
      featureDensityPercent: 16,
      hazardBalancePercent: 30,
    },
  },
  {
    id: 'classic-route',
    label: 'Classic Route',
    description:
      'Core boxed-game difficulty with balanced setup cards, one token, and readable track choices.',
    rules: {
      ...DEFAULT_RULES,
      startingTokens: 1,
      featureDensityPercent: 18,
      hazardBalancePercent: 36,
    },
  },
  {
    id: 'mountain-pass',
    label: 'Mountain Pass',
    description:
      'Hard difficulty with denser mountains, fewer easy lines, and just enough room to recover.',
    rules: {
      ...DEFAULT_RULES,
      startingTokens: 1,
      featureDensityPercent: 20,
      hazardBalancePercent: 46,
    },
  },
];

export const DEFAULT_PRESET_ID = 'classic-route';
export const DEFAULT_PRESET_RULES =
  RULES_PRESETS.find((preset) => preset.id === DEFAULT_PRESET_ID)?.rules ??
  DEFAULT_RULES;

function getComparableRules(rules: RulesConfig): Omit<RulesConfig, 'seed'> {
  const normalized = normalizeRules(rules);

  return {
    boardWidth: normalized.boardWidth,
    boardHeight: normalized.boardHeight,
    boardShape: normalized.boardShape,
    featureDensityPercent: normalized.featureDensityPercent,
    hazardBalancePercent: normalized.hazardBalancePercent,
    startingTokens: normalized.startingTokens,
    straightWeight: normalized.straightWeight,
    softWeight: normalized.softWeight,
    hardWeight: normalized.hardWeight,
  };
}

export function findRulesPresetById(id: string): RulesPreset | null {
  return RULES_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function findMatchingRulesPreset(
  rules: RulesConfig,
): RulesPreset | null {
  const comparableRules = getComparableRules(rules);

  return (
    RULES_PRESETS.find(
      (preset) =>
        JSON.stringify(getComparableRules(preset.rules)) ===
        JSON.stringify(comparableRules),
    ) ?? null
  );
}
