import { SUPPORTED_SKILL_SCHEMA_VERSION, type ArchitectureSkill, type AntiPattern, type DetectionRules, type PatternRules, type SeparationRule, type SkillCategory, type SkillWarning, type StructureEntry } from '../types/skill.js';

const ALLOWED_TOP_LEVEL_FIELDS = new Set([
  'schema_version',
  'id',
  'name',
  'version',
  'description',
  'category',
  'language',
  'frameworks',
  'dependencies',
  'detection',
  'structure',
  'separation',
  'patterns',
  'anti_patterns'
]);

const SKILL_CATEGORIES = new Set<SkillCategory>(['stack', 'pattern', 'meta']);
const SEVERITIES = new Set(['info', 'warning', 'critical']);

export interface SkillValidationResult {
  skill?: ArchitectureSkill;
  warning?: SkillWarning;
}

export function validateSkill(value: unknown, file: string): SkillValidationResult {
  if (!isRecord(value)) {
    return invalid(file, 'Skill must be a YAML object');
  }

  for (const field of Object.keys(value)) {
    if (!ALLOWED_TOP_LEVEL_FIELDS.has(field)) {
      return invalid(file, `Unsupported top-level field: ${field}`);
    }
  }

  const schemaVersion = readString(value, 'schema_version');
  if (!schemaVersion) {
    return invalid(file, 'Missing required field: schema_version');
  }

  if (schemaVersion !== SUPPORTED_SKILL_SCHEMA_VERSION) {
    return invalid(file, `Unsupported schema version: ${schemaVersion}`);
  }

  const id = readString(value, 'id');
  const name = readString(value, 'name');
  const version = readString(value, 'version');
  const description = readString(value, 'description');
  const category = readString(value, 'category');
  const language = readString(value, 'language');

  if (!id || !name || !version || !description || !category || !language) {
    const missingField = Object.entries({ id, name, version, description, category, language }).find(([, fieldValue]) => !fieldValue)?.[0] ?? 'unknown';
    return invalid(file, `Missing required field: ${missingField}`);
  }

  if (!SKILL_CATEGORIES.has(category as SkillCategory)) {
    return invalid(file, `Invalid category: ${category}`);
  }

  const frameworks = readStringArray(value.frameworks);
  const detection = parseDetection(value.detection);
  const structure = parseStructure(value.structure);
  const separation = parseSeparation(value.separation);
  const patterns = parsePatterns(value.patterns);
  const antiPatterns = parseAntiPatterns(value.anti_patterns);

  if (!frameworks || !detection || !structure || !separation || !patterns || !antiPatterns) {
    return invalid(file, 'Skill fields are malformed');
  }

  return {
    skill: {
      schemaVersion,
      id,
      name,
      version,
      description,
      category: category as SkillCategory,
      language,
      frameworks,
      detection,
      structure,
      separation,
      patterns,
      antiPatterns
    }
  };
}

function parseDetection(value: unknown): DetectionRules | null {
  if (!isRecord(value)) {
    return null;
  }

  const detection: DetectionRules = {};

  if (value.dependencies !== undefined) {
    if (!isRecord(value.dependencies)) {
      return null;
    }

    const any = value.dependencies.any === undefined ? undefined : readStringArray(value.dependencies.any);
    const all = value.dependencies.all === undefined ? undefined : readStringArray(value.dependencies.all);
    const none = value.dependencies.none === undefined ? undefined : readStringArray(value.dependencies.none);

    if (any === null || all === null || none === null) {
      return null;
    }

    detection.dependencies = { any, all, none };
  }

  const files = value.files === undefined ? undefined : readStringArray(value.files);
  const sourceIndicators = value.source_indicators === undefined ? undefined : readStringArray(value.source_indicators);

  if (files === null || sourceIndicators === null) {
    return null;
  }

  detection.files = files;
  detection.sourceIndicators = sourceIndicators;
  return detection;
}

function parseStructure(value: unknown): ArchitectureSkill['structure'] | null {
  if (!isRecord(value)) {
    return null;
  }

  const requiredDirs = parseStructureEntries(value.required_dirs);
  const recommendedDirs = parseStructureEntries(value.recommended_dirs);

  return requiredDirs && recommendedDirs ? { requiredDirs, recommendedDirs } : null;
}

function parseStructureEntries(value: unknown): StructureEntry[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const entries: StructureEntry[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }

    const entryPath = readString(item, 'path');
    const purpose = readString(item, 'purpose');

    if (!entryPath || !purpose || entryPath.startsWith('/') || entryPath.includes('..')) {
      return null;
    }

    entries.push({ path: entryPath, purpose });
  }

  return entries;
}

function parseSeparation(value: unknown): ArchitectureSkill['separation'] | null {
  if (!isRecord(value) || !Array.isArray(value.rules)) {
    return null;
  }

  const rules: SeparationRule[] = [];

  for (const item of value.rules) {
    if (!isRecord(item)) {
      return null;
    }

    const concern = readString(item, 'concern');
    const belongsIn = readString(item, 'belongs_in');
    const ruleText = readString(item, 'rule_text');
    const example = readString(item, 'example');
    const indicators = item.indicators === undefined ? undefined : readStringArray(item.indicators);
    const antiIndicators = item.anti_indicators === undefined ? undefined : readStringArray(item.anti_indicators);

    if (!concern || !belongsIn || !ruleText || !example || indicators === null || antiIndicators === null) {
      return null;
    }

    rules.push({ concern, belongsIn, ruleText, example, indicators, antiIndicators });
  }

  return { rules };
}

function parsePatterns(value: unknown): PatternRules | null {
  if (!isRecord(value)) {
    return null;
  }

  const patterns: PatternRules = {};

  if (value.naming !== undefined) {
    if (!isRecord(value.naming)) {
      return null;
    }
    patterns.naming = readStringRecord(value.naming);
  }

  if (value.error_handling !== undefined) {
    if (!isRecord(value.error_handling)) {
      return null;
    }
    const recommended = readString(value.error_handling, 'recommended');
    if (!recommended) {
      return null;
    }
    patterns.errorHandling = { recommended };
  }

  if (value.data_flow !== undefined) {
    if (!isRecord(value.data_flow)) {
      return null;
    }
    const direction = readString(value.data_flow, 'direction');
    const rules = readStringArray(value.data_flow.rules);
    if (!direction || !rules) {
      return null;
    }
    patterns.dataFlow = { direction, rules };
  }

  return patterns;
}

function parseAntiPatterns(value: unknown): AntiPattern[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const antiPatterns: AntiPattern[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }

    const id = readString(item, 'id');
    const severity = readString(item, 'severity');
    const description = readString(item, 'description');
    const badExample = readString(item, 'bad_example');
    const goodExample = readString(item, 'good_example');

    if (!id || !severity || !description || !badExample || !goodExample || !SEVERITIES.has(severity)) {
      return null;
    }

    antiPatterns.push({
      id,
      severity: severity as AntiPattern['severity'],
      description,
      badExample,
      goodExample
    });
  }

  return antiPatterns;
}

function readStringRecord(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function readString(value: Record<string, unknown>, field: string): string | null {
  const fieldValue = value[field];
  return typeof fieldValue === 'string' && fieldValue.trim().length > 0 ? fieldValue : null;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.trim().length > 0)) {
    return null;
  }

  return value;
}

function invalid(file: string, message: string): SkillValidationResult {
  return { warning: { file, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
