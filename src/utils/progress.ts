import type { ScanDiagnostic } from '../types/scan-output.js';

export const LARGE_SCAN_FILE_THRESHOLD = 1000;

export const SCAN_PHASES = [
  'discovery',
  'parsing',
  'dependency-analysis',
  'duplication-analysis',
  'classification',
  'scoring',
  'reporting'
] as const;

export function shouldReportProgress(fileCount: number, verbose: boolean, threshold = LARGE_SCAN_FILE_THRESHOLD): boolean {
  return verbose && fileCount >= threshold;
}

export interface ProgressRenderOptions {
  json?: boolean;
  verbose?: boolean;
  isInteractive?: boolean;
  stdoutIsTTY?: boolean;
  stderrIsTTY?: boolean;
  fileCount?: number;
  threshold?: number;
  force?: boolean;
}

export function shouldRenderHumanProgress(options: ProgressRenderOptions): boolean {
  if (options.force === true) {
    return options.json !== true;
  }

  if (options.json === true || options.isInteractive !== true || options.stderrIsTTY !== true) {
    return false;
  }

  return options.verbose === true || shouldReportProgress(options.fileCount ?? 0, true, options.threshold);
}

export function createProgressDiagnostics(fileCount: number, verbose: boolean, threshold = LARGE_SCAN_FILE_THRESHOLD): ScanDiagnostic[] {
  if (!shouldReportProgress(fileCount, verbose, threshold)) {
    return [];
  }

  return SCAN_PHASES.map((phase) => ({
    phase,
    message: `Large scan progress milestone: ${phase}`,
    details: {
      fileCount,
      threshold
    }
  }));
}

export function createThresholdDiagnostics(locThreshold: number, complexityThreshold: number): ScanDiagnostic[] {
  return [
    {
      phase: 'configuration',
      message: 'Scan thresholds applied',
      details: {
        locThreshold,
        complexityThreshold
      }
    }
  ];
}
