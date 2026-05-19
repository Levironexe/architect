export type SecuritySeverity = 'critical' | 'warning' | 'info';

export interface SecurityFinding {
  severity: SecuritySeverity;
  check: string;
  file: string;
  line?: number;
  message: string;
  suggestion: string;
}

export interface SecuritySummary {
  findings: SecurityFinding[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}
