import type { ScanResult } from './analysis.js';

export type ScanRunStatus = 'success' | 'partial' | 'failed';
export type ScanOutputMode = 'terminal' | 'json';
export type SkippedInputReason = 'unsupported_type' | 'binary' | 'parse_error' | 'ignored' | 'unreadable' | 'outside_target';
export type QualityObservationType = 'bug' | 'threshold_tuning' | 'message_tuning' | 'plan_quality' | 'note';
export type QualityObservationSeverity = 'low' | 'medium' | 'high';

export interface ScanThresholds {
  locThreshold: number;
  complexityThreshold: number;
}

export interface ThresholdConfiguration extends ScanThresholds {
  source: 'default' | 'cli';
}

export interface ScanWarning {
  code: string;
  message: string;
  path?: string;
}

export interface ScanDiagnostic {
  phase: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface SkippedInput {
  path: string;
  reason: SkippedInputReason;
  message: string;
  affectsConfidence: boolean;
}

export interface ScanRun {
  targetDir: string;
  status: ScanRunStatus;
  outputMode: ScanOutputMode;
  verbose: boolean;
  startedAt: string;
  durationMs: number;
  warnings: ScanWarning[];
  diagnostics: ScanDiagnostic[];
  result: ScanResult | null;
}

export interface MetricsOnlyResult {
  availableDimensions: string[];
  unavailableDimensions: Array<{ id: string; reason: string }>;
  healthState: string;
  classificationStatus: string;
}

export interface MachineReadableScanOutput {
  schemaVersion: '1.0';
  command: {
    name: 'scan';
    targetDir: string;
    verbose: boolean;
  };
  run: {
    status: ScanRunStatus;
    durationMs: number;
    outputMode: 'json';
  };
  result: ScanResult | null;
  warnings: ScanWarning[];
  diagnostics: ScanDiagnostic[];
  error?: {
    message: string;
    correctiveAction: string;
  };
}

export interface IntegrationSample {
  name: string;
  category: string;
  source: string;
  commandsRun: string[];
  outcome: 'pass' | 'partial' | 'blocked';
  observations: QualityObservation[];
}

export interface QualityObservation {
  sampleName: string;
  type: QualityObservationType;
  severity: QualityObservationSeverity;
  description: string;
  followUp: string;
}
