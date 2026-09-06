export type SkippedInputReason =
  | 'unsupported_type'
  | 'binary'
  | 'parse_error'
  | 'ignored'
  | 'unreadable'
  | 'outside_target';

export interface ScanThresholds {
  locThreshold: number;
  complexityThreshold: number;
}

export interface SkippedInput {
  path: string;
  reason: SkippedInputReason;
  message: string;
  affectsConfidence: boolean;
}
