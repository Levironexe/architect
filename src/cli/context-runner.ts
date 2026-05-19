import { renderBlueprints } from '../generators/blueprint-renderer.js';
import { resolveSkillsByReference } from '../generators/template-context.js';
import { loadSkills } from '../skills/loader.js';
import { runProjectScan } from './scan-runner.js';

export async function runContextCommand(requestedStacks: string[]): Promise<string> {
  const normalizedRequests = requestedStacks.map((stack) => stack.trim()).filter((stack) => stack.length > 0);

  if (normalizedRequests.length === 0) {
    return runContextCommandFromScan(process.cwd());
  }

  const { skills } = await loadSkills();
  const { resolvedSkills, missingReferences } = resolveSkillsByReference(normalizedRequests, skills);

  if (missingReferences.length > 0) {
    throw new Error(`Unknown architecture skill(s): ${missingReferences.join(', ')}`);
  }

  return renderBlueprints(resolvedSkills);
}

async function runContextCommandFromScan(directory: string): Promise<string> {
  const result = await runProjectScan(directory);

  if (!result.matchedSkills || result.matchedSkills.length === 0) {
    throw new Error('Could not detect stack. Override with --techstack <id>.');
  }

  const detectedIds = result.matchedSkills
    .sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0))
    .map((m) => m.skill.id);

  process.stderr.write(`Detected stack(s): ${detectedIds.join(', ')}\n`);

  const { skills } = await loadSkills();
  const { resolvedSkills, missingReferences } = resolveSkillsByReference(detectedIds, skills);

  if (missingReferences.length > 0) {
    throw new Error(`Unknown architecture skill(s): ${missingReferences.join(', ')}`);
  }

  return renderBlueprints(resolvedSkills);
}