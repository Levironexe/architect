import type { ScanResult } from '../types/analysis.js';
import type { ReportIssue } from '../types/issue.js';
import type { PlanGenerationContext, PlanPhase, PlanRisk, RefactorPlan, RefactorStep } from '../types/plan.js';
import type { SkillMatch } from '../types/skill.js';

const HIGH_LOC_THRESHOLD = 500;

export function generateRefactorPlan(context: PlanGenerationContext): RefactorPlan {
  const { scan, primarySkill } = context;
  const steps: RefactorStep[] = [];

  addStructureSteps(steps, scan);
  addOversizedFileSteps(steps, scan);
  addDuplicationSteps(steps, scan);
  addDependencySteps(steps, scan);
  addConcernSteps(steps, scan);

  if (steps.length === 0) {
    steps.push(createStep(steps, {
      action: 'consolidate',
      sourceFile: scan.files[0]?.relativePath ?? null,
      targetFile: scan.files[0]?.relativePath ?? 'project root',
      what: 'Keep the current structure and document the conventions that are already working.',
      why: 'No critical structural issues were found, so a lightweight maintenance roadmap is safer than broad refactoring.',
      importsToUpdate: [],
      dependencyNotes: 'None; maintenance step does not require import changes.',
      risk: 'low',
      confidence: 'high'
    }));
  }

  const phases = buildPhases(steps);
  const issueCount = scan.issues?.length ?? 0;

  return {
    summary: buildSummary(scan, primarySkill, steps.length),
    estimatedComplexity: estimateComplexity(scan, steps.length),
    estimatedRisk: estimateRisk(scan),
    phases,
    validationFindings: [],
    assumptions: buildAssumptions(scan, primarySkill),
    source: {
      targetDir: scan.summary.targetDir,
      primarySkillId: primarySkill?.skill.id ?? null,
      healthLabel: scan.health?.label ?? 'unavailable',
      issueCount
    }
  };
}

function addStructureSteps(steps: RefactorStep[], scan: ScanResult): void {
  const missingEntries = scan.structureComparison?.entries.filter((entry) => entry.status === 'missing') ?? [];

  for (const entry of missingEntries.slice(0, 4)) {
    steps.push(createStep(steps, {
      action: 'create_dir',
      sourceFile: null,
      targetFile: entry.path,
      what: `Create ${entry.required ? 'required' : 'recommended'} architecture directory for ${trimTrailingPeriod(entry.purpose)}.`,
      why: 'The detected architecture skill expects this structure and the scan found it missing.',
      importsToUpdate: [],
      dependencyNotes: 'None until code is moved into the new directory.',
      risk: 'low',
      confidence: 'high'
    }));
  }
}

function addOversizedFileSteps(steps: RefactorStep[], scan: ScanResult): void {
  const oversizedFiles = [...scan.files]
    .filter((file) => file.isOversized || file.hasCriticalComplexity || file.loc >= HIGH_LOC_THRESHOLD)
    .sort((a, b) => b.loc - a.loc);

  for (const file of oversizedFiles.slice(0, 4)) {
    const criticalFunction = file.functions.find((fn) => fn.isFlagged);
    steps.push(createStep(steps, {
      action: 'extract',
      sourceFile: file.relativePath,
      targetFile: suggestTargetForFile(scan, file.relativePath),
      what: criticalFunction
        ? `Extract ${criticalFunction.name} and related logic from ${file.relativePath}.`
        : `Split high-volume responsibilities out of ${file.relativePath}.`,
      why: `${file.relativePath} is a structural hotspot with ${file.loc} LOC${criticalFunction ? ` and critical function complexity ${criticalFunction.complexity}` : ''}.`,
      lineRange: criticalFunction ? `${criticalFunction.startLine}-${criticalFunction.endLine}` : null,
      importsToUpdate: dependentFiles(scan, file.relativePath),
      dependencyNotes: dependencyNoteFor(scan, file.relativePath),
      risk: file.loc >= HIGH_LOC_THRESHOLD ? 'high' : 'medium',
      confidence: 'high'
    }));
  }
}

function addDuplicationSteps(steps: RefactorStep[], scan: ScanResult): void {
  for (const finding of scan.duplication.findings.slice(0, 3)) {
    const first = finding.occurrences[0];
    if (!first) continue;

    steps.push(createStep(steps, {
      action: 'consolidate',
      sourceFile: first.relativePath,
      targetFile: 'src/shared',
      what: `Consolidate duplicate block shared by ${finding.occurrences.map((item) => item.relativePath).join(', ')}.`,
      why: `The scan found ${finding.duplicatedLines} duplicated lines that should move behind one reusable abstraction.`,
      lineRange: `${first.startLine}-${first.endLine}`,
      importsToUpdate: unique(finding.occurrences.map((item) => item.relativePath)),
      dependencyNotes: 'Update each duplicate occurrence to import the shared abstraction after consolidation.',
      risk: finding.occurrences.length > 2 ? 'medium' : 'low',
      confidence: 'medium'
    }));
  }
}

function addDependencySteps(steps: RefactorStep[], scan: ScanResult): void {
  for (const hotspot of scan.dependencyGraph.hotspots.slice(0, 3)) {
    steps.push(createStep(steps, {
      action: 'extract',
      sourceFile: hotspot.relativePath,
      targetFile: suggestTargetForFile(scan, hotspot.relativePath),
      what: `Extract stable contracts from dependency hotspot ${hotspot.relativePath}.`,
      why: `${hotspot.relativePath} is imported by ${hotspot.dependentCount} files, so changes there have broad blast radius.`,
      importsToUpdate: dependentFiles(scan, hotspot.relativePath),
      dependencyNotes: dependencyNoteFor(scan, hotspot.relativePath),
      risk: 'high',
      confidence: 'high'
    }));
  }

  for (const cycle of scan.dependencyGraph.circularDependencies.slice(0, 2)) {
    const first = cycle.files[0] ?? null;
    steps.push(createStep(steps, {
      action: 'move',
      sourceFile: first,
      targetFile: 'src/shared',
      what: `Break circular dependency ${cycle.files.join(' -> ')} by moving shared logic behind a lower-level module.`,
      why: 'Circular dependencies make refactors fragile and can produce runtime initialization bugs.',
      importsToUpdate: unique(cycle.files),
      dependencyNotes: 'Update both sides of the cycle so higher-level modules depend on the extracted shared module.',
      risk: 'high',
      confidence: 'medium'
    }));
  }
}

function addConcernSteps(steps: RefactorStep[], scan: ScanResult): void {
  const misplaced = (scan.classifications ?? [])
    .flatMap((classification) =>
      classification.functions
        .filter((fn) => fn.isMisplaced)
        .map((fn) => ({
          file: classification.file,
          name: fn.name,
          concern: fn.concern,
          reason: fn.reason
        }))
    )
    .slice(0, 4);

  for (const item of misplaced) {
    steps.push(createStep(steps, {
      action: 'move',
      sourceFile: item.file,
      targetFile: concernTarget(item.concern),
      what: `Move ${item.name} ${item.reason ? `(${item.reason})` : `to the ${item.concern} layer`}.`,
      why: 'Concern classification flagged this function as misplaced relative to the detected architecture rules.',
      importsToUpdate: dependentFiles(scan, item.file),
      dependencyNotes: dependencyNoteFor(scan, item.file),
      risk: 'medium',
      confidence: 'medium'
    }));
  }
}

function createStep(steps: RefactorStep[], input: Omit<RefactorStep, 'stepNumber' | 'lineRange' | 'confidence'> & Partial<Pick<RefactorStep, 'lineRange' | 'confidence'>>): RefactorStep {
  return {
    stepNumber: steps.length + 1,
    action: input.action,
    sourceFile: input.sourceFile,
    targetFile: input.targetFile,
    what: input.what,
    why: input.why,
    lineRange: input.lineRange ?? null,
    importsToUpdate: unique(input.importsToUpdate),
    dependencyNotes: input.dependencyNotes,
    risk: input.risk,
    confidence: input.confidence ?? 'medium'
  };
}

function buildPhases(steps: RefactorStep[]): PlanPhase[] {
  const foundation = steps.filter((step) => step.action === 'create_dir');
  const foundationIds = new Set(foundation.map((step) => step.stepNumber));
  const extraction = steps.filter((step) => !foundationIds.has(step.stepNumber) && (step.action === 'extract' || step.action === 'consolidate'));
  const extractionIds = new Set(extraction.map((step) => step.stepNumber));
  const dependency = steps.filter((step) => !foundationIds.has(step.stepNumber) && !extractionIds.has(step.stepNumber) && (step.action === 'move' || step.risk === 'high'));
  const used = new Set([...foundation, ...extraction, ...dependency].map((step) => step.stepNumber));
  const remaining = steps.filter((step) => !used.has(step.stepNumber));
  const phases: PlanPhase[] = [];

  if (foundation.length > 0) {
    phases.push({ name: 'Prepare target structure', description: 'Create missing architectural destinations before moving code.', steps: foundation });
  }

  if (extraction.length > 0) {
    phases.push({ name: 'Reduce structural hotspots', description: 'Extract and consolidate the highest-impact files first.', steps: extraction });
  }

  if (dependency.length > 0) {
    phases.push({ name: 'Stabilize dependencies', description: 'Handle dependency hotspots and cycles with explicit import updates.', steps: dependency });
  }

  if (remaining.length > 0 || phases.length === 0) {
    phases.push({ name: 'Maintain architecture', description: 'Keep the project healthy with low-risk follow-up work.', steps: remaining.length > 0 ? remaining : steps });
  }

  return phases.map((phase) => ({
    ...phase,
    steps: uniqueByStepNumber(phase.steps).sort((a, b) => a.stepNumber - b.stepNumber)
  })).filter((phase) => phase.steps.length > 0);
}

function buildSummary(scan: ScanResult, primarySkill: SkillMatch | null, stepCount: number): string {
  const skillText = primarySkill ? ` toward ${primarySkill.skill.name}` : '';
  return `Refactor ${scan.summary.totalFiles} analyzed file(s)${skillText} through ${stepCount} ordered step(s).`;
}

function buildAssumptions(scan: ScanResult, primarySkill: SkillMatch | null): string[] {
  const assumptions = ['Plan is generated from the current scan result and does not modify source files.'];

  if (primarySkill) {
    assumptions.push(`Primary architecture skill is ${primarySkill.skill.name} with ${primarySkill.confidence} confidence.`);
  } else {
    assumptions.push('No confident primary architecture skill was detected; stack-specific rules are not invented.');
  }

  if (scan.parseErrors.length > 0) {
    assumptions.push(`${scan.parseErrors.length} file(s) could not be parsed, so dependency and duplication guidance may be partial.`);
  }

  return assumptions;
}

function estimateComplexity(scan: ScanResult, stepCount: number): 'low' | 'medium' | 'high' {
  if (stepCount >= 8 || scan.summary.flaggedFiles >= 3 || scan.summary.duplicateFindings >= 3) return 'high';
  if (stepCount >= 4 || scan.summary.flaggedFiles > 0 || scan.summary.duplicateFindings > 0) return 'medium';
  return 'low';
}

function estimateRisk(scan: ScanResult): PlanRisk {
  if (scan.summary.circularDependencies > 0 || scan.summary.dependencyHotspots >= 2) return 'high';
  if (scan.summary.dependencyHotspots > 0 || scan.parseErrors.length > 0) return 'medium';
  return 'low';
}

function suggestTargetForFile(scan: ScanResult, relativePath: string): string {
  const required = scan.structureComparison?.entries.find((entry) => entry.status === 'missing' && entry.required);
  if (required) return required.path;
  if (relativePath.includes('/')) return relativePath.split('/').slice(0, -1).join('/');
  return 'src';
}

function concernTarget(concern: string): string {
  const targets: Record<string, string> = {
    routing: 'src/routes',
    business_logic: 'src/services',
    data_access: 'src/repositories',
    validation: 'src/validation',
    middleware: 'src/middleware',
    ui_component: 'src/components',
    utility: 'src/utils',
    configuration: 'src/config'
  };

  return targets[concern] ?? 'src/shared';
}

function dependentFiles(scan: ScanResult, relativePath: string): string[] {
  return scan.dependencyGraph.nodes.find((node) => node.relativePath === relativePath)?.importedBy ?? [];
}

function dependencyNoteFor(scan: ScanResult, relativePath: string): string {
  const dependents = dependentFiles(scan, relativePath);
  if (dependents.length === 0) return 'No known import updates from the dependency graph.';
  return `Update imports in ${dependents.join(', ')}.`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function uniqueByStepNumber(steps: RefactorStep[]): RefactorStep[] {
  const seen = new Set<number>();
  return steps.filter((step) => {
    if (seen.has(step.stepNumber)) return false;
    seen.add(step.stepNumber);
    return true;
  });
}

function trimTrailingPeriod(value: string): string {
  return value.replace(/\.+$/, '');
}

export function primarySkillFrom(scan: ScanResult): SkillMatch | null {
  return scan.matchedSkills?.find((match) => match.primary) ?? null;
}

export function issuesBySeverity(scan: ScanResult): ReportIssue[] {
  const rank = { critical: 0, warning: 1, info: 2 };
  return [...(scan.issues ?? [])].sort((a, b) => rank[a.severity] - rank[b.severity]);
}
