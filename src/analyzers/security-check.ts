import type { FileAnalysis } from '../types/analysis.js';
import type { SecurityFinding, SecuritySummary } from '../types/security.js';

const HARDCODED_SECRET_PATTERN = /(?:secret|password|api_key|apikey|api_secret|private_key|access_token)\s*[:=]\s*['"][^'"]{8,}['"]/gi;
const WEAK_JWT_FALLBACK_PATTERN = /process\.env\.(?:JWT|SECRET|TOKEN)[A-Z_]*\s*\|\|\s*['"]/g;
const WEAK_HASH_PATTERN = /createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/g;
const PRISMA_NEW_PATTERN = /new\s+PrismaClient\s*\(/g;
const QUERY_TOKEN_PATTERN = /(?:req\.query\.token|searchParams\.get\s*\(\s*['"]token['"]\s*\))/g;

const PYTHON_WEAK_HASH_PATTERN = /hashlib\.(?:md5|sha1)\s*\(/g;
const PYTHON_PICKLE_PATTERN = /pickle\.loads?\s*\(/g;
const PYTHON_EVAL_PATTERN = /(?:^|[^.\w])(?:eval|exec)\s*\(/g;

const CSHARP_WEAK_HASH_PATTERN = /(?:MD5\.Create|new\s+MD5CryptoServiceProvider|SHA1\.Create|new\s+SHA1CryptoServiceProvider)\s*\(/g;
const CSHARP_HARDCODED_KEY_PATTERN = /(?:SymmetricSecurityKey|SecurityKey)\s*\(\s*\n?\s*Encoding\.\w+\.GetBytes\s*\(\s*["'][^"']+["']\s*\)/g;
const CSHARP_HARDCODED_CONNSTR_PATTERN = /(?:ConnectionString|connectionString|UseSqlServer|UseNpgsql|UseSqlite)\s*\(\s*["'][^"']*(?:Password|Pwd)\s*=[^"']+["']\s*\)/gi;
const CSHARP_HARDCODED_CREDENTIAL_PATTERN = /new\s+NetworkCredential\s*\(\s*["'][^"']+["']\s*,\s*["'][^"']+["']\s*\)/g;

const JAVA_WEAK_HASH_PATTERN = /MessageDigest\.getInstance\s*\(\s*["'](?:MD5|SHA-1)["']\s*\)/g;
const JAVA_EXEC_PATTERN = /Runtime\.getRuntime\s*\(\s*\)\.exec\s*\(/g;
const JAVA_HARDCODED_KEY_PATTERN = /(?:SecretKeySpec|setSigningKey)\s*\(\s*["'][^"']{8,}["']/g;

const PYTHON_HARDCODED_SECRET_PATTERN = /(?:SECRET_KEY|JWT_SECRET|API_KEY|PASSWORD|DATABASE_URL)\s*=\s*['"][^'"]{8,}['"]/g;

export function analyzeSecurityPatterns(files: FileAnalysis[], sourceContents: Map<string, string>): SecuritySummary {
  const findings: SecurityFinding[] = [];

  const prismaInstantiations: { file: string; line: number }[] = [];

  for (const file of files) {
    const content = sourceContents.get(file.path);
    if (!content) continue;

    const lines = content.split('\n');
    const isPasswordRelated = /password|credential|auth|hash/i.test(file.relativePath);

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
      severity: isPasswordRelated ? 'critical' : 'warning',
      check: 'weak_hash',
      message: isPasswordRelated
        ? 'Broken crypto: MD5/SHA1 used for password hashing.'
        : 'Weak hash algorithm (MD5 or SHA1) used.',
      suggestion: 'Use SHA-256 or bcrypt for password hashing.'
    });

    scanLines(lines, file.relativePath, QUERY_TOKEN_PATTERN, findings, {
      severity: 'warning',
      check: 'token_in_query',
      message: 'Auth token extracted from query parameters.',
      suggestion: 'Use Authorization header or cookies — query params are logged in server access logs.'
    });

    scanLines(lines, file.relativePath, PYTHON_WEAK_HASH_PATTERN, findings, {
      severity: isPasswordRelated ? 'critical' : 'warning',
      check: 'weak_hash',
      message: isPasswordRelated
        ? 'Broken crypto: MD5/SHA1 used for password hashing.'
        : 'Weak hash algorithm (MD5 or SHA1) used.',
      suggestion: 'Use hashlib.sha256 or bcrypt for password hashing.'
    });

    scanLines(lines, file.relativePath, PYTHON_PICKLE_PATTERN, findings, {
      severity: 'warning',
      check: 'unsafe_deserialization',
      message: 'pickle.load on untrusted data allows arbitrary code execution.',
      suggestion: 'Use JSON or a safe serialization format for untrusted input.'
    });

    scanLines(lines, file.relativePath, PYTHON_EVAL_PATTERN, findings, {
      severity: 'critical',
      check: 'code_injection',
      message: 'eval/exec on untrusted input allows arbitrary code execution.',
      suggestion: 'Use ast.literal_eval for safe evaluation or avoid eval entirely.'
    });

    scanLines(lines, file.relativePath, CSHARP_WEAK_HASH_PATTERN, findings, {
      severity: isPasswordRelated ? 'critical' : 'warning',
      check: 'weak_hash',
      message: isPasswordRelated
        ? 'Broken crypto: MD5/SHA1 used for password hashing.'
        : 'Weak hash algorithm (MD5 or SHA1) used.',
      suggestion: 'Use SHA256, bcrypt, or PBKDF2 for password hashing.'
    });

    scanContent(content, lines, file.relativePath, CSHARP_HARDCODED_KEY_PATTERN, findings, {
      severity: 'critical',
      check: 'hardcoded_secret',
      message: 'Hardcoded signing key in source code.',
      suggestion: 'Move to environment variable or secrets manager.'
    });

    scanLines(lines, file.relativePath, CSHARP_HARDCODED_CONNSTR_PATTERN, findings, {
      severity: 'critical',
      check: 'hardcoded_secret',
      message: 'Hardcoded database password in connection string.',
      suggestion: 'Use environment variable or secrets manager for connection strings.'
    });

    scanLines(lines, file.relativePath, CSHARP_HARDCODED_CREDENTIAL_PATTERN, findings, {
      severity: 'critical',
      check: 'hardcoded_secret',
      message: 'Hardcoded credentials in NetworkCredential constructor.',
      suggestion: 'Move credentials to environment variables or secrets manager.'
    });

    scanLines(lines, file.relativePath, JAVA_WEAK_HASH_PATTERN, findings, {
      severity: isPasswordRelated ? 'critical' : 'warning',
      check: 'weak_hash',
      message: isPasswordRelated
        ? 'Broken crypto: MD5/SHA-1 used for password hashing.'
        : 'Weak hash algorithm (MD5 or SHA-1) used.',
      suggestion: 'Use MessageDigest.getInstance("SHA-256") or bcrypt.'
    });

    scanLines(lines, file.relativePath, JAVA_EXEC_PATTERN, findings, {
      severity: 'warning',
      check: 'command_injection',
      message: 'Runtime.exec with user input may allow command injection.',
      suggestion: 'Use ProcessBuilder with explicit argument list instead of string concatenation.'
    });

    scanLines(lines, file.relativePath, JAVA_HARDCODED_KEY_PATTERN, findings, {
      severity: 'critical',
      check: 'hardcoded_secret',
      message: 'Hardcoded signing/encryption key in source code.',
      suggestion: 'Move to environment variable or secrets manager.'
    });

    scanLines(lines, file.relativePath, PYTHON_HARDCODED_SECRET_PATTERN, findings, {
      severity: 'critical',
      check: 'hardcoded_secret',
      message: 'Hardcoded secret or key in source code.',
      suggestion: 'Use environment variable (os.environ) or a secrets manager.'
    });

    for (let i = 0; i < lines.length; i++) {
      if (PRISMA_NEW_PATTERN.test(lines[i]!)) {
        PRISMA_NEW_PATTERN.lastIndex = 0;
        prismaInstantiations.push({ file: file.relativePath, line: i + 1 });
      }
    }

    if (isApiRouteFile(file.relativePath)) {
      const hasAuth = detectAuthPresence(file, content);

      if (!hasAuth) {
        findings.push({
          severity: 'warning',
          check: 'missing_auth',
          file: file.relativePath,
          message: 'API route file has no authentication guard.',
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
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) continue;

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

function scanContent(
  content: string,
  lines: string[],
  relativePath: string,
  pattern: RegExp,
  findings: SecurityFinding[],
  template: FindingTemplate
): void {
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const lineNumber = content.slice(0, match.index).split('\n').length;
    findings.push({ ...template, file: relativePath, line: lineNumber });
  }
}

function detectAuthPresence(file: FileAnalysis, content: string): boolean {
  const hasAuthImport = file.imports.some(
    (imp) => /auth|session|middleware|protect|guard/i.test(imp.source) ||
      imp.specifiers.some((s) => /auth|session|protect|guard|verify/i.test(s))
  );
  if (hasAuthImport) return true;

  if (/\[Authorize\]/.test(content)) return true;
  if (/@login_required|@permission_required|@requires_auth/.test(content)) return true;
  if (/@PreAuthorize|@Secured|@RolesAllowed/.test(content)) return true;
  if (/\.UseAuthorization\(\)/.test(content)) return true;

  return false;
}

function isApiRouteFile(relativePath: string): boolean {
  if (/(?:api\/|routes\/|controllers\/)/.test(relativePath) && /route\.[jt]sx?$|controller\.[jt]sx?$/.test(relativePath)) return true;
  if (/(?:views|routes|urls)\.py$/.test(relativePath)) return true;
  if (/Controller\.cs$/.test(relativePath)) return true;
  if (/(?:Controller|Resource)\.java$/.test(relativePath)) return true;
  return false;
}
