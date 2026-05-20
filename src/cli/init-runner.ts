import { existsSync, readdirSync, type Dirent } from 'node:fs';
import { join } from 'node:path';

import type { AgentType } from '../utils/agent-detector.js';
import { confirm, select } from '@inquirer/prompts';
import ora, { type Ora } from 'ora';

import { runProjectScan, type ProjectScanOptions } from './scan-runner.js';
import { buildClaudeWriterTargets } from '../generators/claudeWriter.js';
import { buildCopilotWriterTargets } from '../generators/copilotWriter.js';
import { buildGenericWriterTargets } from '../generators/genericWriter.js';
import { buildTemplateContext, renderBundledTemplates, resolveSkillByReference } from '../generators/template-context.js';
import { buildWindsurfWriterTargets } from '../generators/windsurfWriter.js';
import { buildCursorWriterTargets } from '../generators/cursorWriter.js';
import {
  findExistingWriterTargets,
  writeWriterTargets,
  type IntegrationWriter
} from '../generators/writer-types.js';
import type { InitSummary } from '../types/generation.js';
import { loadSkills } from '../skills/loader.js';
import { detectAgent } from '../utils/agent-detector.js';
import { isInteractiveTerminal } from '../utils/interactive.js';
import { ensureDirectoryPath } from '../utils/path.js';
import { detectLanguage, type DetectedLanguage } from '../languages/registry.js';
import { collectProjectCharacteristicsFromLanguage, detectSkills } from '../skills/detector.js';

export interface InitCommandOptions extends ProjectScanOptions {
  skill?: string;
  integration?: AgentType;
  update?: boolean;
}

interface InitRunnerDependencies {
  confirmOverwrite?: (message: string) => Promise<boolean>;
  detectAgent?: (dir: string) => AgentType;
  promptAgent?: (detected: AgentType) => Promise<AgentType>;
  interactiveCheck?: () => boolean;
  loadSkills?: typeof loadSkills;
  runProjectScan?: typeof runProjectScan;
  renderBundledTemplates?: typeof renderBundledTemplates;
  writers?: Record<AgentType, IntegrationWriter>;
  createSpinner?: (text: string) => Pick<Ora, 'start' | 'stop'>;
}

const WRITERS: Record<AgentType, IntegrationWriter> = {
  claude: buildClaudeWriterTargets,
  cursor: buildCursorWriterTargets,
  windsurf: buildWindsurfWriterTargets,
  copilot: buildCopilotWriterTargets,
  generic: buildGenericWriterTargets
};

export async function runInitCommand(
  directory: string,
  options: InitCommandOptions = {},
  dependencies: InitRunnerDependencies = {}
): Promise<InitSummary> {
  const targetDirectory = ensureDirectoryPath(directory);
  const scanRunner = dependencies.runProjectScan ?? runProjectScan;
  const skillLoader = dependencies.loadSkills ?? loadSkills;
  const renderTemplates = dependencies.renderBundledTemplates ?? renderBundledTemplates;
  const detectAgentForDirectory = dependencies.detectAgent ?? detectAgent;
  const confirmOverwrite = dependencies.confirmOverwrite ?? defaultConfirmOverwrite;
  const isInteractive = dependencies.interactiveCheck ?? (() => isInteractiveTerminal());
  const writers = dependencies.writers ?? WRITERS;
  const createSpinner = dependencies.createSpinner ?? ((text: string) => ora(text));
  const promptAgent = dependencies.promptAgent ?? defaultPromptAgent;
  const warnings: string[] = [];

  const detected = await detectLanguage(targetDirectory);

  if (!detected) {
    throw new Error(
      'Could not detect project language.\nSupported: JavaScript/TypeScript, Python, C#\nMake sure you are in a project root with a config file (package.json, pyproject.toml, requirements.txt, *.csproj) or source files.'
    );
  }

  const { skills } = await skillLoader();
  let selectedSkill: Awaited<ReturnType<typeof loadSkills>>['skills'][number] | undefined;
  let result: Awaited<ReturnType<typeof runProjectScan>> | undefined;

  if (detected.config.supportsScanning) {
    const fileCount = estimateFileCount(targetDirectory);
    const spinner = fileCount > 500 ? createSpinner(`Scanning ${fileCount}+ files…`).start() : null;

    try {
      result = await scanRunner(targetDirectory, options);
    } finally {
      spinner?.stop();
    }

    if (result.summary.totalFiles === 0) {
      throw new Error('No source files found. Point architect at a JS/TS project root.');
    }

    selectedSkill = resolveSelectedSkill(options.skill, result, skills);
  } else {
    process.stderr.write(`Detected: ${detected.config.name}${detected.configFile ? ` (via ${detected.configFile})` : ''}\n`);

    if (options.skill) {
      selectedSkill = resolveSkillByReference(options.skill, skills);
    } else {
      const characteristics = await collectProjectCharacteristicsFromLanguage(targetDirectory, detected);
      const languageSkills = skills.filter((s) => s.language === detected.config.id || s.language === 'agnostic');
      const matchedSkills = detectSkills(characteristics, languageSkills);
      const primary = matchedSkills.find((m) => m.primary);
      selectedSkill = primary?.skill;

      if (!selectedSkill) {
        const langSkills = skills.filter((s) => s.language === detected.config.id);
        if (langSkills.length > 0) {
          const skillList = langSkills.map((s) => s.id).join(', ');
          throw new Error(
            `Detected ${detected.config.name} project but no matching framework.\nAvailable ${detected.config.name} skills: ${skillList}\nInstall manually with: architect init . --skill <id>`
          );
        }
        throw new Error(`Detected ${detected.config.name} project but no skills available for this language.`);
      }

      process.stderr.write(`Matched skill: ${selectedSkill.name}\n`);
    }
  }

  if (!selectedSkill) {
    if (options.skill) {
      throw new Error(`Unknown architecture skill: ${options.skill}`);
    }

    throw new Error('Could not detect stack. Override with --skill <id>.');
  }

  const detectedIntegration = detectAgentForDirectory(targetDirectory);
  let integration: AgentType;
  if (options.integration) {
    integration = options.integration;
  } else if (isInteractive()) {
    integration = await promptAgent(detectedIntegration);
  } else {
    integration = detectedIntegration;
    if (integration === 'generic') {
      warnings.push('No known agent integration detected; using generic output.');
    }
  }

  const context = result
    ? buildTemplateContext(selectedSkill, result, result.matchedSkills ?? [])
    : buildTemplateContext(selectedSkill, undefined, []);
  const renderedFiles = await renderTemplates(context);
  const writer = writers[integration];
  const targets = writer(renderedFiles);
  const existingTargets = findExistingWriterTargets(targetDirectory, targets);

  if (existingTargets.length > 0 && options.update !== true) {
    if (!isInteractive()) {
      throw new Error(`Architect guidance files already exist: ${existingTargets.join(', ')}\nRe-run with --update to overwrite them.`);
    }

    const confirmed = await confirmOverwrite(`Architect guidance already exists. Overwrite ${existingTargets.length} file(s)?`);

    if (!confirmed) {
      return {
        targetDir: targetDirectory,
        skillId: selectedSkill.id,
        skillName: selectedSkill.name,
        integration,
        filesWritten: [],
        filesSkipped: existingTargets,
        warnings: [...warnings, 'Overwrite declined; no files were changed.']
      };
    }
  }

  const filesWritten = await writeWriterTargets(targetDirectory, targets);

  return {
    targetDir: targetDirectory,
    skillId: selectedSkill.id,
    skillName: selectedSkill.name,
    integration,
    filesWritten,
    filesSkipped: [],
    warnings
  };
}

function resolveSelectedSkill(
  override: string | undefined,
  result: Awaited<ReturnType<typeof runProjectScan>>,
  skills: Awaited<ReturnType<typeof loadSkills>>['skills']
) {
  if (override) {
    return resolveSkillByReference(override, skills);
  }

  return result.matchedSkills?.find((match) => match.primary)?.skill;
}

async function defaultConfirmOverwrite(message: string): Promise<boolean> {
  return confirm({
    message,
    default: false
  });
}

async function defaultPromptAgent(detected: AgentType = 'generic'): Promise<AgentType> {
  return select<AgentType>({
    message: 'Which coding agent are you using?',
    default: detected,
    choices: [
      { name: 'Claude Code  → .claude/skills/', value: 'claude' },
      { name: 'Cursor       → .cursor/rules/', value: 'cursor' },
      { name: 'Windsurf     → .windsurf/rules/', value: 'windsurf' },
      { name: 'GitHub Copilot → .github/copilot-instructions.md', value: 'copilot' },
      { name: 'Other / plain Markdown → .architect/skills/', value: 'generic' }
    ]
  });
}

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo']);

function estimateFileCount(dir: string, depthLimit = 4, countLimit = 600): number {
  let count = 0;
  function walk(current: string, depth: number): void {
    if (count >= countLimit) return;
    let entries: Dirent<string>[];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (count >= countLimit) return;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && depth < depthLimit) {
          walk(join(current, entry.name), depth + 1);
        }
      } else {
        count++;
      }
    }
  }
  walk(dir, 0);
  return count;
}