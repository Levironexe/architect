import type { ScanResult } from '../types/analysis.js';
import type { MachineReadableScanOutput, ScanDiagnostic, ScanWarning } from '../types/scan-output.js';

export interface RenderScanJsonInput {
  result: ScanResult | null;
  targetDir: string;
  verbose: boolean;
  durationMs: number;
  warnings: ScanWarning[];
  diagnostics: ScanDiagnostic[];
  status?: MachineReadableScanOutput['run']['status'];
  error?: MachineReadableScanOutput['error'];
}

export function renderScanJson(input: RenderScanJsonInput): string {
  const output: MachineReadableScanOutput = {
    schemaVersion: '1.0',
    command: {
      name: 'scan',
      targetDir: input.targetDir,
      verbose: input.verbose
    },
    run: {
      status: input.status ?? statusFor(input.result, input.warnings),
      durationMs: input.durationMs,
      outputMode: 'json'
    },
    result: input.result,
    warnings: input.warnings,
    diagnostics: input.diagnostics,
    ...(input.error ? { error: input.error } : {})
  };

  return `${JSON.stringify(output, null, 2)}\n`;
}

function statusFor(result: ScanResult | null, warnings: ScanWarning[]): MachineReadableScanOutput['run']['status'] {
  if (!result) return 'failed';
  return warnings.some((warning) => warning.code === 'parse_error' || warning.code === 'partial_analysis') ? 'partial' : 'success';
}
