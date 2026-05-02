export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface ReportIssue {
  severity: IssueSeverity;
  category: string;
  location?: string;
  message: string;
  suggestion: string;
}

export interface ReportGuidance {
  message: string;
  command?: string;
}
