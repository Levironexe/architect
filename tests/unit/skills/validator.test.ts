import { describe, expect, it } from 'vitest';

import { validateSkill } from '../../../src/skills/validator';

const baseSkill = {
  schema_version: '2.0.0',
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
    rules: [
      {
        concern: 'routing',
        belongs_in: 'src/routes',
        rule_text: 'Routes define endpoints and delegate downstream work.',
        example: "router.get('/users', UserController.list);"
      }
    ]
  },
  patterns: {
    naming: {
      files: 'kebab-case'
    }
  },
  anti_patterns: [
    {
      id: 'god_file',
      severity: 'critical',
      description: 'Too many concerns.',
      bad_example: "app.post('/users', async (req, res) => res.json(await db.insert(req.body)));",
      good_example: "router.post('/', UserController.create);"
    }
  ]
};

describe('validateSkill', () => {
  it('normalizes a valid YAML-shaped skill into the runtime shape', () => {
    const result = validateSkill(baseSkill, 'valid.skill.yaml');

    expect(result.skill?.schemaVersion).toBe('2.0.0');
    expect(result.skill?.structure.requiredDirs[0]?.path).toBe('src/routes');
    expect(result.skill?.separation.rules[0]?.belongsIn).toBe('src/routes');
    expect(result.skill?.separation.rules[0]?.ruleText).toContain('delegate downstream work');
    expect(result.skill?.separation.rules[0]?.example).toContain('UserController.list');
    expect(result.skill?.antiPatterns[0]?.id).toBe('god_file');
    expect(result.skill?.antiPatterns[0]?.badExample).toContain("app.post('/users'");
    expect(result.skill?.antiPatterns[0]?.goodExample).toContain('UserController.create');
    expect(result.warning).toBeUndefined();
  });

  it('rejects missing required fields', () => {
    const result = validateSkill({ ...baseSkill, schema_version: undefined }, 'missing-schema.skill.yaml');

    expect(result.skill).toBeUndefined();
    expect(result.warning?.message).toContain('schema_version');
  });

  it('rejects unsupported schema versions', () => {
    const result = validateSkill({ ...baseSkill, schema_version: '1.0.0' }, 'future.skill.yaml');

    expect(result.skill).toBeUndefined();
    expect(result.warning?.message).toContain('Unsupported schema version');
  });

  it('rejects skills missing required guidance fields', () => {
    const missingRuleText = validateSkill(
      {
        ...baseSkill,
        separation: {
          rules: [{ ...baseSkill.separation.rules[0], rule_text: undefined }]
        }
      },
      'missing-rule-text.skill.yaml'
    );
    const missingBadExample = validateSkill(
      {
        ...baseSkill,
        anti_patterns: [{ ...baseSkill.anti_patterns[0], bad_example: undefined }]
      },
      'missing-bad-example.skill.yaml'
    );

    expect(missingRuleText.skill).toBeUndefined();
    expect(missingRuleText.warning?.message).toContain('malformed');
    expect(missingBadExample.skill).toBeUndefined();
    expect(missingBadExample.warning?.message).toContain('malformed');
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
