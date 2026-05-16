export interface TemplateContext {
  skill: {
    id: string;
    name: string;
    structure: {
      required: string;
    };
    separation: {
      data_flow: string;
      rules: string;
    };
    anti_patterns: string;
  };
  analysis: {
    largestFiles: string;
    hubFiles: string;
    duplicationPercent: string;
    missingDirs: string;
  };
}

export interface RenderedSkillFile {
  name: string;
  content: string;
}

export interface InitSummary {
  targetDir: string;
  skillId: string;
  integration: string;
  filesWritten: string[];
  filesSkipped: string[];
  warnings: string[];
}