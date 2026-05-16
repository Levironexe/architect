import { DEFAULT_COMPLEXITY_THRESHOLD, DEFAULT_LOC_THRESHOLD } from '../types/analysis.js';
import type { ThresholdConfiguration } from '../types/scan-output.js';

const THRESHOLD_KEYS = new Set(['loc', 'complexity']);

export const DEFAULT_SCAN_THRESHOLDS: ThresholdConfiguration = {
  locThreshold: DEFAULT_LOC_THRESHOLD,
  complexityThreshold: DEFAULT_COMPLEXITY_THRESHOLD,
  source: 'default'
};

export class ThresholdParseError extends Error {
  constructor(message: string) {
    super(`${message} Example: --threshold loc=300,complexity=15`);
    this.name = 'ThresholdParseError';
  }
}

export function parseThresholdOption(value: string | undefined): ThresholdConfiguration {
  if (!value || value.trim().length === 0) {
    return DEFAULT_SCAN_THRESHOLDS;
  }

  const entries = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) {
    throw new ThresholdParseError('Threshold value is empty.');
  }

  const thresholds: ThresholdConfiguration = {
    ...DEFAULT_SCAN_THRESHOLDS,
    source: 'cli'
  };

  for (const entry of entries) {
    const [rawKey, rawValue, extra] = entry.split('=');
    if (!rawKey || rawValue === undefined || extra !== undefined) {
      throw new ThresholdParseError(`Invalid threshold segment "${entry}".`);
    }

    const key = rawKey.trim().toLowerCase();
    if (!THRESHOLD_KEYS.has(key)) {
      throw new ThresholdParseError(`Unknown threshold key "${rawKey}". Supported keys: loc, complexity.`);
    }

    const parsed = Number(rawValue.trim());
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new ThresholdParseError(`Threshold "${rawKey}" must be a positive integer.`);
    }

    if (key === 'loc') {
      thresholds.locThreshold = parsed;
    } else {
      thresholds.complexityThreshold = parsed;
    }
  }

  return thresholds;
}
