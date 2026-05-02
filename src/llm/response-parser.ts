import type {
  ConcernClassification,
  ConcernType,
  FileClassificationInput,
  FunctionConcernClassification
} from '../types/concern.js';
import { isConcernType } from '../types/concern.js';

interface RawClassificationResponse {
  files?: RawFileClassification[];
}

interface RawFileClassification {
  file?: unknown;
  functions?: RawFunctionClassification[];
}

interface RawFunctionClassification {
  name?: unknown;
  concern?: unknown;
  confidence?: unknown;
  isMisplaced?: unknown;
  reason?: unknown;
}

export interface ParsedConcernClassifications {
  classifications: ConcernClassification[];
  warnings: string[];
}

export function parseConcernClassifications(rawResponse: string, inputs: FileClassificationInput[]): ParsedConcernClassifications {
  const warnings: string[] = [];
  const parsed = parseJson(rawResponse, warnings);

  if (!parsed) {
    return {
      classifications: inputs.map((input) => createUnclassifiedFile(input, ['Provider returned invalid JSON.'])),
      warnings
    };
  }

  const files = Array.isArray(parsed.files) ? parsed.files : [];

  if (files.length === 0) {
    warnings.push('Provider response did not include any file classifications.');
  }

  const classifications = inputs.map((input) => {
    const rawFile = files.find((item) => item.file === input.relativePath);
    return rawFile ? normalizeFileClassification(input, rawFile, warnings) : createUnclassifiedFile(input, ['No classification returned for file.']);
  });

  return { classifications, warnings };
}

function parseJson(rawResponse: string, warnings: string[]): RawClassificationResponse | null {
  const jsonText = extractJson(rawResponse);

  try {
    return JSON.parse(jsonText) as RawClassificationResponse;
  } catch {
    warnings.push('Provider returned invalid JSON.');
    return null;
  }
}

function extractJson(rawResponse: string): string {
  const trimmed = rawResponse.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function normalizeFileClassification(
  input: FileClassificationInput,
  rawFile: RawFileClassification,
  warnings: string[]
): ConcernClassification {
  const fileWarnings: string[] = [];
  const rawFunctions = Array.isArray(rawFile.functions) ? rawFile.functions : [];
  const functions = input.functions.map((fn): FunctionConcernClassification => {
    const rawFunction = rawFunctions.find((item) => item.name === fn.name);

    if (!rawFunction) {
      fileWarnings.push(`No classification returned for ${fn.name}.`);
      return createUnclassifiedFunction(fn.name, 'No classification returned.');
    }

    return normalizeFunctionClassification(fn.name, rawFunction, fileWarnings);
  });

  if (fileWarnings.length > 0) {
    warnings.push(`${input.relativePath}: ${fileWarnings.join(' ')}`);
  }

  return {
    file: input.relativePath,
    functions,
    dominantConcern: calculateDominantConcern(functions),
    mixedConcerns: calculateMixedConcerns(functions),
    warnings: fileWarnings
  };
}

function normalizeFunctionClassification(
  name: string,
  rawFunction: RawFunctionClassification,
  warnings: string[]
): FunctionConcernClassification {
  const concern = normalizeConcern(rawFunction.concern);

  if (concern === 'unclassified' && rawFunction.concern !== 'unclassified') {
    warnings.push(`Unknown concern for ${name}.`);
  }

  return {
    name,
    concern,
    confidence: normalizeConfidence(rawFunction.confidence),
    isMisplaced: rawFunction.isMisplaced === true,
    reason: typeof rawFunction.reason === 'string' ? rawFunction.reason : undefined
  };
}

function createUnclassifiedFile(input: FileClassificationInput, warnings: string[]): ConcernClassification {
  return {
    file: input.relativePath,
    functions: input.functions.map((fn) => createUnclassifiedFunction(fn.name, warnings[0])),
    dominantConcern: 'unclassified',
    mixedConcerns: false,
    warnings
  };
}

function createUnclassifiedFunction(name: string, reason?: string): FunctionConcernClassification {
  return {
    name,
    concern: 'unclassified',
    confidence: 0,
    isMisplaced: false,
    reason
  };
}

function normalizeConcern(value: unknown): ConcernType {
  if (typeof value !== 'string') {
    return 'unclassified';
  }

  return isConcernType(value) ? value : 'unclassified';
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function calculateDominantConcern(functions: FunctionConcernClassification[]): ConcernType {
  const counts = new Map<ConcernType, number>();

  for (const fn of functions) {
    counts.set(fn.concern, (counts.get(fn.concern) ?? 0) + 1);
  }

  let dominant: ConcernType = 'unclassified';
  let max = 0;

  for (const [concern, count] of counts.entries()) {
    if (concern !== 'unclassified' && count > max) {
      dominant = concern;
      max = count;
    }
  }

  return dominant;
}

function calculateMixedConcerns(functions: FunctionConcernClassification[]): boolean {
  const concerns = new Set(functions.map((fn) => fn.concern).filter((concern) => concern !== 'unclassified'));
  return concerns.size >= 3;
}
