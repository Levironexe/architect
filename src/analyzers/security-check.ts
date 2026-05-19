import type { FileAnalysis } from '../types/analysis.js';
import type { SecurityFinding, SecuritySummary } from '../types/security.js';

const HARDCODED_SECRET_PATTERN = /(?:secret|password|api_key|apikey|api_secret|private_key|access_token)\s*[:=]\s*['"][^'"]{8,}['"]/gi;
const WEAK_JWT_FALLBACK_PATTERN = /process\.env\.(?:JWT|SECRET|TOKEN)[A-Z_]*\s*\|\|\s*['"]/g;
const WEAK_HASH_PATTERN = /createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/g;
const PRISMA_NEW_PATTERN = /new\s+PrismaClient\s*\(/g;
const QUERY_TOKEN_PATTERN = /(?:req\.query\.token|searchParams\.get\s*\(\s*['"]token['"]\s*\))/g;

export function analyzeSecurityPatterns(files: FileAnalysis[], sourceContents: Map<string, string>): SecuritySummary {
  const findings: SecurityFinding[] = [];

  const prismaInstantiations: { file: string; line: number }[] = [];

  for (const file of files) {
    const content = sourceContents.get(file.path);
    if (!content) continue;

    const lines = content.split('\n');

    scanLines(lines, file.relativePath, HARDCODED_SECRET_PATTERN, findings, {
      severity: 'critical',
      check: 'hardcoded_secret',
      message: 'Hardcoded secret or API key detected.',
      suggestion: 'Move to environment variable and read from a centralized config module.'
    });

    scanLines(lines, file.relativePath, WEAK_JWT_FALLBACK_PATTERN, findings, {
      severity: 'critical',
      check: 'weak_jwt_fallback',
      message: 'JWT/secret env var has a hardcoded string fallback.',
      suggestion: 'Remove the fallback — fail loudly if the env var is missing.'
    });

    scanLines(lines, file.relativePath, WEAK_HASH_PATTERN, findings, {
      severity: 'warning',
      check: 'weak_hash',
      message: 'Weak hash algorithm (MD5 or SHA1) used.',
      suggestion: 'Use SHA-256 or bcrypt for password hashing.'
    });

    scanLines(lines, file.relativePath, QUERY_TOKEN_PATTERN, findings, {
      severity: 'warning',
      check: 'token_in_query',
      message: 'Auth token extracted from query parameters.',
      suggestion: 'Use Authorization header or cookies — query params are logged in server access logs.'
    });

    for (let i = 0; i < lines.length; i++) {
      if (PRISMA_NEW_PATTERN.test(lines[i]!)) {
        PRISMA_NEW_PATTERN.lastIndex = 0;
        prismaInstantiations.push({ file: file.relativePath, line: i + 1 });
      }
    }

    if (isApiRouteFile(file.relativePath)) {
      const hasAuthImport = file.imports.some(
        (imp) => /auth|session|middleware|protect|guard/i.test(imp.source) ||
          imp.specifiers.some((s) => /auth|session|protect|guard|verify/i.test(s))
      );

      if (!hasAuthImport) {
        findings.push({
          severity: 'warning',
          check: 'missing_auth',
          file: file.relativePath,
          message: 'API route has no auth/session import.',
          suggestion: 'Add authentication middleware or guard to protect user data endpoints.'
        });
      }
    }
  }

  if (prismaInstantiations.length > 1) {
    for (const inst of prismaInstantiations) {
      findings.push({
        severity: 'info',
        check: 'prisma_multiple_instances',
        file: inst.file,
        line: inst.line,
        message: `PrismaClient instantiated here (${prismaInstantiations.length} total across project).`,
        suggestion: 'Use a singleton in src/lib/db.ts — multiple instances exhaust connection pools.'
      });
    }
  }

  return {
    findings,
    criticalCount: findings.filter((f) => f.severity === 'critical').length,
    warningCount: findings.filter((f) => f.severity === 'warning').length,
    infoCount: findings.filter((f) => f.severity === 'info').length,
  };
}

interface FindingTemplate {
  severity: SecurityFinding['severity'];
  check: string;
  message: string;
  suggestion: string;
}

function scanLines(
  lines: string[],
  relativePath: string,
  pattern: RegExp,
  findings: SecurityFinding[],
  template: FindingTemplate
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;

    pattern.lastIndex = 0;
    if (pattern.test(line)) {
      findings.push({
        ...template,
        file: relativePath,
        line: i + 1,
      });
    }
  }
}

function isApiRouteFile(relativePath: string): boolean {
  return /(?:api\/|routes\/|controllers\/)/.test(relativePath) && /route\.[jt]sx?$|controller\.[jt]sx?$/.test(relativePath);
}
