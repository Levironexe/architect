import { renderBlueprints } from '../generators/blueprint-renderer.js';
import { resolveSkillsByReference } from '../generators/template-context.js';
import { loadSkills } from '../skills/loader.js';

export async function runContextCommand(requestedStacks: string[]): Promise<string> {
  const normalizedRequests = requestedStacks.map((stack) => stack.trim()).filter((stack) => stack.length > 0);

  if (normalizedRequests.length === 0) {
    throw new Error('At least one tech stack is required. Pass --techstack <id>.');
  }

  const { skills } = await loadSkills();
  const { resolvedSkills, missingReferences } = resolveSkillsByReference(normalizedRequests, skills);

  if (missingReferences.length > 0) {
    throw new Error(`Unknown architecture skill(s): ${missingReferences.join(', ')}`);
  }

  return renderBlueprints(resolvedSkills);
}