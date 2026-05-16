import { describe, expect, it } from 'vitest';

import { DEFAULT_SCAN_THRESHOLDS, parseThresholdOption, ThresholdParseError } from '../../../src/utils/thresholds';

describe('parseThresholdOption', () => {
  it('returns default thresholds when no option is provided', () => {
    expect(parseThresholdOption(undefined)).toEqual(DEFAULT_SCAN_THRESHOLDS);
  });

  it('parses loc and complexity threshold values', () => {
    expect(parseThresholdOption('loc=250,complexity=12')).toEqual({
      locThreshold: 250,
      complexityThreshold: 12,
      source: 'cli'
    });
  });

  it('keeps unspecified thresholds at defaults', () => {
    expect(parseThresholdOption('loc=200')).toEqual({
      locThreshold: 200,
      complexityThreshold: DEFAULT_SCAN_THRESHOLDS.complexityThreshold,
      source: 'cli'
    });
  });

  it('rejects invalid threshold values with a helpful example', () => {
    expect(() => parseThresholdOption('loc=-1')).toThrow(ThresholdParseError);
    expect(() => parseThresholdOption('size=10')).toThrow('Example: --threshold loc=300,complexity=15');
  });
});
