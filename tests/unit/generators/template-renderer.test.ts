import { describe, expect, it } from 'vitest';

import { render } from '../../../src/generators/templateRenderer';
import type { TemplateContext } from '../../../src/types/generation';

const templateContext: TemplateContext = {
  skill: {
    id: 'express-api',
    name: 'Express.js REST API',
    structure: {
      required: '- src/routes: Route definitions\n- src/services: Business logic'
    },
    separation: {
      data_flow: 'Route -> Controller -> Service -> Model',
      rules: '- routing -> src/routes'
    },
    anti_patterns: '- god_file'
  },
  analysis: {
    largestFiles: '- server.ts (420 LOC)',
    hubFiles: '- src/shared/db.ts (depended on by 4 files)',
    duplicationPercent: '18.2%',
    missingDirs: '- src/routes\n- src/services'
  }
};

describe('render', () => {
  it('replaces nested template tokens with context values', () => {
    const result = render(
      'Stack: {{skill.name}}\nFlow: {{skill.separation.data_flow}}\nDuplication: {{analysis.duplicationPercent}}',
      templateContext
    );

    expect(result).toContain('Stack: Express.js REST API');
    expect(result).toContain('Flow: Route -> Controller -> Service -> Model');
    expect(result).toContain('Duplication: 18.2%');
  });

  it('renders missing values as empty strings instead of throwing', () => {
    const result = render('Unknown: {{analysis.notThere}} | Missing root: {{missing.value}}', templateContext);

    expect(result).toBe('Unknown:  | Missing root: ');
  });
});