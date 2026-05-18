---
schema_version: "2.0.0"
id: flask
name: "Flask"
version: "1.0.0"
description: "Flask 3.x Application Factory + Blueprints structure with correct extension initialization, circular import prevention, and service layer separation."
category: stack
language: python
frameworks:
  - flask
  - flask-sqlalchemy
detection:
  dependencies:
    any:
      - flask
      - Flask
  files:
    - run.py
    - wsgi.py
    - app/__init__.py
  source_indicators:
    - "from flask import"
    - "Flask(__name__)"
    - "create_app"
    - "Blueprint("
structure:
  required_dirs:
    - path: "app/__init__.py"
      purpose: "Contains the create_app() application factory. Creates the Flask instance, loads config, calls extension.init_app(app) for each extension, and registers blueprints inside the function body. Returns the app. Never creates the Flask instance at module level."
    - path: "app/extensions.py"
      purpose: "Unbound extension instances. Declares db = SQLAlchemy(), mail = Mail(), etc. without binding them to an app. Extensions are bound later inside create_app() via init_app(). This breaks circular imports and enables testing with different configs."
    - path: "app/config.py"
      purpose: "Configuration classes (Config, DevelopmentConfig, ProductionConfig, TestingConfig). Reads secrets from environment variables — never hardcodes them. create_app() selects the right class by name."
    - path: "app/{blueprint_name}/__init__.py"
      purpose: "Blueprint definition for this domain. Defines bp = Blueprint('name', __name__, url_prefix='/prefix'). Imported and registered inside create_app() to avoid circular imports."
    - path: "app/{blueprint_name}/routes.py"
      purpose: "Route handlers for this blueprint. Thin: validate input, call service, return response or render template. No ORM calls or business logic here."
    - path: "app/models/"
      purpose: "SQLAlchemy model definitions. Models import db from app.extensions. One file per domain or a single models.py for small apps."
  recommended_dirs:
    - path: "app/{blueprint_name}/services.py"
      purpose: "Business logic for this blueprint domain. Plain Python functions that accept and return domain objects. Do not import the Flask request object — receive data as function arguments."
    - path: "tests/"
      purpose: "Test files that call create_app('testing') to get a fresh app instance per test. Use pytest-flask or a conftest.py fixture that creates the app and a test client."
separation:
  rules:
    - concern: app_creation
      belongs_in: "app/__init__.py"
      rule_text: "The Flask app instance is created only inside the create_app() factory function, never at module level. Extensions are initialized with init_app(app) inside create_app(). Blueprints are imported and registered inside create_app(), never at the top of __init__.py. The factory returns the app instance."
      example: |
        # app/__init__.py — correct: application factory
        from flask import Flask
        from .extensions import db, mail
        from .config import config_by_name

        def create_app(config_name: str = "development") -> Flask:
            app = Flask(__name__)
            app.config.from_object(config_by_name[config_name])

            db.init_app(app)
            mail.init_app(app)

            # Import blueprints INSIDE create_app to avoid circular imports
            from .auth import bp as auth_bp
            from .api import bp as api_bp
            app.register_blueprint(auth_bp)
            app.register_blueprint(api_bp, url_prefix="/api/v1")

            return app
      anti_indicators:
        - "app = Flask(__name__)"
        - "db = SQLAlchemy(app)"
    - concern: extension_initialization
      belongs_in: "app/extensions.py"
      rule_text: "Extension instances are created unbound in extensions.py — no app reference is passed at creation time. The create_app() factory calls extension.init_app(app). This pattern allows multiple app instances to exist (test vs production) and prevents circular imports."
      example: |
        # app/extensions.py — correct: unbound extensions
        from flask_sqlalchemy import SQLAlchemy
        from flask_mail import Mail
        from flask_migrate import Migrate

        db = SQLAlchemy()
        mail = Mail()
        migrate = Migrate()

        # app/__init__.py binds them:
        # db.init_app(app)
        # mail.init_app(app)
        # migrate.init_app(app, db)
      anti_indicators:
        - "SQLAlchemy(app)"
        - "Mail(app)"
    - concern: route_handlers
      belongs_in: "app/{blueprint_name}/routes.py"
      rule_text: "Route handlers extract request data, validate it, call a service function, and return a response or render a template. No direct ORM access. No business logic. Use url_for('blueprint_name.endpoint') for redirects and links — never hardcode URLs."
      example: |
        # app/auth/routes.py — correct: thin route handler
        from flask import request, jsonify, url_for
        from . import bp
        from .services import register_user
        from app.extensions import db

        @bp.post("/register")
        def register():
            data = request.get_json(force=True)
            user = register_user(email=data["email"], password=data["password"], db=db)
            return jsonify({"id": user.id, "email": user.email}), 201
patterns:
  data_flow:
    direction: "HTTP Request → Blueprint route handler (extract + validate) → Service (business logic) → SQLAlchemy Model (DB) → JSON response or Jinja2 template"
    rules:
      - "Never access current_app or g outside of a request or app context. Use init_app pattern so extensions work without a bound app."
      - "Use app.config.from_object(ConfigClass) — do not manually set individual config keys in create_app()."
      - "Blueprints can have their own templates/ subdirectory. Namespace templates with a subfolder matching the blueprint name (auth/login.html) to prevent override conflicts."
      - "Use url_for() for all internal URL generation. Never construct URL strings manually."
      - "For background tasks that need app context, use app.app_context() explicitly or a task queue (Celery) that receives the app factory."
  naming:
    blueprints: "Use lowercase singular names for blueprints (auth, api, admin). Set url_prefix at registration time in create_app(), not in the Blueprint() constructor, so the prefix can vary between environments."
    files: "Keep routes.py thin. If a blueprint grows beyond ~5 routes, split into multiple route files (auth/routes/login.py, auth/routes/oauth.py) and import them into the blueprint __init__.py."
anti_patterns:
  - id: module_level_app_creation
    severity: critical
    description: "The Flask app instance is created at module level (app = Flask(__name__) outside any function). This prevents using different configurations for testing vs production, causes circular imports when blueprints try to import from the app, and makes the app a global singleton that cannot be reset between tests."
    bad_example: |
      # wrong: module-level app creation
      # app/__init__.py
      from flask import Flask
      from flask_sqlalchemy import SQLAlchemy

      app = Flask(__name__)
      app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///prod.db"
      db = SQLAlchemy(app)  # also wrong: bound at creation

      from .auth import routes  # circular import risk
    good_example: |
      # correct: application factory
      # app/__init__.py
      from flask import Flask
      from .extensions import db

      def create_app(config_name="development"):
          app = Flask(__name__)
          app.config.from_object(f"app.config.{config_name.title()}Config")
          db.init_app(app)
          from .auth import bp as auth_bp
          app.register_blueprint(auth_bp)
          return app
  - id: blueprint_imported_at_top
    severity: critical
    description: "Blueprint modules are imported at the top of app/__init__.py before the create_app() factory function is defined. Blueprint modules typically import from app.extensions (db, mail) which in turn has no app bound yet. This creates circular import errors at startup."
    bad_example: |
      # wrong: blueprint imported at top of __init__.py
      from flask import Flask
      from .auth import bp as auth_bp  # circular import — auth imports from extensions which needs app
      from .extensions import db

      def create_app():
          app = Flask(__name__)
          db.init_app(app)
          app.register_blueprint(auth_bp)
          return app
    good_example: |
      # correct: blueprint imported inside create_app
      from flask import Flask
      from .extensions import db

      def create_app():
          app = Flask(__name__)
          db.init_app(app)
          from .auth import bp as auth_bp  # import here, after extensions are ready
          app.register_blueprint(auth_bp)
          return app
  - id: hardcoded_secrets_in_config
    severity: critical
    description: "Secret keys, database URIs, and API tokens are hardcoded directly in config.py or set inline in create_app(). Secrets committed to version control are a security incident waiting to happen."
    bad_example: |
      # wrong: hardcoded secrets
      class Config:
          SECRET_KEY = "my-super-secret-key"
          SQLALCHEMY_DATABASE_URI = "postgresql://admin:password123@prod-db/myapp"
    good_example: |
      # correct: secrets from environment
      import os

      class Config:
          SECRET_KEY = os.environ["SECRET_KEY"]
          SQLALCHEMY_DATABASE_URI = os.environ["DATABASE_URL"]

      class TestingConfig(Config):
          TESTING = True
          SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"

---
