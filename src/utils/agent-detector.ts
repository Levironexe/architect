import { existsSync } from 'node:fs';
import path from 'node:path';

export type AgentType = 'claude' | 'cursor' | 'windsurf' | 'copilot' | 'generic';

const AGENT_DIRS: Array<{ dir: string; agent: AgentType }> = [
  { dir: '.claude', agent: 'claude' },
  { dir: '.cursor', agent: 'cursor' },
  { dir: '.windsurf', agent: 'windsurf' },
  { dir: '.github', agent: 'copilot' }
];

export function detectAgent(dir: string): AgentType {
  try {
    for (const { dir: agentDir, agent } of AGENT_DIRS) {
      if (existsSync(path.join(dir, agentDir))) {
        return agent;
      }
    }
  } catch {
    // fs errors return generic
  }

  return 'generic';
}
