---
schema_version: "2.0.0"
id: express-api
name: "Express.js REST API"
version: "1.1.0"
description: "Layered Express REST API with routing, request handling, business logic, data access, middleware, configuration, and utilities separated."
category: stack
language: javascript
frameworks:
  - express
detection:
  dependencies:
    any:
      - express
  source_indicators:
    - "express()"
    - "app.listen"
    - "router.get"
    - "router.post"
structure:
  required_dirs:
    - path: src/routes
      purpose: "Route definitions organized by resource."
    - path: src/controllers
      purpose: "Request handlers that receive HTTP input, call services, and return responses."
    - path: src/services
      purpose: "Business logic with no HTTP request or response awareness."
    - path: src/models
      purpose: "Data models and database interactions."
    - path: src/middleware
      purpose: "Cross-cutting request behavior such as auth, validation, and error handling."
  recommended_dirs:
    - path: src/config
      purpose: "Environment and application configuration."
    - path: src/utils
      purpose: "Small shared helpers with no framework coupling."
    - path: src/validators
      purpose: "Request and domain validation schemas."
separation:
  rules:
    - concern: routing
      belongs_in: src/routes
      rule_text: "Route files define HTTP endpoints and delegate request flow to controllers. They should not contain persistence or business rules."
      example: |
        router.get('/users', UserController.list);
        router.post('/users', UserController.create);
      indicators:
        - "router.get"
        - "router.post"
        - "app.get"
    - concern: request_handling
      belongs_in: src/controllers
      rule_text: "Controllers translate req/res objects into plain inputs for services and shape the HTTP response from service results."
      example: |
        export async function create(req, res) {
          const user = await userService.create(req.body);
          res.status(201).json(user);
        }
      indicators:
        - "req.body"
        - "res.json"
        - "res.status"
    - concern: business_logic
      belongs_in: src/services
      rule_text: "Services contain business rules and orchestration. They accept plain data and return plain data without touching HTTP objects."
      example: |
        export async function createUser(input) {
          await validateUser(input);
          return userModel.create(input);
        }
      anti_indicators:
        - "req."
        - "res."
        - "next("
    - concern: data_access
      belongs_in: src/models
      rule_text: "Models and repositories own database queries and persistence details so higher layers stay storage-agnostic."
      example: |
        export async function createUserRecord(data) {
          return prisma.user.create({ data });
        }
      indicators:
        - "prisma."
        - ".findOne"
        - ".create("
        - "SELECT"
patterns:
  error_handling:
    recommended: "Use centralized error-handling middleware."
  data_flow:
    direction: "Route -> Controller -> Service -> Model"
    rules:
      - "Routes call controllers."
      - "Controllers call services."
      - "Services do not import request or response objects."
  naming:
    files: "Use kebab-case for all file names. Suffix by layer: users.route.ts, users.controller.ts, users.service.ts, users.model.ts, auth.middleware.ts."
    controllers: "[resource].controller.ts"
    services: "[resource].service.ts"
anti_patterns:
  - id: god_file
    severity: critical
    description: "Single file mixes routes, data access, validation, and business logic."
    bad_example: |
      app.post('/users', async (req, res) => {
        const hash = await bcrypt.hash(req.body.password, 10);
        const user = await db.query('INSERT INTO users ...');
        res.status(201).json(user);
      });
    good_example: |
      // src/routes/users.ts  -  route only delegates
      router.post('/users', UserController.create);

      // src/controllers/users.controller.ts  -  translates HTTP to plain data
      export async function create(req: Request, res: Response) {
        const user = await userService.createUser(req.body);
        res.status(201).json(user);
      }

      // src/services/users.service.ts  -  business rules, no HTTP awareness
      export async function createUser(input: CreateUserDTO) {
        const hash = await bcrypt.hash(input.password, 10);
        return userModel.create({ ...input, password: hash });
      }
  - id: raw_sql_in_routes
    severity: warning
    description: "SQL queries appear directly in route handlers."
    bad_example: |
      router.get('/users', async (req, res) => {
        const rows = await db.query('SELECT * FROM users');
        res.json(rows);
      });
    good_example: |
      router.get('/users', UserController.list);
  - id: hardcoded_secrets
    severity: critical
    description: "Secrets or credentials are hardcoded in source files."
    bad_example: |
      const jwtSecret = 'super-secret-key';
    good_example: |
      // src/config/index.ts  -  validated at startup, never scattered across the app
      import { z } from 'zod';
      const env = z.object({
        JWT_SECRET: z.string().min(32),
        DATABASE_URL: z.string().url(),
      }).parse(process.env);
      export const config = {
        auth: { jwtSecret: env.JWT_SECRET },
        db: { url: env.DATABASE_URL },
      };

      // In middleware  -  reads from config, not from process.env
      import { config } from '@/config';
      const jwtSecret = config.auth.jwtSecret;

---
