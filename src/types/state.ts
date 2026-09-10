export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface PhaseState {
  id: number;
  name: string;
  status: PhaseStatus;
  started_at?: string;
  completed_at?: string;
}

export interface ArchitectState {
  plan_version: string;
  total_phases: number;
  current_phase: number;
  phases: PhaseState[];
  baseline_violations: number | null;
  latest_violations: number | null;
}

export interface ScanSnapshot {
  timestamp: string;
  flagged_files: number;
  flagged_functions: number;
  circular_deps: number;
  total_files: number;
  total_loc: number;
  avg_file_loc: number;
  god_files: number;
}

export interface DiffMetric {
  label: string;
  before: number | string;
  after: number | string;
  delta: number;
  unit?: string;
  higherIsBetter?: boolean;
}

export interface PlanCheckFailure {
  step: string;
  command: string;
  output: string;
}

export interface VerifyResult {
  phase?: number;
  phase_name?: string;
  language: string;
  compilation_errors: number;
  compilation_label: string;
  broken_imports: string[];
  new_circular_deps: number;
  violations: number;
  baseline_violations: number | null;
  new_violations: number;
  plan_checks_total: number;
  plan_checks_failed: PlanCheckFailure[];
  passed: boolean;
}
