import { describe, expect, it } from 'vitest';

import { validateSkill } from '../../../src/skills/validator';

const baseSkill = {
  schema_version: '1.0.0',
  id: 'valid',
  name: 'Valid Skill',
  version: '1.0.0',
  description: 'A valid skill.',
  category: 'stack',
  language: 'javascript',
  frameworks: ['valid'],
  detection: {
    dependencies: {
      any: ['valid']
    }
  },
  structure: {
    required_dirs: [{ path: 'src/routes', purpose: 'Routes.' }],
    recommended_dirs: []
  },
  separation: {
    rules: [{ concern: 'routing', belongs_in: 'src/routes' }]
  },
  patterns: {
    naming: {
      files: 'kebab-case'
    }
  },
  anti_patterns: [{ id: 'god_file', severity: 'critical', description: 'Too many concerns.' }]
};

describe('validateSkill', () => {
  it('normalizes a valid YAML-shaped skill into the runtime shape', () => {
    const result = validateSkill(baseSkill, 'valid.skill.yaml');

    expect(result.skill?.schemaVersion).toBe('1.0.0');
    expect(result.skill?.structure.requiredDirs[0]?.path).toBe('src/routes');
    expect(result.skill?.separation.rules[0]?.belongsIn).toBe('src/routes');
    expect(result.skill?.antiPatterns[0]?.id).toBe('god_file');
    expect(result.warning).toBeUndefined();
  });

  it('rejects missing required fields', () => {
    const result = validateSkill({ ...baseSkill, schema_version: undefined }, 'missing-schema.skill.yaml');

    expect(result.skill).toBeUndefined();
    expect(result.warning?.message).toContain('schema_version');
  });

  it('rejects unsupported schema versions', () => {
    const result = validateSkill({ ...baseSkill, schema_version: '2.0.0' }, 'future.skill.yaml');

    expect(result.skill).toBeUndefined();
    expect(result.warning?.message).toContain('Unsupported schema version');
  });

  it('rejects invalid categories and executable-looking sections', () => {
    const invalidCategory = validateSkill({ ...baseSkill, category: 'agent' }, 'category.skill.yaml');
    const executable = validateSkill({ ...baseSkill, command: 'rm -rf .' }, 'command.skill.yaml');

    expect(invalidCategory.skill).toBeUndefined();
    expect(invalidCategory.warning?.message).toContain('category');
    expect(executable.skill).toBeUndefined();
    expect(executable.warning?.message).toContain('Unsupported top-level field');
  });
});
