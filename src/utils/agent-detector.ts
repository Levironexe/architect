import { existsSync } from 'node:fs';
import path from 'node:path';

export type AgentType = 'claude';

export function detectAgent(dir: string): AgentType {
  try {
    existsSync(path.join(dir, '.claude'));
  } catch {
    // fs errors are non-fatal; Claude Code is the only supported target
  }

  return 'claude';
}
