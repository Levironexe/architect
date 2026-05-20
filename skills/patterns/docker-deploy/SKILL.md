---
schema_version: "2.0.0"
id: docker-deploy
name: "Docker"
version: "2.0.0"
description: "Docker containerization with multi-stage builds, non-root user, runtime-injected secrets, HEALTHCHECK, pinned base image tags, and correct COPY order to maximize layer cache."
category: pattern
language: javascript
frameworks: []
dependencies:
  none: []
detection:
  files:
    - Dockerfile
    - docker-compose.yml
    - docker-compose.yaml
  source_indicators:
    - "FROM node:"
    - "COPY --from=builder"
    - "docker-compose"
    - "AS builder"
    - "AS production"
structure:
  required_dirs: []
  recommended_dirs:
    - path: docker
      purpose: "Docker support files  -  entrypoint.sh (startup script that runs migrations before the app), healthcheck.sh (custom health probe script), and any docker-compose overrides. Keep these out of the project root to avoid clutter."
    - path: .docker
      purpose: "Alternative location for Docker configuration scripts  -  entrypoints, init scripts, and environment templates. Use one consistent location across the project."
separation:
  rules:
    - concern: multi_stage_build
      belongs_in: Dockerfile
      rule_text: "Use a two-stage Dockerfile  -  a `builder` stage installs all dependencies (including devDependencies) and compiles the TypeScript source, and a `production` stage copies only the compiled output. Never copy the entire source or node_modules from the builder if you can reinstall with --omit=dev."
      example: |
        # Dockerfile
        # Stage 1: build
        FROM node:20-alpine AS builder
        WORKDIR /app
        # Copy package files first  -  layer is cached until package.json changes
        COPY package*.json ./
        RUN npm ci
        COPY . .
        RUN npm run build  # produces dist/

        # Stage 2: production  -  only compiled output, no devDependencies
        FROM node:20-alpine AS production
        WORKDIR /app
        COPY package*.json ./
        RUN npm ci --omit=dev  # install only runtime deps  -  ~70% smaller image
        COPY --from=builder /app/dist ./dist
        # Run health checks, switch user, start app
        HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
          CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
        USER node
        CMD ["node", "dist/index.js"]
      indicators:
        - "FROM node:"
        - "AS builder"
        - "AS production"
        - "COPY --from=builder"
    - concern: non_root_user
      belongs_in: Dockerfile
      rule_text: "Switch to the built-in `node` user before the CMD or ENTRYPOINT instruction. Running as root in a container gives an attacker full host access if the container runtime is misconfigured or the app has a code execution vulnerability."
      example: |
        # ✓ Switch to non-root user  -  applied in the production stage
        # Ensure the app directory is owned by node before switching
        COPY --chown=node:node --from=builder /app/dist ./dist
        USER node
        CMD ["node", "dist/index.js"]
      anti_indicators:
        - "USER root"
    - concern: env_injection
      belongs_in: docker-compose.yml
      rule_text: "Inject all secrets via environment variables at container runtime  -  never bake secrets into the image with ENV or ARG instructions. Use docker-compose's env_file directive to load from .env. Commit .env.example with placeholder values; add .env to .gitignore."
      example: |
        # docker-compose.yml  -  runtime environment injection
        services:
          app:
            build: .
            ports:
              - "3000:3000"
            env_file: .env          # loads DATABASE_URL, JWT_SECRET, etc. from .env
            environment:
              NODE_ENV: production  # non-secret config can be inline
            restart: unless-stopped
      indicators:
        - "env_file:"
        - "environment:"
    - concern: layer_cache_order
      belongs_in: Dockerfile
      rule_text: "Order COPY instructions to maximize Docker's layer cache  -  copy package files (package.json, package-lock.json) and run npm ci BEFORE copying application source. Since package files change rarely, the npm ci layer is cached for the majority of builds."
      example: |
        # ✓ Package files first  -  npm ci layer cached unless package.json changes
        COPY package*.json ./
        RUN npm ci  # cached on most builds
        COPY . .    # application source last  -  invalidates only subsequent layers
        RUN npm run build

        # ❌ WRONG ORDER  -  invalidates npm ci on every source file change:
        # COPY . .         # copies everything including src/
        # RUN npm ci       # re-runs on every code change  -  no cache benefit
        # RUN npm run build
      indicators:
        - "COPY package*.json"
    - concern: healthcheck
      belongs_in: Dockerfile
      rule_text: "Add a HEALTHCHECK instruction to every production Dockerfile. Without it, Docker and Kubernetes cannot distinguish between a starting container and a broken one  -  they keep routing traffic to unhealthy instances."
      example: |
        # Option 1: HTTP health check via node inline script (no extra dependencies)
        HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
          CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

        # Option 2: wget (available in alpine)
        HEALTHCHECK --interval=30s --timeout=5s CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

        # In docker-compose, override start-period for slow-starting apps:
        # healthcheck:
        #   test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
        #   start_period: 30s
      indicators:
        - "HEALTHCHECK"
        - "/health"
    - concern: testing_in_containers
      belongs_in: Dockerfile
      rule_text: "Add a test stage to the multi-stage Dockerfile that runs unit tests during the build. If tests fail, the image is not built. Use a separate docker-compose.test.yml for integration tests that need databases or other services. Keep test dependencies in a build stage that gets discarded — they should not appear in the production image."
      example: |
        # Dockerfile — test stage runs before production stage
        FROM node:20-alpine AS deps
        WORKDIR /app
        COPY package*.json ./
        RUN npm ci

        FROM deps AS test
        COPY . .
        RUN npm run test -- --reporter=verbose
        # If tests fail, build stops here

        FROM deps AS build
        COPY . .
        RUN npm run build

        FROM node:20-alpine AS production
        COPY --from=build /app/dist ./dist
        COPY --from=deps /app/node_modules ./node_modules
        CMD ["node", "dist/index.js"]
      indicators:
        - "AS test"
        - "npm run test"
        - "AS production"
patterns:
  data_flow:
    direction: "Source → Builder Stage (npm ci + tsc) → Production Stage (npm ci --omit=dev + dist copy) → Container Runtime (env vars injected)"
    rules:
      - "Builder stage: install all deps + compile TypeScript to dist/."
      - "Production stage: reinstall only runtime deps (--omit=dev) + copy dist/ from builder."
      - "Secrets injected at runtime via env_file  -  never in Dockerfile ENV or ARG."
      - "COPY package files before COPY . . to maximize layer cache reuse."
      - "HEALTHCHECK enables orchestrators to detect unhealthy containers automatically."
  error_handling:
    recommended: "Add a /health endpoint that returns 200 when the app is ready (DB connected, etc.) and 503 during startup or degraded state. HEALTHCHECK uses this to report container health to Docker/Kubernetes."
  naming:
    dockerfile: "Dockerfile at project root  -  multi-stage: AS builder then AS production"
    compose: "docker-compose.yml (development) + docker-compose.prod.yml (production overrides)"
    env_template: ".env.example committed to git with placeholder values; .env in .gitignore"
    health_endpoint: "GET /health  -  returns { status: 'ok', uptime: number } with 200, or 503 during degraded state"
anti_patterns:
  - id: secrets_in_image
    severity: critical
    description: "Baking secrets into Docker images with ENV or ARG instructions. Secrets persist in image layers and are visible via `docker history`  -  anyone with pull access to the image registry can read them."
    bad_example: |
      # ❌ Secrets baked into the image  -  visible in docker history
      ARG DATABASE_URL
      ENV DATABASE_URL=${DATABASE_URL}
      ENV JWT_SECRET=hardcoded-secret-key
      # docker history myapp → shows JWT_SECRET value in the layer
    good_example: |
      # ✓ Inject secrets at runtime, not build time
      # docker-compose.yml: env_file: .env
      # Or: docker run --env-file .env myapp
      # Image contains no secrets  -  safe to push to any registry
  - id: single_stage_build
    severity: warning
    description: "Using a single-stage Dockerfile that includes all devDependencies, TypeScript source, and build tools in the production image. A typical Next.js project: single-stage = ~1.5 GB image, multi-stage = ~300 MB. Larger images mean slower deployments and a larger attack surface."
    bad_example: |
      # ❌ Single stage  -  devDependencies + source + build tools in production
      FROM node:20
      WORKDIR /app
      COPY . .            # includes src/, tests/, .env.example
      RUN npm install     # installs ALL deps including jest, ts-node, etc.
      RUN npm run build
      CMD ["node", "dist/index.js"]
    good_example: |
      # ✓ Multi-stage  -  production image has only what's needed to run
      FROM node:20-alpine AS builder
      RUN npm ci && npm run build
      FROM node:20-alpine AS production
      COPY package*.json ./
      RUN npm ci --omit=dev  # runtime deps only
      COPY --from=builder /app/dist ./dist
  - id: running_as_root
    severity: warning
    description: "Not switching to a non-root user before CMD  -  Docker containers run as root by default. If the application has an RCE vulnerability, the attacker has root-level access inside the container."
    bad_example: |
      # ❌ No USER instruction  -  process runs as root inside container
      COPY --from=builder /app/dist ./dist
      CMD ["node", "dist/index.js"]
    good_example: |
      # ✓ Switch to the built-in non-root node user
      COPY --chown=node:node --from=builder /app/dist ./dist
      USER node
      CMD ["node", "dist/index.js"]
  - id: using_latest_tag
    severity: warning
    description: "Using `FROM node:latest`  -  the `latest` tag is a moving target that resolves to a different version on each build. When a new Node.js major is released, `latest` jumps to it and your build may fail with breaking changes. Pin to a specific LTS version."
    bad_example: |
      # ❌ Non-deterministic  -  breaks when node:latest jumps to a new major
      FROM node:latest
      # Today: node 22. After next LTS release: could be node 24  -  breaking
    good_example: |
      # ✓ Pinned to a specific LTS version  -  predictable builds
      FROM node:20-alpine AS builder
      FROM node:20-alpine AS production
      # To upgrade, explicitly change the version and test
  - id: copying_node_modules
    severity: warning
    description: "Running COPY . . before npm ci causes local node_modules to be copied into the image. node_modules built on macOS are not compatible with the Linux container  -  native addons fail, symlinks break, and the image includes dev dependencies."
    bad_example: |
      # ❌ COPY . . copies local node_modules into the image
      FROM node:20-alpine
      WORKDIR /app
      COPY . .           # copies node_modules from macOS host!
      RUN npm ci         # may use or be confused by the already-copied modules
      CMD ["node", "dist/index.js"]
    good_example: |
      # ✓ Add node_modules to .dockerignore, copy package files first
      # .dockerignore: node_modules, dist, .env
      FROM node:20-alpine
      WORKDIR /app
      COPY package*.json ./  # package files only  -  no local node_modules
      RUN npm ci             # fresh install in the Linux container
      COPY . .               # source files only (node_modules excluded by .dockerignore)

---
