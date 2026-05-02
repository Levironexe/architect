import path from 'node:path';

import type { FileAnalysis } from '../types/analysis.js';
import type {
  ClassificationRequest,
  ClassificationSkillContext,
  FileClassificationInput,
  FunctionSignatureSummary
} from '../types/concern.js';
import type { SkillMatch } from '../types/skill.js';

const DEFAULT_TOKEN_BUDGET = 2000;
const AVERAGE_CHARS_PER_TOKEN = 4;
const REDACTED = '[redacted]';

export interface CreateClassificationRequestOptions {
  projectRoot: string;
  files: FileAnalysis[];
  matchedSkills: SkillMatch[];
  tokenBudget?: number;
}

export function createClassificationRequest(options: CreateClassificationRequestOptions): ClassificationRequest {
  return {
    projectRoot: options.projectRoot,
    skill: createSkillContext(options.matchedSkills),
    files: options.files.map((file) => toFileInput(file, options.projectRoot)),
    tokenBudget: options.tokenBudget ?? DEFAULT_TOKEN_BUDGET
  };
}

export function buildClassificationPrompt(request: ClassificationRequest): string {
  const safeFiles = trimFilesToBudget(request.files, request.tokenBudget, request.skill);
  const payload = {
    task: 'Classify each function by architectural concern. Return only JSON matching the schema.',
    taxonomy: [
      'routing',
      'business_logic',
      'data_access',
      'validation',
      'middleware',
      'ui_component',
      'utility',
      'configuration',
      'test',
      'unclassified'
    ],
    output_schema: {
      files: [
        {
          file: 'relative/path.ts',
          functions: [
            {
              name: 'functionName',
              concern: 'routing',
              confidence: 0.9,
              isMisplaced: false,
              reason: 'short non-source explanation'
            }
          ]
        }
      ]
    },
    privacy_rules: [
      'Do not ask for full source code.',
      'Use only file paths, imports, function names, parameter counts, line ranges, and skill rules.',
      'If evidence is weak, use unclassified.'
    ],
    skill: request.skill,
    files: safeFiles
  };

  return sanitizePrompt(JSON.stringify(payload, null, 2), request.projectRoot);
}

export function sanitizePrompt(prompt: string, projectRoot: string): string {
  const escapedRoot = escapeRegExp(projectRoot);
  return prompt
    .replace(new RegExp(escapedRoot, 'g'), '<project>')
    .replace(/sk-[A-Za-z0-9_-]+/g, REDACTED)
    .replace(/anthropic-[A-Za-z0-9_-]+/g, REDACTED)
    .replace(/(api[_-]?key\s*[=:]\s*)\S+/gi, `$1${REDACTED}`)
    .replace(/(authorization\s*[:=]\s*bearer\s+)\S+/gi, `$1${REDACTED}`);
}

function toFileInput(file: FileAnalysis, projectRoot: string): FileClassificationInput {
  return {
    relativePath: toRelativePath(file, projectRoot),
    imports: file.imports.map((item) => ({
      source: sanitizeImportValue(item.source),
      isRelative: item.isRelative,
      isBuiltin: item.isBuiltin,
      specifiers: item.specifiers.map(sanitizeImportValue)
    })),
    functions: file.functions.map(
      (fn): FunctionSignatureSummary => ({
        name: sanitizeFunctionName(fn.name),
        paramCount: fn.paramCount,
        startLine: fn.startLine,
        endLine: fn.endLine
      })
    )
  };
}

function createSkillContext(matches: SkillMatch[]): ClassificationSkillContext | null {
  const primary = matches.find((match) => match.primary);

  if (!primary) {
    return null;
  }

  return {
    id: primary.skill.id,
    name: primary.skill.name,
    separationRules: primary.skill.separation.rules
  };
}

function trimFilesToBudget(
  files: FileClassificationInput[],
  tokenBudget: number,
  skill: ClassificationSkillContext | null
): FileClassificationInput[] {
  const charBudget = tokenBudget * AVERAGE_CHARS_PER_TOKEN;
  const trimmed: FileClassificationInput[] = [];

  for (const file of files) {
    const candidate = [...trimmed, file];
    const projected = JSON.stringify({ skill, files: candidate }).length;

    if (projected <= charBudget || trimmed.length === 0) {
      trimmed.push(trimFileFunctions(file, charBudget));
    }
  }

  return trimmed;
}

function trimFileFunctions(file: FileClassificationInput, charBudget: number): FileClassificationInput {
  const functions: FunctionSignatureSummary[] = [];

  for (const fn of file.functions) {
    const candidate = { ...file, functions: [...functions, fn] };

    if (JSON.stringify(candidate).length <= charBudget || functions.length === 0) {
      functions.push(fn);
    }
  }

  return {
    ...file,
    functions
  };
}

function toRelativePath(file: FileAnalysis, projectRoot: string): string {
  if (file.relativePath && !path.isAbsolute(file.relativePath)) {
    return file.relativePath;
  }

  return path.relative(projectRoot, file.path);
}

function sanitizeImportValue(value: string): string {
  return value.replace(/sk-[A-Za-z0-9_-]+/g, REDACTED).replace(/anthropic-[A-Za-z0-9_-]+/g, REDACTED);
}

function sanitizeFunctionName(value: string): string {
  return value || '<anonymous>';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
