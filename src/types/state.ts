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
  baseline_health: number | null;
  latest_health: number | null;
}

export interface ScanSnapshot {
  timestamp: string;
  health_score: number;
  flagged_files: number;
  flagged_functions: number;
  circular_deps: number;
  duplication_pct: number;
  total_files: number;
  total_loc: number;
  avg_file_loc: number;
  god_files: number;
  scan_tier?: 'lite' | 'full';
}

export interface DiffMetric {
  label: string;
  before: number | string;
  after: number | string;
  delta: number;
  unit?: string;
}

export interface VerifyResult {
  phase?: number;
  phase_name?: string;
  tsc_errors: number;
  broken_imports: string[];
  new_circular_deps: number;
  duplication_delta: number;
  health_delta: number;
  passed: boolean;
}
