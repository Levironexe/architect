import type { FileAnalysis } from '../types/analysis.js';
import type { ClassificationStatus, ConcernClassification } from '../types/concern.js';
import type { SkillMatch } from '../types/skill.js';
import { buildClassificationPrompt, createClassificationRequest } from './prompt-builder.js';
import { resolveLLMProvider, type ResolveProviderOptions } from './config.js';
import { parseConcernClassifications } from './response-parser.js';

export interface ConcernClassificationResult {
  classifications: ConcernClassification[];
  status: ClassificationStatus;
}

export interface ClassifyConcernsOptions extends ResolveProviderOptions {
  projectRoot: string;
  files: FileAnalysis[];
  matchedSkills?: SkillMatch[];
  tokenBudget?: number;
}

export async function classifyConcerns(options: ClassifyConcernsOptions): Promise<ConcernClassificationResult> {
  const resolution = resolveLLMProvider(options);
  const warnings = [...resolution.config.warnings];
  const filesWithFunctions = options.files.filter((file) => file.functions.length > 0);

  if (filesWithFunctions.length === 0) {
    return {
      classifications: [],
      status: {
        mode: 'skipped',
        reason: 'No functions were found to classify.',
        warnings
      }
    };
  }

  if (!resolution.provider || !resolution.config.isAvailable) {
    return {
      classifications: [],
      status: {
        mode: 'skipped',
        reason: resolution.config.warnings[0] ?? 'No AI provider configured.',
        warnings
      }
    };
  }

  try {
    const request = createClassificationRequest({
      projectRoot: options.projectRoot,
      files: filesWithFunctions,
      matchedSkills: options.matchedSkills ?? [],
      tokenBudget: options.tokenBudget
    });
    const prompt = buildClassificationPrompt(request);
    const rawResponse = await resolution.provider.analyze(prompt);
    const parsed = parseConcernClassifications(rawResponse, request.files);
    const mode = parsed.warnings.length > 0 ? 'partial' : 'completed';

    return {
      classifications: parsed.classifications,
      status: {
        mode,
        provider: resolution.provider.name,
        reason: mode === 'partial' ? 'Some classification entries were invalid or incomplete.' : undefined,
        warnings: [...warnings, ...parsed.warnings]
      }
    };
  } catch (error) {
    return {
      classifications: [],
      status: {
        mode: 'failed',
        provider: resolution.provider.name,
        reason: error instanceof Error ? error.message : 'AI provider failed during concern classification.',
        warnings
      }
    };
  }
}
