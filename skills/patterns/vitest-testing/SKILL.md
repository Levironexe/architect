---
schema_version: "2.0.0"
id: vitest-testing
name: "Vitest"
version: "2.0.0"
description: "Unit and integration testing with Vitest  -  native ESM, vi.mock() module replacement, coverage thresholds, async assertion patterns, and test behavior verification over implementation details."
category: pattern
language: javascript
frameworks:
  - vitest
dependencies:
  none:
    - jest
    - "@jest/globals"
detection:
  dependencies:
    any:
      - vitest
  source_indicators:
    - "from 'vitest'"
    - "vi.fn("
    - "vi.mock("
    - "describe("
    - "vi.spyOn("
structure:
  required_dirs:
    - path: src/__tests__
      purpose: "Unit tests co-located near source  -  mirrors the src/ structure. Test files are named [filename].test.ts where [filename] matches the source file they cover. E.g., src/services/user.service.ts → src/__tests__/services/user.service.test.ts. This makes it immediately obvious which tests cover which source file."
  recommended_dirs:
    - path: tests/integration
      purpose: "Integration tests that span multiple modules or require a real database connection. Use a test database (test schema or separate DB) isolated from development data. Do not mock the database in integration tests  -  the point is to test the full stack together."
    - path: tests/fixtures
      purpose: "Shared test factories, mock data objects, and test utilities imported by multiple test files. Examples: createTestUser() factory for Prisma, mockHttpServer using MSW for API mocking, shared vitest setup files that configure global mocks."
separation:
  rules:
    - concern: unit_test_location
      belongs_in: src/__tests__
      rule_text: "Unit tests live in src/__tests__/ and mirror the source structure. Test files are named [source-filename].test.ts. Each test file imports exactly the module it tests  -  not its entire dependency tree. The goal is to test the public API of each module in isolation."
      example: |
        // src/__tests__/services/user.service.test.ts
        import { describe, it, expect, vi, beforeEach } from 'vitest';
        import { UserService } from '@/services/user.service';

        // Mock the repository  -  unit tests don't hit the database
        vi.mock('@/repositories/user.repository', () => ({
          findUserByEmail: vi.fn(),
          createUser: vi.fn(),
        }));

        describe('UserService', () => {
          beforeEach(() => vi.clearAllMocks());

          it('should throw if email already exists', async () => {
            const { findUserByEmail } = await import('@/repositories/user.repository');
            vi.mocked(findUserByEmail).mockResolvedValue({ id: '1', email: 'a@b.com' } as any);
            await expect(UserService.register('a@b.com', 'password')).rejects.toThrow('Email already in use');
          });
        });
      indicators:
        - ".test.ts"
        - ".spec.ts"
        - "vi.mock("
    - concern: mocking
      belongs_in: src/__tests__
      rule_text: "Use vi.mock() to mock modules at module load time  -  call it at the top level (hoisted). Use vi.fn() for function mocks with mockReturnValue/mockResolvedValue to control behavior. Reset all mocks in beforeEach with vi.clearAllMocks() to prevent state leaking between tests."
      example: |
        import { describe, it, expect, vi, beforeEach } from 'vitest';
        import { sendEmail } from '@/lib/email';
        import { notifyUser } from '@/services/notification.service';

        // vi.mock() is hoisted  -  runs before imports
        vi.mock('@/lib/email', () => ({
          sendEmail: vi.fn().mockResolvedValue({ messageId: 'test-123' }),
        }));

        describe('notifyUser', () => {
          beforeEach(() => vi.clearAllMocks()); // reset call counts and return values

          it('sends an email to the user', async () => {
            await notifyUser('user@example.com', 'Welcome!');
            expect(sendEmail).toHaveBeenCalledOnce();
            expect(sendEmail).toHaveBeenCalledWith('user@example.com', expect.objectContaining({ subject: 'Welcome!' }));
          });

          it('does not send if user has opted out', async () => {
            await notifyUser('optout@example.com', 'Welcome!', { optedOut: true });
            expect(sendEmail).not.toHaveBeenCalled();
          });
        });
      indicators:
        - "vi.mock("
        - "vi.fn("
        - "vi.spyOn("
    - concern: coverage
      belongs_in: vitest.config.ts
      rule_text: "Set coverage thresholds in vitest.config.ts to enforce minimum coverage. Use @vitest/coverage-v8 as the provider (faster, native). Include/exclude patterns control which files are measured. CI fails if thresholds are not met  -  protecting against coverage regression."
      example: |
        // vitest.config.ts
        import { defineConfig } from 'vitest/config';
        import path from 'path';

        export default defineConfig({
          test: {
            globals: true,
            environment: 'node',
            setupFiles: ['./tests/setup.ts'],
            coverage: {
              provider: 'v8',
              reporter: ['text', 'json', 'html'],
              include: ['src/**/*.ts'],
              exclude: ['src/**/*.d.ts', 'src/**/index.ts', 'src/types/**'],
              thresholds: {
                lines: 80,
                functions: 80,
                branches: 70,
                statements: 80,
              },
            },
          },
          resolve: {
            alias: { '@': path.resolve(__dirname, './src') },
          },
        });
      indicators:
        - "vitest.config.ts"
        - "coverage:"
        - "thresholds:"
    - concern: async_testing
      belongs_in: src/__tests__
      rule_text: "Always await async assertions and use the correct Vitest assertion for async operations. Use expect(...).rejects.toThrow() for expected errors. Always return or await the assertion chain  -  unawaited assertions pass even when they should fail."
      example: |
        import { it, expect, vi } from 'vitest';
        import { getUser } from '@/services/user.service';

        it('returns null for unknown user', async () => {
          const user = await getUser('nonexistent-id');
          expect(user).toBeNull();
        });

        it('throws for invalid ID format', async () => {
          // ✓ Must await rejects assertions
          await expect(getUser('not-a-uuid')).rejects.toThrow('Invalid user ID');
        });

        it('resolves with user data', async () => {
          const user = await getUser('valid-uuid-123');
          expect(user).toMatchObject({ id: 'valid-uuid-123', email: expect.any(String) });
        });
      indicators:
        - "await expect("
        - ".rejects."
        - ".resolves."
    - concern: security_testing
      belongs_in: tests
      rule_text: "Mock secrets and API keys in tests using vi.stubEnv() or a test .env file — never use real credentials. Test that auth guards reject unauthenticated requests. Verify that sensitive fields (passwords, tokens) are excluded from API responses. Never log or snapshot actual secret values in test output."
      example: |
        // tests/services/user.service.test.ts
        import { describe, it, expect, vi, beforeEach } from 'vitest';

        beforeEach(() => {
          vi.stubEnv('JWT_SECRET', 'test-secret-not-real');
          vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost/test');
        });

        it('should not include password hash in user response', async () => {
          const user = await getPublicUser('user-123');
          expect(user).not.toHaveProperty('passwordHash');
          expect(user).not.toHaveProperty('password');
        });
      indicators:
        - "vi.stubEnv"
        - "not.toHaveProperty('password"
    - concern: test_organization
      belongs_in: tests
      rule_text: "Follow the test pyramid: many fast unit tests, fewer integration tests, minimal E2E tests. Each test file tests one module (SRP for tests). Organize tests mirroring source structure or by test type (tests/unit/, tests/integration/). Share fixtures and factories via tests/helpers/ — don't duplicate setup logic across test files. Each test case should assert one behavior."
      example: |
        // tests/unit/services/user.service.test.ts — one module, one concern
        describe('UserService.createUser', () => {
          it('returns created user', async () => { /* one assertion */ });
          it('throws on duplicate email', async () => { /* one assertion */ });
          it('hashes password before saving', async () => { /* one assertion */ });
        });

        // tests/helpers/factories.ts — shared, DRY
        export function buildUser(overrides = {}) {
          return { id: '1', name: 'Test', email: 'test@test.com', ...overrides };
        }

        // tests/integration/routes/users.test.ts — fewer, slower, real deps
        describe('POST /users', () => {
          it('creates user and returns 201', async () => { /* hits real handler */ });
        });
      indicators:
        - "tests/unit/"
        - "tests/integration/"
        - "tests/helpers/"
        - "buildUser"
patterns:
  data_flow:
    direction: "Test → vi.mock() (module replacement) → Module Under Test → Assertion"
    rules:
      - "vi.mock() replaces modules at load time  -  mock the dependencies, not the module under test."
      - "vi.clearAllMocks() in beforeEach ensures each test starts with clean mock state."
      - "Test observable behavior (return values, thrown errors, side effects) not internal state."
      - "Integration tests in tests/integration/ use real dependencies  -  no mocking."
      - "Coverage thresholds in vitest.config.ts  -  CI fails if coverage drops below threshold."
  error_handling:
    recommended: "For expected errors, use await expect(fn()).rejects.toThrow(). Always await the assertion  -  an unawaited .rejects check never runs the assertion and passes silently."
  naming:
    unit_tests: "src/__tests__/[path]/[module].test.ts  -  mirrors source path"
    integration_tests: "tests/integration/[feature].integration.test.ts"
    fixtures: "tests/fixtures/[resource].factory.ts  -  factory functions returning test data"
    setup: "tests/setup.ts  -  global beforeAll/afterAll hooks (DB connection, etc.)"
anti_patterns:
  - id: jest_api_in_vitest
    severity: warning
    description: "Using Jest APIs (jest.fn(), jest.mock(), @jest/globals) in a Vitest project. Jest and Vitest have similar but distinct APIs  -  jest.mock() does not work in Vitest, and jest.fn() creates an incompatible mock object."
    bad_example: |
      // ❌ Jest API in a Vitest project  -  jest is undefined at runtime
      import { jest } from '@jest/globals';
      const fn = jest.fn();
      jest.mock('../lib/db');
      jest.spyOn(console, 'error');
    good_example: |
      // ✓ Vitest API  -  same patterns, correct module
      import { vi } from 'vitest';
      const fn = vi.fn();
      vi.mock('../lib/db');
      vi.spyOn(console, 'error');
  - id: no_coverage_threshold
    severity: warning
    description: "Configuring coverage reporting without thresholds. Coverage numbers are displayed but no CI failure is triggered when they drop. Coverage silently regresses to 0% over time without developer awareness."
    bad_example: |
      // vitest.config.ts  -  coverage runs but thresholds not enforced
      coverage: {
        provider: 'v8',
        reporter: ['text'],
        // Missing: thresholds
      }
    good_example: |
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        thresholds: { lines: 80, functions: 80, branches: 70 },
      }
  - id: shared_mock_state
    severity: warning
    description: "Not calling vi.clearAllMocks() between tests  -  mock call counts and return values from one test persist into the next test. A mock that returns a value in test 1 will return the same value in test 2 even if the test doesn't configure it, causing false passes."
    bad_example: |
      // ❌ Mock state leaks between tests  -  no clearAllMocks
      it('test 1', () => { mockFn.mockReturnValue('hello'); mockFn(); });
      it('test 2', () => {
        // mockFn still has call count = 1 and return value 'hello' from test 1
        expect(mockFn).not.toHaveBeenCalled(); // FALSE POSITIVE  -  passes incorrectly
      });
    good_example: |
      // ✓ Clean mock state for every test
      beforeEach(() => vi.clearAllMocks()); // resets all mock state before each test
  - id: testing_implementation_details
    severity: warning
    description: "Testing internal state, private methods, or how a function does its work instead of what it returns. Tests tied to implementation break on every refactor even when behavior is correct  -  they add maintenance burden without adding safety."
    bad_example: |
      // ❌ Testing internal implementation  -  breaks on refactor
      it('should call _formatEmail before sending', () => {
        const spy = vi.spyOn(service, '_formatEmail' as any);
        service.sendWelcomeEmail('user@example.com');
        expect(spy).toHaveBeenCalled(); // testing HOW, not WHAT
      });
    good_example: |
      // ✓ Test observable behavior  -  what the function produces
      it('sends a welcome email with the correct subject', async () => {
        await service.sendWelcomeEmail('user@example.com');
        expect(sendEmail).toHaveBeenCalledWith('user@example.com', expect.objectContaining({
          subject: 'Welcome to the platform',
        }));
      });
  - id: async_test_without_await
    severity: critical
    description: "Not awaiting async assertions in tests. Without await, expect(...).rejects.toThrow() returns a Promise that is ignored  -  the test passes even if the function throws synchronously or doesn't throw at all."
    bad_example: |
      // ❌ Unawaited assertion  -  always passes regardless of behavior
      it('should throw for invalid input', () => {
        // No await  -  this Promise is created and immediately discarded
        expect(getUser('invalid')).rejects.toThrow(); // always passes!
      });
    good_example: |
      // ✓ Await the assertion  -  test fails if the function doesn't throw
      it('should throw for invalid input', async () => {
        await expect(getUser('invalid')).rejects.toThrow('Invalid user ID');
      });
  - id: snapshot_overuse
    severity: warning
    description: "Using toMatchSnapshot() for business logic assertions  -  snapshot tests hide intent (the snapshot is not readable), break on irrelevant UI/format changes, and make it impossible to understand what a test is verifying without looking up the snapshot file."
    bad_example: |
      // ❌ Snapshot for business logic  -  what does this test?
      it('should calculate order total', () => {
        const order = calculateOrder([{ price: 10, qty: 2 }, { price: 5, qty: 1 }]);
        expect(order).toMatchSnapshot(); // snapshot: { total: 25, items: [...] }
        // When the snapshot fails, is it a bug or an intentional change?
      });
    good_example: |
      // ✓ Explicit assertions  -  intent is immediately clear
      it('should calculate order total with correct subtotals', () => {
        const order = calculateOrder([{ price: 10, qty: 2 }, { price: 5, qty: 1 }]);
        expect(order.total).toBe(25);
        expect(order.items).toHaveLength(2);
        expect(order.items[0].subtotal).toBe(20);
      });
  - id: real_secrets_in_tests
    severity: critical
    description: "Tests use real API keys, database credentials, or JWT secrets instead of mock values. If test output is logged in CI, secrets are exposed in build logs. If tests run against production services, test data pollutes real data."
    bad_example: |
      // test uses real Stripe key — charges real cards if test hits live API
      const stripe = new Stripe('sk_live_abc123...');
    good_example: |
      // test uses stubbed env — no real service calls
      vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fake');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  - id: mega_test_file
    severity: warning
    description: "A single test file tests multiple unrelated modules or contains 50+ test cases. Test failures are hard to locate, test runs are slow because everything runs sequentially, and the file becomes as unmaintainable as the god files it's supposed to prevent."
    bad_example: |
      // tests/everything.test.ts — 200 lines testing users, products, auth, and utils
      describe('UserService', () => { /* 15 tests */ });
      describe('ProductService', () => { /* 12 tests */ });
      describe('AuthMiddleware', () => { /* 8 tests */ });
      describe('formatDate', () => { /* 5 tests */ });
    good_example: |
      // tests/unit/services/user.service.test.ts — one module
      // tests/unit/services/product.service.test.ts — one module
      // tests/unit/middleware/auth.test.ts — one module
      // tests/unit/utils/date.test.ts — one module
  - id: untested_abstractions
    severity: warning
    description: "New service functions, repositories, or utility modules are created during refactoring but no corresponding test files are added. Every new abstraction should have at least one test verifying its primary behavior."
    bad_example: |
      // lib/services/billing.service.ts  -  new file, 15 functions, 0 tests
    good_example: |
      // lib/services/billing.service.ts  -  15 functions
      // __tests__/lib/services/billing.service.test.ts  -  tests for createInvoice, markPaid, calculateFees

---
